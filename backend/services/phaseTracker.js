'use strict';

// ── Phase name constants ──────────────────────────────────────────────────────
// Single source of truth — import these rather than spelling phase names inline.

const PHASES = {
  ENRICHMENT:           'enrichment',
  CODE_INTELLIGENCE:    'codeIntelligence',
  FILE_CLASSIFICATION:  'fileClassification',
  SEMANTIC_CHUNKING:    'semanticChunking',
  INTELLIGENCE_AGENTS:  'intelligenceAgents',
  INFERENCE_ENGINE:     'inferenceEngine',
};

// ── Expected meta shape per phase (for documentation / IDE hints) ─────────────
//
// enrichment          → { filesInTree, filesScanned, filesSkipped, payloadBytes,
//                         timedOut, skipReasons: { reason: count } }
//
// codeIntelligence    → { filesAnalyzed, signalsExtracted, frameworksDetected,
//                         technologiesDetected, confidenceScore }
//
// fileClassification  → { filesClassified, domainsDetected,
//                         domainBreakdown: { domain: count } }
//
// semanticChunking    → { chunksCreated, chunkNames: [string] }
//
// intelligenceAgents  → { agentsRun, totalTokensUsed,
//                         agentResults: { name: { status, durationMs, tokensUsed } } }
//
// inferenceEngine     → { patternsInferred, tokensUsed, confidence }

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates a phase metrics tracker for one deep analysis pipeline run.
 *
 * Typical usage inside each phase:
 *
 *   tracker.start(PHASES.ENRICHMENT);
 *   try {
 *     const result = await doEnrichment();
 *     tracker.complete(PHASES.ENRICHMENT, { filesScanned: result.files.length });
 *   } catch (err) {
 *     tracker.fail(PHASES.ENRICHMENT, err, { filesScanned: 0 });
 *   }
 *
 * At checkpoints, persist all three tracking columns at once:
 *   await pool.query(
 *     `UPDATE deep_analyses
 *        SET phase_metrics_json = $1, phase_status_json = $2, phase_errors_json = $3
 *      WHERE id = $4`,
 *     [
 *       JSON.stringify(tracker.toJSON()),
 *       JSON.stringify(tracker.toPhaseStatusJSON()),
 *       JSON.stringify(tracker.toPhaseErrorsJSON()),
 *       analysisId,
 *     ]
 *   );
 *
 * @param {object} [initialState]  Restore a prior run's phase records (for retry).
 */
function createPhaseTracker(initialState = {}) {
  // Internal state: phaseName → PhaseRecord
  const phases = { ...initialState };

  /**
   * Mark a phase as started. Records startedAt timestamp.
   * Must be called before complete() or fail() for this phase.
   */
  function start(phaseName) {
    phases[phaseName] = {
      status:      'running',
      startedAt:   new Date().toISOString(),
      completedAt: null,
      durationMs:  null,
      meta:        {},
    };
  }

  /**
   * Mark a phase as successfully completed.
   * @param {string} phaseName
   * @param {object} meta  — phase-specific observability data (see shape above)
   */
  function complete(phaseName, meta = {}) {
    const phase = _requireStarted(phaseName);
    const now = new Date();
    phase.status      = 'completed';
    phase.completedAt = now.toISOString();
    phase.durationMs  = now - new Date(phase.startedAt);
    phase.meta        = meta;
  }

  /**
   * Mark a phase as failed. Records the error message and any partial meta.
   * @param {string} phaseName
   * @param {Error|string} error
   * @param {object} meta  — partial observability data collected before the failure
   */
  function fail(phaseName, error, meta = {}) {
    const now = new Date();
    const errorMessage = error?.message ?? String(error);

    if (!phases[phaseName]) {
      // Failed before start() was called — record as a cold failure
      phases[phaseName] = {
        status:      'failed',
        startedAt:   null,
        completedAt: now.toISOString(),
        durationMs:  null,
        meta:        { ...meta, error: errorMessage },
      };
      return;
    }

    const phase = phases[phaseName];
    phase.status      = 'failed';
    phase.completedAt = now.toISOString();
    phase.durationMs  = now - new Date(phase.startedAt);
    phase.meta        = { ...meta, error: errorMessage };
  }

  /**
   * Mark a phase as deliberately skipped (e.g. no files to classify).
   * Does not require a prior start() call.
   * @param {string} phaseName
   * @param {string} reason  — human-readable explanation
   */
  function skip(phaseName, reason = 'skipped') {
    phases[phaseName] = {
      status:      'skipped',
      startedAt:   null,
      completedAt: new Date().toISOString(),
      durationMs:  0,
      meta:        { reason },
    };
  }

  /**
   * Returns the current snapshot of all phase records.
   * Suitable for storing directly in phase_metrics_json.
   */
  function toJSON() {
    return { ...phases };
  }

  /**
   * Sum of durationMs across all completed/failed phases.
   * Useful for logging total pipeline wall time.
   */
  function totalDurationMs() {
    return Object.values(phases).reduce((sum, p) => sum + (p.durationMs ?? 0), 0);
  }

  /**
   * Returns the status of a specific phase, or null if not started.
   */
  function statusOf(phaseName) {
    return phases[phaseName]?.status ?? null;
  }

  /**
   * Returns true if every supplied phase name completed successfully.
   * Used by the orchestrator to gate later phases on earlier ones.
   */
  function allCompleted(...phaseNames) {
    return phaseNames.every(name => phases[name]?.status === 'completed');
  }

  /**
   * Returns a flat map of phaseName → status.
   * Stored in phase_status_json for quick frontend polling without parsing full metrics.
   */
  function toPhaseStatusJSON() {
    return Object.fromEntries(Object.entries(phases).map(([k, v]) => [k, v.status]));
  }

  /**
   * Returns structured error data for every failed phase, or null if no failures.
   * Stored in phase_errors_json. Shape per phase:
   *   { message, code, retryable, occurredAt }
   */
  function toPhaseErrorsJSON() {
    const errors = {};
    for (const [name, phase] of Object.entries(phases)) {
      if (phase.status === 'failed') {
        errors[name] = {
          message:    phase.meta?.error     ?? 'Unknown error',
          code:       phase.meta?.errorCode ?? null,
          retryable:  phase.meta?.retryable ?? false,
          occurredAt: phase.completedAt,
        };
      }
    }
    return Object.keys(errors).length > 0 ? errors : null;
  }

  /**
   * Derives the overall pipeline status from the current phase set.
   * Returns 'running' | 'completed' | 'partial' | 'failed'.
   * - partial: at least one completed AND at least one failed
   * - failed:  no phases completed (all failed or skipped)
   */
  function overallStatus() {
    const statuses = Object.values(phases).map(p => p.status);
    if (statuses.length === 0 || statuses.some(s => s === 'running')) return 'running';
    const hasCompleted = statuses.some(s => s === 'completed');
    const hasFailed    = statuses.some(s => s === 'failed');
    if (hasCompleted && hasFailed) return 'partial';
    if (hasCompleted)              return 'completed';
    return 'failed';
  }

  /**
   * Resets a failed phase so it can be re-executed.
   * Throws if the phase is not currently in 'failed' state.
   */
  function retryPhase(phaseName) {
    if (phases[phaseName]?.status !== 'failed') {
      throw new Error(`phaseTracker: cannot retry '${phaseName}' — current status: ${phases[phaseName]?.status ?? 'not started'}`);
    }
    delete phases[phaseName];
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  function _requireStarted(phaseName) {
    if (!phases[phaseName]) {
      throw new Error(`phaseTracker: phase '${phaseName}' must be started before completing`);
    }
    return phases[phaseName];
  }

  return {
    start, complete, fail, skip,
    toJSON, totalDurationMs, statusOf, allCompleted,
    toPhaseStatusJSON, toPhaseErrorsJSON, overallStatus, retryPhase,
  };
}

/**
 * Restores a tracker from a previously persisted phase_metrics_json blob.
 * Used by the retry path to rebuild tracker state without re-running completed phases.
 *
 * @param {object} phaseMetricsJSON  — the stored phase_metrics_json value (already parsed)
 */
function createPhaseTrackerFromJSON(phaseMetricsJSON) {
  return createPhaseTracker(phaseMetricsJSON ?? {});
}

module.exports = { createPhaseTracker, createPhaseTrackerFromJSON, PHASES };
