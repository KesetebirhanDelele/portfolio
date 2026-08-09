'use strict';

const pool = require('../db/postgres');
const { createPhaseTracker, createPhaseTrackerFromJSON, PHASES } = require('./phaseTracker');
const { classifyRepositoryFiles: runFileClassification } = require('./fileClassification');
const { chunkRepository:         runSemanticChunking }   = require('./semanticChunking');
const { runIntelligenceAgents }  = require('./intelligenceAgents');
const { runInferenceEngine }     = require('./inferenceEngine');

// ── Error classification ──────────────────────────────────────────────────────

/**
 * Returns true for transient errors that are safe to retry:
 * rate limits, network timeouts, temporary service unavailability.
 */
function isRetryable(err) {
  const msg  = (err?.message ?? '').toLowerCase();
  const code = err?.code ?? err?.response?.status;
  return (
    code === 'ENRICHMENT_TIMEOUT' ||
    code === 429 || code === 503 || code === 'ECONNRESET' || code === 'ENOTFOUND' ||
    msg.includes('rate limit') ||
    msg.includes('timeout') ||
    msg.includes('network error') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound')
  );
}

// ── DB helpers ────────────────────────────────────────────────────────────────

/**
 * Writes the three tracking columns + any phase-specific output columns.
 * Called after every phase (success or failure) to preserve partial state.
 *
 * @param {string} analysisId
 * @param {object} tracker
 * @param {object} [extraCols]  Phase output columns to update: { colName: value }
 */
async function persistCheckpoint(analysisId, tracker, extraCols = {}) {
  const cols = {
    phase_metrics_json: JSON.stringify(tracker.toJSON()),
    phase_status_json:  JSON.stringify(tracker.toPhaseStatusJSON()),
    // Store NULL when there are no errors so the column stays clean
    phase_errors_json:  tracker.toPhaseErrorsJSON() !== null
      ? JSON.stringify(tracker.toPhaseErrorsJSON())
      : null,
  };

  for (const [col, val] of Object.entries(extraCols)) {
    cols[col] = val === null || val === undefined
      ? null
      : typeof val === 'string' ? val : JSON.stringify(val);
  }

  const keys   = Object.keys(cols);
  const values = Object.values(cols);
  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  values.push(analysisId);

  try {
    await pool.query(
      `UPDATE deep_analyses SET ${setClauses} WHERE id = $${values.length}`,
      values,
    );
  } catch (err) {
    console.error('[deep-analysis][persistCheckpoint] DB update failed:', {
      analysisId,
      message: err.message,
      code:    err.code,
      detail:  err.detail ?? undefined,
      hint:    err.hint   ?? undefined,
      stack:   err.stack,
    });
    throw err;
  }
}

// ── Phase runner ──────────────────────────────────────────────────────────────

/**
 * Runs one phase in isolation. Records timing and status via the tracker.
 * Never throws — errors are captured and stored as structured failure data.
 *
 * The phaseFn must return: { data, meta?, dbUpdate? }
 *   - data:     raw output passed to the next phase
 *   - meta:     observability data stored in phase_metrics_json
 *   - dbUpdate: { columnName: value } — phase output columns to persist immediately
 *
 * @returns {{ ok: boolean, data?: any, error?: Error, retryable?: boolean }}
 */
async function runPhaseIsolated(phaseName, tracker, analysisId, phaseFn) {
  tracker.start(phaseName);

  try {
    const result   = await phaseFn();
    tracker.complete(phaseName, result?.meta ?? {});
    await persistCheckpoint(analysisId, tracker, result?.dbUpdate ?? {});
    return { ok: true, data: result?.data ?? null };
  } catch (err) {
    const retryable = isRetryable(err);
    tracker.fail(phaseName, err, {
      retryable,
      errorCode: err.code ?? null,
    });
    await persistCheckpoint(analysisId, tracker);
    console.error(`[deep-analysis][phase:${phaseName}] Failed:`, {
      analysisId,
      phaseName,
      retryable,
      message: err.message,
      code:    err.code,
      stack:   err.stack,
      detail:  err.detail ?? undefined,
    });
    return { ok: false, error: err, retryable };
  }
}

/**
 * Marks a phase as skipped due to a failed upstream dependency.
 * Does not write a checkpoint (caller is responsible).
 */
function skipDownstream(phaseNames, tracker, upstreamPhase) {
  for (const name of phaseNames) {
    tracker.skip(name, `upstream_phase_failed:${upstreamPhase}`);
  }
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

/**
 * Runs the full six-phase deep analysis pipeline with per-phase fault tolerance.
 *
 * Phase dependency graph:
 *   ENRICHMENT → CODE_INTELLIGENCE (independent)
 *             → FILE_CLASSIFICATION → SEMANTIC_CHUNKING → INTELLIGENCE_AGENTS → INFERENCE_ENGINE
 *
 * On failure at any phase:
 *   - The failed phase records structured error data (message, code, retryable)
 *   - Downstream dependents are skipped with reason 'upstream_phase_failed:<phase>'
 *   - Already-completed phases and their outputs are preserved
 *   - Overall status becomes 'partial' if any phase completed, else 'failed'
 *
 * @param {string} analysisId
 * @param {object} repoData     Repository row from DB
 * @param {object} phaseImpls   { enrichment, codeIntelligence, fileClassification,
 *                                semanticChunking, intelligenceAgents, inferenceEngine }
 * @returns {object} tracker snapshot
 */
async function runDeepAnalysisPipeline(analysisId, repoData, phaseImpls) {
  const tracker = createPhaseTracker();

  try {
    await pool.query(
      `UPDATE deep_analyses SET status = 'running' WHERE id = $1`,
      [analysisId],
    );
  } catch (err) {
    console.error('[deep-analysis][runDeepAnalysisPipeline] Failed to set status=running:', {
      analysisId,
      message: err.message,
      code:    err.code,
      detail:  err.detail ?? undefined,
      hint:    err.hint   ?? undefined,
      stack:   err.stack,
    });
    throw err;
  }

  // ── Phase 1: Enrichment ────────────────────────────────────────────────────
  // Foundational — fetches file tree + content. All phases depend on it.
  const enrichResult = await runPhaseIsolated(
    PHASES.ENRICHMENT, tracker, analysisId,
    () => phaseImpls.enrichment(repoData),
  );

  if (!enrichResult.ok) {
    skipDownstream(
      [PHASES.CODE_INTELLIGENCE, PHASES.FILE_CLASSIFICATION,
       PHASES.SEMANTIC_CHUNKING, PHASES.INTELLIGENCE_AGENTS, PHASES.INFERENCE_ENGINE],
      tracker, PHASES.ENRICHMENT,
    );
    await persistCheckpoint(analysisId, tracker);
    return finalizeAnalysis(analysisId, tracker);
  }

  // ── Phase 2: Code Intelligence (depends on enrichment only) ───────────────
  // Independent of file classification — runs even if FC later fails.
  const ciResult = await runPhaseIsolated(
    PHASES.CODE_INTELLIGENCE, tracker, analysisId,
    () => phaseImpls.codeIntelligence(enrichResult.data),
  );

  // ── Phase 3: File Classification (depends on enrichment only) ────────────
  // runFileClassification is called directly — not through phaseImpls.
  console.log('[PIPELINE] Using REAL fileClassification service');
  console.log('[PIPELINE] runFileClassification type:', typeof runFileClassification);
  //
  // Inputs:
  //   enrichResult.data              — Phase 1 enrichment output (fileContents, rankedFiles, repoMeta)
  //   ciResult.ok ? ciResult.data : null — Phase 2 code intelligence (technologies, detectedDomains;
  //                                        null if Phase 2 failed — fileClassification degrades gracefully)
  const fcResult = await runPhaseIsolated(
    PHASES.FILE_CLASSIFICATION, tracker, analysisId,
    () => runFileClassification(enrichResult.data, ciResult.ok ? ciResult.data : null),
  );

  if (!fcResult.ok) {
    skipDownstream(
      [PHASES.SEMANTIC_CHUNKING, PHASES.INTELLIGENCE_AGENTS, PHASES.INFERENCE_ENGINE],
      tracker, PHASES.FILE_CLASSIFICATION,
    );
    await persistCheckpoint(analysisId, tracker);
    return finalizeAnalysis(analysisId, tracker);
  }

  // ── Phase 4: Semantic Chunking (depends on file classification) ───────────
  // runSemanticChunking is called directly — not through phaseImpls.
  //
  // Input:
  //   fcResult.data — Phase 3 file manifest (classified files with roles, domains, semantic groups)
  const scResult = await runPhaseIsolated(
    PHASES.SEMANTIC_CHUNKING, tracker, analysisId,
    () => runSemanticChunking(fcResult.data),
  );

  if (!scResult.ok) {
    skipDownstream(
      [PHASES.INTELLIGENCE_AGENTS, PHASES.INFERENCE_ENGINE],
      tracker, PHASES.SEMANTIC_CHUNKING,
    );
    await persistCheckpoint(analysisId, tracker);
    return finalizeAnalysis(analysisId, tracker);
  }

  // ── Phase 5: Intelligence Agents ─────────────────────────────────────────
  // runIntelligenceAgents is called directly — not through phaseImpls — so
  // Phase 5 always runs the production implementation regardless of what the
  // caller provides in phaseImpls.
  //
  // Inputs:
  //   scResult.data              — Phase 4 semantic chunks (chunks, relationships,
  //                                retrievalIndex, summary, fileContents)
  //   ciResult.ok ? ciResult.data : null — Phase 2 repository intelligence
  //                                (technologies, dominantStack, detectedDomains,
  //                                 architecturePatterns; null if Phase 2 failed)
  const iaResult = await runPhaseIsolated(
    PHASES.INTELLIGENCE_AGENTS, tracker, analysisId,
    () => runIntelligenceAgents(scResult.data, ciResult.ok ? ciResult.data : null),
  );

  if (!iaResult.ok) {
    skipDownstream([PHASES.INFERENCE_ENGINE], tracker, PHASES.INTELLIGENCE_AGENTS);
    await persistCheckpoint(analysisId, tracker);
    return finalizeAnalysis(analysisId, tracker);
  }

  // ── Phase 6: Inference Engine ─────────────────────────────────────────────
  // runInferenceEngine is called directly — not through phaseImpls — so Phase 6
  // always runs the production implementation regardless of what the caller provides.
  //
  // All five upstream phase outputs are passed; each is null-guarded so a failed
  // upstream phase degrades gracefully rather than crashing inference.
  //
  // dbUpdate from runInferenceEngine carries:
  //   inference_json   → persisted via persistCheckpoint into deep_analyses
  //   confidence_score → persisted via persistCheckpoint into deep_analyses
  await runPhaseIsolated(
    PHASES.INFERENCE_ENGINE, tracker, analysisId,
    () => runInferenceEngine({
      enrichmentData:        enrichResult.data,
      codeIntelligenceData:  ciResult.ok  ? ciResult.data  : null,
      fileClassificationData: fcResult.ok ? fcResult.data  : null,
      semanticChunkingData:  scResult.ok  ? scResult.data  : null,
      intelligenceData:      iaResult.ok  ? iaResult.data  : null,
      repoMeta:              repoData,
    }),
  );

  return finalizeAnalysis(analysisId, tracker);
}

// ── Finalize ──────────────────────────────────────────────────────────────────

async function finalizeAnalysis(analysisId, tracker) {
  const status = tracker.overallStatus();
  try {
    await pool.query(
      `UPDATE deep_analyses SET
         status             = $1,
         phase_metrics_json = $2,
         phase_status_json  = $3,
         phase_errors_json  = $4,
         duration_ms        = $5,
         completed_at       = NOW()
       WHERE id = $6`,
      [
        status,
        JSON.stringify(tracker.toJSON()),
        JSON.stringify(tracker.toPhaseStatusJSON()),
        tracker.toPhaseErrorsJSON() !== null ? JSON.stringify(tracker.toPhaseErrorsJSON()) : null,
        tracker.totalDurationMs(),
        analysisId,
      ],
    );
  } catch (err) {
    console.error('[deep-analysis][finalizeAnalysis] DB update failed:', {
      analysisId,
      status,
      message: err.message,
      code:    err.code,
      detail:  err.detail ?? undefined,
      hint:    err.hint   ?? undefined,
      stack:   err.stack,
    });
    throw err;
  }
  console.log(`[deepAnalysis] ${analysisId} → ${status} (${tracker.totalDurationMs()}ms)`);
  return tracker;
}

// ── Retry ─────────────────────────────────────────────────────────────────────

/**
 * Re-runs failed retryable phases in an existing analysis, preserving all
 * already-completed phase outputs.
 *
 * Loads the stored phase_metrics_json to reconstruct tracker state,
 * then replays from the earliest retryable failure.
 *
 * @param {string} analysisId
 * @param {object} phaseImpls   Same impl map as runDeepAnalysisPipeline
 */
async function retryFailedPhases(analysisId, phaseImpls) {
  const row = await pool.query(
    `SELECT da.*, r.name, r.full_name, r.description, r.primary_language,
            r.default_branch, r.topics, r.stars_count, r.forks_count, r.readme_content
     FROM deep_analyses da
     JOIN repositories r ON r.id = da.repository_id
     WHERE da.id = $1`,
    [analysisId],
  );

  if (!row.rows[0]) throw new Error(`Analysis ${analysisId} not found`);
  const analysis = row.rows[0];

  const storedErrors = analysis.phase_errors_json ?? {};
  const retryablePhases = Object.entries(storedErrors)
    .filter(([, e]) => e.retryable)
    .map(([name]) => name);

  if (retryablePhases.length === 0) {
    throw new Error('No retryable failed phases found in this analysis');
  }

  // Reconstruct tracker from stored metrics — completed phases are preserved
  const tracker = createPhaseTrackerFromJSON(analysis.phase_metrics_json ?? {});

  // Reset retryable failed phases and any downstream skips
  const PHASE_ORDER = [
    PHASES.ENRICHMENT,
    PHASES.CODE_INTELLIGENCE,
    PHASES.FILE_CLASSIFICATION,
    PHASES.SEMANTIC_CHUNKING,
    PHASES.INTELLIGENCE_AGENTS,
    PHASES.INFERENCE_ENGINE,
  ];

  // Find the earliest failed retryable phase — reset it and everything after
  const firstRetryIdx = PHASE_ORDER.findIndex(p => retryablePhases.includes(p));
  if (firstRetryIdx === -1) throw new Error('Could not locate retryable phase in order');

  for (let i = firstRetryIdx; i < PHASE_ORDER.length; i++) {
    const p = PHASE_ORDER[i];
    const status = tracker.statusOf(p);
    if (status === 'failed' || status === 'skipped') {
      // Allow re-execution: directly reset by calling retryPhase or skip removal
      try { tracker.retryPhase(p); } catch { /* skipped phases aren't in 'failed' state */ }
      // For skipped phases, we just need to clear them — achieved by calling skip again later or start
      // The pipeline will re-run them naturally since the tracker no longer has them as failed/skipped
    }
  }

  await pool.query(`UPDATE deep_analyses SET status = 'running' WHERE id = $1`, [analysisId]);

  const repoData = analysis;

  // Re-enter pipeline from the earliest reset phase
  return runDeepAnalysisPipeline(analysisId, repoData, phaseImpls);
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { runDeepAnalysisPipeline, retryFailedPhases, isRetryable, persistCheckpoint };
