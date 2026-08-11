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
const CONCURRENCY = Number(process.env.HEAVY_TASK_CONCURRENCY) || 2;

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

module.exports = { registerHeavyTaskHandler, runHeavyTask, enqueueHeavyTask, queue, worker };
