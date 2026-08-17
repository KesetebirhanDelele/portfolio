// Tier 3 observability — a single stats endpoint reading counts that
// already exist in Postgres/Redis, not a new metrics store. Deliberately
// not a BI tool: just the numbers that answer "is anything broken, and how
// much is this actually being used" at the current single/few-user scale.
const express = require('express');
const pool = require('../db/postgres');
const authMiddleware = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/requireAdmin');
const { queue } = require('../services/heavyTaskQueue');
const healthMonitor = require('../services/healthMonitor');
const latencyTracker = require('../services/latencyTracker');
const { getUsageSummary: getOpenAIUsageSummary } = require('../services/openaiUsageTracker');

const router = express.Router();

router.get('/stats', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const [repos, users, portfolios, deepStatus, analysisStatus, recentFailures, tokens, queueCounts, failedJobs, openaiUsage] = await Promise.all([
      pool.query('SELECT provider, COUNT(*)::int AS count FROM repositories GROUP BY provider'),
      pool.query("SELECT role, COUNT(*)::int AS count FROM users WHERE deleted_at IS NULL GROUP BY role"),
      pool.query('SELECT COUNT(*)::int AS count FROM portfolios'),
      pool.query('SELECT status, COUNT(*)::int AS count FROM deep_analyses GROUP BY status'),
      pool.query('SELECT status, COUNT(*)::int AS count FROM analyses GROUP BY status'),
      // phase_errors_json (not the never-written error_message column — see
      // PROGRESS.md M66.1) holds the real per-phase failure detail:
      // { [phaseName]: { message, code, retryable, occurredAt } }.
      pool.query(
        `SELECT da.id, da.repository_id, r.name AS repository_name, da.phase_errors_json, da.created_at
         FROM deep_analyses da
         JOIN repositories r ON r.id = da.repository_id
         WHERE da.status = 'failed'
         ORDER BY da.created_at DESC LIMIT 10`
      ),
      pool.query('SELECT COALESCE(SUM(tokens_used), 0)::bigint AS total FROM deep_analyses'),
      queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      // Job .data here is safe to expose as-is — heavyTaskQueue.js's handlers
      // are designed to never put secrets in job data (see its header
      // comment), only non-secret references like userId/analysisId/owner.
      queue.getFailed(0, 9),
      getOpenAIUsageSummary(),
    ]);

    // Self-reported, in-memory (healthMonitor.js/latencyTracker.js) — both
    // reset on backend restart by design. See deployment.md for the
    // tradeoff (self-reported vs. an external synthetic pinger).
    const uptime = healthMonitor.getUptimeSummary();
    const latestHealth = healthMonitor.getLatestResult();
    const latency = latencyTracker.getSummary();

    return res.status(200).json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        repositories: { byProvider: repos.rows },
        users: { byRole: users.rows },
        portfolios: { total: portfolios.rows[0].count },
        deepAnalyses: {
          byStatus: deepStatus.rows,
          recentFailures: recentFailures.rows.map(f => ({
            id: f.id,
            repositoryId: f.repository_id,
            repositoryName: f.repository_name,
            phaseErrors: f.phase_errors_json,
            createdAt: f.created_at,
          })),
          totalTokensUsed: Number(tokens.rows[0].total),
        },
        analyses: { byStatus: analysisStatus.rows },
        heavyTaskQueue: {
          ...queueCounts,
          recentFailures: failedJobs.map(job => ({
            id: job.id,
            name: job.name,
            failedReason: job.failedReason,
            data: job.data,
            finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
          })),
        },
        contentGeneration: {
          totalTokensUsed: openaiUsage.totalTokensUsed,
          totalCalls: openaiUsage.totalCalls,
          failedCalls: openaiUsage.failedCalls,
          byCallType: openaiUsage.byCallType,
        },
        systemHealth: {
          status: latestHealth?.status ?? null,
          checks: latestHealth?.checks ?? null,
          checkedAt: latestHealth?.timestamp ?? null,
          uptimePercent1h: uptime.uptimePercent1h,
          uptimePercent24h: uptime.uptimePercent24h,
          sampleCount: uptime.sampleCount,
          monitoringSince: uptime.since,
        },
        latency: latency,
        notes: [
          'deepAnalyses.totalTokensUsed is correctly 0 — the six-phase deep-analysis pipeline (phaseTracker.js/deepAnalysisPipeline.js) makes zero LLM calls by design. contentGeneration.totalTokensUsed covers the app\'s actual LLM dependency (OpenAI, via services/openai.js): narrative, README, project-description, and case-study generation.',
          "analyses (the basic, non-deep pipeline) has no per-failure error detail stored anywhere yet — would need a schema addition to drill into.",
          'systemHealth and latency are in-memory and self-reported — both reset on backend restart, and systemHealth cannot detect the case where the backend process itself is fully down.',
        ],
      },
    });
  } catch (err) {
    console.error('[admin] stats error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to load admin stats.' } });
  }
});

module.exports = router;
