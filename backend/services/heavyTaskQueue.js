// Concurrency-limited background queue (observability Tier 2) for the two
// genuinely resource-heavy operations in this app: Colaberry Playwright
// scraping (launches a real headless Chromium per request) and the 6-phase
// deep-analysis pipeline (multiple OpenAI calls per repo). Before this,
// nothing capped how many of either could run at once — a burst of
// requests, or a server restart with several orphaned analyses queued,
// could launch an unbounded number of browsers/pipelines simultaneously on
// one small VPS. Backed by Redis/BullMQ (concurrency lives in Redis, not
// process memory) so the cap holds even if this ever runs as more than one
// process.
//
// Security rule for job data: it is serialized into Redis, so it must never
// contain secrets (decrypted session state, OAuth tokens). Handlers take
// non-secret references (user ids, owner names) and re-resolve anything
// sensitive themselves, in-process, at the moment they need it — see the
// registered handlers in colaberryImport.js and deepAnalysisQueue.js for
// the pattern.
const { Queue, Worker, QueueEvents } = require('bullmq');
const { log } = require('./logger');
const { captureException } = require('./errorTracking');

const connection = { url: process.env.REDIS_URL || 'redis://localhost:6379' };
const QUEUE_NAME = 'heavy-tasks';
// Was 4 on the original 2 vCPU / 3.7GB host — raised to 8 after the host was
// resized to 4 vCPU / 7.6GB (measured: ~6.8GB available at idle) on
// 2026-08-18, briefly to 10 same-day, then pulled back to 6 the same day
// once live-login's own per-session memory was separately doubled to 2048m
// (colaberryLiveLoginSessionManager.js) for the same demo. NOTE: this does
// NOT speed up a single import — jobs in this queue (colaberry-scrape,
// portfolio-pdf) each process their own work sequentially internally; this
// number only controls how many SEPARATE jobs run in parallel. Sized against
// REALISTIC demo-day load, not the full theoretical worst case: base
// services (~1GB) + one active live-login session (2048MB, the actual
// expected concurrent load today) + 6 jobs at the ~512MB RSS cap
// (browserResourceGuard.js) = ~6GB, real margin under the ~6.8GB available.
// Flagging honestly: MAX_CONCURRENT_SESSIONS (4) × 2048MB alone is 8192MB,
// which exceeds total host RAM (7.6GB) on its own — no value of this
// constant can make the FULL theoretical worst case (all 4 live-login
// sessions AND this queue maxed out simultaneously) fit. That's an
// intentionally separate, already-flagged, demo-day-only risk (only 1
// session will actually run today) — not something this number can solve;
// revisit the live-login side (session count or per-session memory) if a
// true worst-case guarantee is ever needed.
const CONCURRENCY = Number(process.env.HEAVY_TASK_CONCURRENCY) || 6;

const queue = new Queue(QUEUE_NAME, { connection });
const queueEvents = new QueueEvents(QUEUE_NAME, { connection });

const handlers = new Map();

// Called once per task type, at module load time, by whichever service
// owns that task (colaberryImport.js, deepAnalysisQueue.js). Throws on a
// duplicate name — a silent overwrite here would mean the wrong handler
// runs for a given job with no error to point at.
function registerHeavyTaskHandler(name, handlerFn) {
  if (handlers.has(name)) throw new Error(`Heavy task handler "${name}" already registered.`);
  handlers.set(name, handlerFn);
}

const worker = new Worker(QUEUE_NAME, async job => {
  const handlerFn = handlers.get(job.name);
  if (!handlerFn) throw new Error(`No heavy task handler registered for "${job.name}".`);

  const startedAt = Date.now();
  log({ event: 'heavy_task_started', context: { jobId: job.id, name: job.name } });
  try {
    const result = await handlerFn(job.data);
    log({
      event: 'heavy_task_completed', outcome: 'success',
      durationMs: Date.now() - startedAt,
      context: { jobId: job.id, name: job.name },
    });
    return result;
  } catch (err) {
    log({
      level: 'error', event: 'heavy_task_failed', outcome: 'failure',
      errorClass: err.name, durationMs: Date.now() - startedAt,
      context: { jobId: job.id, name: job.name, message: err.message },
    });
    // Background job failures never pass through Express, so they'd
    // otherwise be invisible to Sentry — this is the one path that
    // reports them (no-op if SENTRY_DSN isn't set).
    captureException(err, { jobId: job.id, jobName: job.name });
    throw err;
  }
}, { connection, concurrency: CONCURRENCY });

worker.on('error', err =>
  log({ level: 'error', event: 'heavy_task_worker_error', errorClass: err.name, context: { message: err.message } })
);

const RETENTION = { removeOnComplete: { age: 3600 }, removeOnFail: { age: 86400 } };

// Enqueue and wait for the result — for callers whose HTTP response depends
// on the outcome (Colaberry import: the client is waiting for the scraped
// project list). Concurrency queuing means this can now take longer than
// the underlying operation alone when the queue is busy — that's the
// tradeoff for not launching unbounded Playwright instances.
async function runHeavyTask(name, data, { timeoutMs = 10 * 60 * 1000 } = {}) {
  const job = await queue.add(name, data, RETENTION);
  return job.waitUntilFinished(queueEvents, timeoutMs);
}

// Enqueue without waiting — for callers that already have their own
// fire-and-forget/DB-polling contract (deep analysis: the route responds
// immediately and the client polls analysis status).
async function enqueueHeavyTask(name, data) {
  return queue.add(name, data, RETENTION);
}

// How many recently-completed jobs to sample for the average-duration
// estimate used by getQueuePosition's ETA. All job types share one
// queue/concurrency pool, so a mixed-type average is the honest number —
// a scrape job and a PDF job draw from the same execution slots.
const COMPLETED_SAMPLE_SIZE = 20;

async function getAverageDurationMs() {
  const recent = await queue.getJobs(['completed'], 0, COMPLETED_SAMPLE_SIZE - 1);
  const durations = recent
    .map(j => (j.finishedOn && j.processedOn) ? j.finishedOn - j.processedOn : null)
    .filter(d => d !== null && d > 0);
  if (durations.length === 0) return null;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

// Powers the "you're #N in line, ~Xs" indicator for fire-and-forget jobs
// (see enqueueHeavyTask callers in colaberryImport.js). Returns null if the
// job id is unknown (e.g. already swept by RETENTION's removeOnComplete/
// removeOnFail age, or never existed) — callers should treat that as
// NOT_FOUND, not as "still waiting."
async function getQueuePosition(jobId) {
  const job = await queue.getJob(jobId);
  if (!job) return null;
  const state = await job.getState();
  const userId = job.data?.userId ?? null;

  if (state === 'completed') return { state, userId, result: job.returnvalue };
  if (state === 'failed')    return { state, userId, error: job.failedReason };

  const [waitingJobs, activeJobs, avgDurationMs] = await Promise.all([
    queue.getJobs(['waiting'], 0, 999),
    queue.getJobs(['active'], 0, 999),
    getAverageDurationMs(),
  ]);
  const waitingIndex = waitingJobs.findIndex(j => j.id === jobId);
  const jobsAhead = state === 'active'
    ? 0
    : (waitingIndex === -1 ? waitingJobs.length : waitingIndex) + activeJobs.length;
  const position = jobsAhead + 1;
  const etaMs = avgDurationMs != null ? Math.ceil(position / CONCURRENCY) * avgDurationMs : null;

  return { state, userId, position, jobsAhead, etaMs };
}

module.exports = { registerHeavyTaskHandler, runHeavyTask, enqueueHeavyTask, getQueuePosition, queue, worker };
