'use strict';

const pool = require('../db/postgres');
const { log } = require('./logger');

// Real token/latency tracking for the app's actual LLM dependency
// (backend/services/openai.js — OpenAI, not Anthropic). This is separate
// from deep_analyses.tokens_used, which correctly stays 0: the six-phase
// deep-analysis pipeline (phaseTracker.js/deepAnalysisPipeline.js) makes
// zero LLM calls by design. This table covers what admin.js used to flag as
// untracked: narrative, README, project-description, and case-study
// generation.

// Best-effort logging — a tracking failure must never break the actual
// OpenAI call it's wrapped around (Failure-First Design: logged, not
// swallowed, but also never fatal to the caller).
async function recordUsage({ callType, model, promptTokens, completionTokens, totalTokens, durationMs, outcome, errorClass }) {
  try {
    await pool.query(
      `INSERT INTO openai_usage_events
         (call_type, model, prompt_tokens, completion_tokens, total_tokens, duration_ms, outcome, error_class)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [callType, model, promptTokens ?? null, completionTokens ?? null, totalTokens ?? null, durationMs, outcome, errorClass ?? null],
    );
  } catch (err) {
    log({
      level: 'error', event: 'openai_usage_record_failed',
      errorClass: err.code || 'DatabaseError',
      context: { callType, message: err.message },
    });
  }
}

// Wraps one OpenAI SDK call: times it, records tokens/duration/outcome, and
// rethrows the original error untouched on failure — tracking is
// observability, never a gate on the real call.
async function trackOpenAICall(callType, model, fn) {
  const start = Date.now();
  try {
    const response = await fn();
    const durationMs = Date.now() - start;
    const usage = response?.usage;
    await recordUsage({
      callType, model,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
      durationMs, outcome: 'success',
    });
    return response;
  } catch (err) {
    const durationMs = Date.now() - start;
    await recordUsage({ callType, model, durationMs, outcome: 'failure', errorClass: err.code || err.name || 'Error' });
    throw err;
  }
}

async function getUsageSummary() {
  const [totals, byType] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
              COUNT(*)::int AS total_calls,
              COUNT(*) FILTER (WHERE outcome = 'failure')::int AS failed_calls,
              COUNT(*) FILTER (WHERE outcome = 'failure' AND created_at >= NOW() - INTERVAL '24 hours')::int AS failed_calls_24h
       FROM openai_usage_events`
    ),
    pool.query(
      `SELECT call_type, COALESCE(SUM(total_tokens), 0)::bigint AS tokens, COUNT(*)::int AS calls
       FROM openai_usage_events GROUP BY call_type ORDER BY tokens DESC`
    ),
  ]);
  return {
    totalTokensUsed: Number(totals.rows[0].total_tokens),
    totalCalls: totals.rows[0].total_calls,
    failedCalls: totals.rows[0].failed_calls,
    failedCallsLast24h: totals.rows[0].failed_calls_24h,
    byCallType: byType.rows.map(r => ({ callType: r.call_type, tokens: Number(r.tokens), calls: r.calls })),
  };
}

module.exports = { trackOpenAICall, recordUsage, getUsageSummary };
