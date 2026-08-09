'use strict';

const express = require('express');
const pool = require('../db/postgres');
const authMiddleware = require('../middleware/authMiddleware');
const { runDeepAnalysisPipeline, retryFailedPhases } = require('../services/deepAnalysisPipeline');
const { enrichRepository } = require('../services/githubEnricher');
const { analyzeRepositoryIntelligence } = require('../services/codeIntelligence');

const router = express.Router();

// ── Constants ────────────────────────────────────────────────────────────────

const CURRENT_ANALYSIS_VERSION = 'v2';
const CURRENT_PIPELINE_VERSION = '2.0';

// Infrastructure is wired; selective execution is not yet implemented.
// Storing the mode now so the schema is ready when selective execution lands.
const VALID_REANALYZE_MODES = new Set([
  'full',
  'enrichment_only',
  'code_intelligence_only',
  'ai_only',
]);

// ── Phase implementations ────────────────────────────────────────────────────
// Each must return { data, meta?, dbUpdate? } or throw on failure.

const PHASE_IMPLS = {
  enrichment: enrichRepository,

  // ── Phase 2: Code Intelligence ────────────────────────────────────────────
  // Deterministic — no AI calls, no embeddings, no network I/O.
  // Reads fileContents from the enrichment output and returns structured
  // technology / domain signals ready for downstream phases and the DB.
  //
  // Input:  enrichResult.data  (github_enrichment_json)
  //         { fileContents, rankedFiles, repoMeta, complexity, summary }
  //
  // Output: { data: intelligence, meta, dbUpdate: { code_intelligence_json } }
  async codeIntelligence(enrichmentData) {
    const filesAvailable = Object.keys(enrichmentData?.fileContents ?? {}).length;
    console.log('[deep-analysis][codeIntelligence] Starting —', {
      filesAvailable,
      complexity: enrichmentData?.complexity?.complexity ?? 'unknown',
      repoFullName: enrichmentData?.repoMeta?.fullName ?? 'unknown',
    });

    // analyzeRepositoryIntelligence is internally fault-tolerant.
    // It never throws — bad files are isolated and counted in meta.filesSkipped.
    const result = analyzeRepositoryIntelligence(enrichmentData);

    // Conform meta to the codeIntelligence phase tracking schema.
    // phase_metrics_json.codeIntelligence will store exactly these fields.
    const meta = {
      filesAnalyzed:        result.meta.filesAnalyzed,
      signalsExtracted:     result.meta.totalSignals,
      frameworksDetected:   result.data.frameworks.length,
      technologiesDetected: result.data.technologies.length,
      confidenceScore:      result.meta.confidenceScore,
    };

    console.log('[deep-analysis][codeIntelligence] Completed —', {
      dominantStack:    result.data.dominantStack,
      detectedDomains:  result.data.detectedDomains,
      ...meta,
    });

    return {
      data:     result.data,           // passed to Phase 5 (intelligenceAgents) as ciResult.data
      meta,                            // stored in phase_metrics_json.codeIntelligence
      dbUpdate: result.dbUpdate,       // { code_intelligence_json: <intelligence object> }
    };
  },
  async fileClassification() {
    throw Object.assign(new Error('File classification phase not yet implemented'), { code: 'NOT_IMPLEMENTED' });
  },
  async semanticChunking() {
    throw Object.assign(new Error('Semantic chunking phase not yet implemented'), { code: 'NOT_IMPLEMENTED' });
  },
  async intelligenceAgents() {
    throw Object.assign(new Error('Intelligence agents phase not yet implemented'), { code: 'NOT_IMPLEMENTED' });
  },
  async inferenceEngine() {
    throw Object.assign(new Error('Inference engine phase not yet implemented'), { code: 'NOT_IMPLEMENTED' });
  },
};

// ── Repo query helper ─────────────────────────────────────────────────────────

async function fetchRepoForUser(repositoryId, userId) {
  const result = await pool.query(
    `SELECT id, name, full_name, description, primary_language, default_branch,
            topics, stars_count, forks_count, readme_content
     FROM repositories WHERE id = $1 AND user_id = $2`,
    [repositoryId, userId],
  );
  return result.rows[0] ?? null;
}

// ── POST /api/deep-analysis/run ───────────────────────────────────────────────
// Queue an analysis for a repository. Returns immediately; runs in background.
// Deduplicates against any in-progress (queued/running) analyses.

router.post('/run', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { repositoryId } = req.body;

  if (!repositoryId) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'repositoryId is required.' },
    });
  }

  try {
    const repoData = await fetchRepoForUser(repositoryId, userId);
    if (!repoData) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Repository not found.' },
      });
    }

    // Resume orphaned queued row (server may have restarted mid-queue)
    const existing = await pool.query(
      `SELECT id, status, analysis_version, legacy
       FROM deep_analyses
       WHERE repository_id = $1 AND status IN ('queued','running')
       ORDER BY created_at DESC LIMIT 1`,
      [repositoryId],
    );

    if (existing.rows[0]) {
      const e = existing.rows[0];
      // If it's queued but no process is running it (server restart), re-kick pipeline
      if (e.status === 'queued') {
        setImmediate(() =>
          runDeepAnalysisPipeline(e.id, repoData, PHASE_IMPLS).catch(err =>
            console.error(`[deepAnalysis] resume pipeline error for ${e.id}:`, err.message),
          ),
        );
      }
      return res.status(200).json({
        success: true,
        data: {
          analysisId:      e.id,
          status:          e.status,
          analysisVersion: e.analysis_version,
          legacy:          e.legacy,
          repositoryId,
        },
      });
    }

    const inserted = await pool.query(
      `INSERT INTO deep_analyses
         (repository_id, status, pipeline_version, analysis_version, legacy, created_at)
       VALUES ($1, 'queued', $2, $3, false, NOW()) RETURNING id`,
      [repositoryId, CURRENT_PIPELINE_VERSION, CURRENT_ANALYSIS_VERSION],
    );

    const analysisId = inserted.rows[0].id;

    setImmediate(() =>
      runDeepAnalysisPipeline(analysisId, repoData, PHASE_IMPLS).catch(err =>
        console.error(`[deepAnalysis] unhandled pipeline error for ${analysisId}:`, err.message),
      ),
    );

    return res.status(202).json({
      success: true,
      data: {
        analysisId,
        status:          'queued',
        analysisVersion: CURRENT_ANALYSIS_VERSION,
        legacy:          false,
        repositoryId,
      },
    });
  } catch (err) {
    console.error('[deepAnalysis] run error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to start analysis.' } });
  }
});

// ── POST /api/deep-analysis/cancel-pending ───────────────────────────────────
// Mark all queued/running deep analyses for the current user as cancelled.
router.post('/cancel-pending', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  try {
    const result = await pool.query(
      `UPDATE deep_analyses SET status = 'cancelled', completed_at = NOW()
       WHERE status IN ('queued', 'running')
       AND repository_id IN (SELECT id FROM repositories WHERE user_id = $1)
       RETURNING id`,
      [userId]
    );
    return res.json({ success: true, data: { cancelled: result.rows.length } });
  } catch (err) {
    console.error('[deepAnalysis] cancel-pending error:', err.message);
    return res.status(500).json({ success: false });
  }
});

// ── POST /api/deep-analysis/:repoId/reanalyze ────────────────────────────────
// Triggers a fresh analysis run for a repository.
// ALWAYS creates a new deep_analyses record — never overwrites history.
//
// Body (optional):
//   reanalyzeMode: 'full' | 'enrichment_only' | 'code_intelligence_only' | 'ai_only'
//
// Note: selective execution is not yet implemented. All modes run the full
// pipeline. The mode is stored in analysis_metadata_json for future use.

router.post('/:repoId/reanalyze', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { repoId }     = req.params;
  const { reanalyzeMode = 'full' } = req.body;

  if (!VALID_REANALYZE_MODES.has(reanalyzeMode)) {
    return res.status(400).json({
      success: false,
      error: {
        code:    'INVALID_MODE',
        message: `reanalyzeMode must be one of: ${[...VALID_REANALYZE_MODES].join(', ')}.`,
      },
    });
  }

  let analysisId = null;

  try {
    const repoData = await fetchRepoForUser(repoId, userId);
    if (!repoData) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Repository not found.' },
      });
    }

    // Block reanalysis if one is already in flight — prevents duplicate runs
    const inFlight = await pool.query(
      `SELECT id, status FROM deep_analyses
       WHERE repository_id = $1 AND status IN ('queued','running')
       ORDER BY created_at DESC LIMIT 1`,
      [repoId],
    );

    if (inFlight.rows[0]) {
      return res.status(409).json({
        success: false,
        error: {
          code:       'ANALYSIS_IN_PROGRESS',
          message:    'An analysis is already running for this repository.',
          analysisId: inFlight.rows[0].id,
        },
      });
    }

    // Record a pointer to the analysis this run is superseding (immutable history)
    const prev = await pool.query(
      `SELECT id, analysis_version FROM deep_analyses
       WHERE repository_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [repoId],
    );

    const previousAnalysisId = prev.rows[0]?.id ?? null;

    const metadata = {
      reanalyzeMode,
      triggeredBy:        'user',
      previousAnalysisId,
    };

    const inserted = await pool.query(
      `INSERT INTO deep_analyses
         (repository_id, status, pipeline_version, analysis_version, legacy,
          analysis_metadata_json, created_at)
       VALUES ($1, 'queued', $2, $3, false, $4, NOW()) RETURNING id`,
      [repoId, CURRENT_PIPELINE_VERSION, CURRENT_ANALYSIS_VERSION, JSON.stringify(metadata)],
    );

    analysisId = inserted.rows[0].id;

    setImmediate(() =>
      runDeepAnalysisPipeline(analysisId, repoData, PHASE_IMPLS).catch(err =>
        console.error('[deep-analysis][pipeline] Unhandled pipeline error:', {
          repoId,
          analysisId,
          message: err.message,
          code:    err.code,
          stack:   err.stack,
        }),
      ),
    );

    console.log(`[deepAnalysis] reanalyze queued — repo=${repoId} analysis=${analysisId} mode=${reanalyzeMode} prev=${previousAnalysisId}`);

    return res.status(202).json({
      success: true,
      data: {
        analysisId,
        repositoryId:       repoId,
        status:             'queued',
        analysisVersion:    CURRENT_ANALYSIS_VERSION,
        legacy:             false,
        reanalyzeMode,
        previousAnalysisId,
      },
    });
  } catch (err) {
    console.error('[deep-analysis][reanalyze] Failed:', {
      repoId,
      analysisId,
      message: err.message,
      code:    err.code,
      stack:   err.stack,
      detail:  err.detail ?? undefined,
      hint:    err.hint   ?? undefined,
    });
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to start reanalysis.' } });
  }
});

// ── GET /api/deep-analysis/:repoId/history ───────────────────────────────────
// Returns all analyses for a repository, newest first.
//
// Query params:
//   version  — filter by analysis_version (e.g. ?version=v2)
//   page     — page number (default 1)
//   limit    — results per page (default 20, max 50)
//
// Excludes intelligence_json (bulk data) — use GET /:analysisId for full output.

router.get('/:repoId/history', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { repoId }     = req.params;
  const version        = req.query.version ?? null;
  const page           = Math.max(1, parseInt(req.query.page)  || 1);
  const limit          = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset         = (page - 1) * limit;

  try {
    // Verify ownership without exposing analyses for repos the user doesn't own
    const repoCheck = await pool.query(
      `SELECT id, name, full_name FROM repositories WHERE id = $1 AND user_id = $2`,
      [repoId, userId],
    );

    if (!repoCheck.rows[0]) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Repository not found.' },
      });
    }

    // Build query — version filter is optional
    const baseParams = [repoId];
    const versionClause = version
      ? ` AND analysis_version = $${baseParams.push(version)}`
      : '';

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT id, status, analysis_version, legacy, pipeline_version,
                phase_status_json, confidence_score, duration_ms,
                analysis_metadata_json, created_at, completed_at
         FROM deep_analyses
         WHERE repository_id = $1${versionClause}
         ORDER BY created_at DESC
         LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`,
        [...baseParams, limit, offset],
      ),
      pool.query(
        `SELECT COUNT(*) FROM deep_analyses WHERE repository_id = $1${versionClause}`,
        baseParams,
      ),
    ]);

    const analyses = rows.rows.map(a => ({
      analysisId:         a.id,
      status:             a.status,
      analysisVersion:    a.analysis_version,
      legacy:             a.legacy,
      pipelineVersion:    a.pipeline_version,
      phaseStatus:        a.phase_status_json,
      confidenceScore:    a.confidence_score,
      durationMs:         a.duration_ms,
      reanalyzeMode:      a.analysis_metadata_json?.reanalyzeMode ?? 'full',
      previousAnalysisId: a.analysis_metadata_json?.previousAnalysisId ?? null,
      createdAt:          a.created_at,
      completedAt:        a.completed_at,
    }));

    return res.status(200).json({
      success: true,
      data: {
        repositoryId: repoId,
        repoName:     repoCheck.rows[0].name,
        repoFullName: repoCheck.rows[0].full_name,
        analyses,
        meta: {
          page,
          limit,
          total:      parseInt(countRow.rows[0].count),
          version:    version ?? 'all',
        },
      },
    });
  } catch (err) {
    console.error('[deepAnalysis] history error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch analysis history.' } });
  }
});

// ── GET /api/deep-analysis/:repoId/latest ────────────────────────────────────
// Returns the most recent analysis for a repository (full output).
//
// Query params:
//   version — restrict to a specific analysis version (e.g. ?version=v2)

router.get('/:repoId/latest', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { repoId }     = req.params;
  const version        = req.query.version ?? null;

  try {
    const repoCheck = await pool.query(
      `SELECT id, name, full_name FROM repositories WHERE id = $1 AND user_id = $2`,
      [repoId, userId],
    );

    if (!repoCheck.rows[0]) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Repository not found.' },
      });
    }

    const params = [repoId];
    const versionClause = version
      ? ` AND da.analysis_version = $${params.push(version)}`
      : '';

    const result = await pool.query(
      `SELECT da.id, da.status, da.analysis_version, da.legacy, da.pipeline_version,
              da.phase_status_json, da.phase_errors_json, da.phase_metrics_json,
              da.intelligence_json, da.inference_json, da.code_intelligence_json,
              da.confidence_score, da.tokens_used, da.duration_ms,
              da.analysis_metadata_json, da.created_at, da.completed_at
       FROM deep_analyses da
       WHERE da.repository_id = $1${versionClause}
       ORDER BY da.created_at DESC
       LIMIT 1`,
      params,
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        success: false,
        error: {
          code:    'NOT_FOUND',
          message: version
            ? `No ${version} analysis found for this repository.`
            : 'No analysis found for this repository.',
        },
      });
    }

    const a = result.rows[0];

    const phaseErrors     = a.phase_errors_json ?? {};
    const retryablePhases = Object.entries(phaseErrors)
      .filter(([, e]) => e.retryable)
      .map(([name]) => name);

    return res.status(200).json({
      success: true,
      data: {
        analysisId:         a.id,
        repositoryId:       repoId,
        repoName:           repoCheck.rows[0].name,
        repoFullName:       repoCheck.rows[0].full_name,
        status:             a.status,
        analysisVersion:    a.analysis_version,
        legacy:             a.legacy,
        pipelineVersion:    a.pipeline_version,
        phaseStatus:        a.phase_status_json,
        phaseErrors:        a.phase_errors_json,
        phaseMetrics:       a.phase_metrics_json,
        retryablePhases,
        intelligence:       a.intelligence_json,
        inference:          a.inference_json,
        codeIntelligence:   a.code_intelligence_json,
        confidenceScore:    a.confidence_score,
        tokensUsed:         a.tokens_used,
        durationMs:         a.duration_ms,
        reanalyzeMode:      a.analysis_metadata_json?.reanalyzeMode ?? 'full',
        previousAnalysisId: a.analysis_metadata_json?.previousAnalysisId ?? null,
        createdAt:          a.created_at,
        completedAt:        a.completed_at,
      },
    });
  } catch (err) {
    console.error('[deepAnalysis] latest error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch latest analysis.' } });
  }
});

// ── GET /api/deep-analysis/:analysisId ───────────────────────────────────────
// Poll status and retrieve partial or complete results for one analysis.

router.get('/:analysisId', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { analysisId } = req.params;

  try {
    const result = await pool.query(
      `SELECT da.id, da.status, da.analysis_version, da.legacy, da.pipeline_version,
              da.phase_status_json, da.phase_errors_json, da.phase_metrics_json,
              da.intelligence_json, da.inference_json, da.code_intelligence_json,
              da.confidence_score, da.tokens_used, da.duration_ms,
              da.analysis_metadata_json, da.created_at, da.completed_at,
              r.id AS repository_id, r.name AS repo_name, r.full_name AS repo_full_name
       FROM deep_analyses da
       JOIN repositories r ON r.id = da.repository_id
       WHERE da.id = $1 AND r.user_id = $2`,
      [analysisId, userId],
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Analysis not found.' },
      });
    }

    const a = result.rows[0];

    const phaseErrors     = a.phase_errors_json ?? {};
    const retryablePhases = Object.entries(phaseErrors)
      .filter(([, e]) => e.retryable)
      .map(([name]) => name);

    return res.status(200).json({
      success: true,
      data: {
        analysisId:         a.id,
        repositoryId:       a.repository_id,
        repoName:           a.repo_name,
        repoFullName:       a.repo_full_name,
        status:             a.status,
        analysisVersion:    a.analysis_version,
        legacy:             a.legacy,
        pipelineVersion:    a.pipeline_version,
        phaseStatus:        a.phase_status_json,
        phaseErrors:        a.phase_errors_json,
        phaseMetrics:       a.phase_metrics_json,
        retryablePhases,
        intelligence:       a.intelligence_json,
        inference:          a.inference_json,
        codeIntelligence:   a.code_intelligence_json,
        confidenceScore:    a.confidence_score,
        tokensUsed:         a.tokens_used,
        durationMs:         a.duration_ms,
        reanalyzeMode:      a.analysis_metadata_json?.reanalyzeMode ?? 'full',
        previousAnalysisId: a.analysis_metadata_json?.previousAnalysisId ?? null,
        createdAt:          a.created_at,
        completedAt:        a.completed_at,
      },
    });
  } catch (err) {
    console.error('[deepAnalysis] get error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch analysis.' } });
  }
});

// ── POST /api/deep-analysis/:analysisId/retry ─────────────────────────────────
// Re-run failed retryable phases in-place, preserving all completed phase outputs.

router.post('/:analysisId/retry', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { analysisId } = req.params;

  try {
    const ownerCheck = await pool.query(
      `SELECT da.id, da.status, da.phase_errors_json
       FROM deep_analyses da
       JOIN repositories r ON r.id = da.repository_id
       WHERE da.id = $1 AND r.user_id = $2`,
      [analysisId, userId],
    );

    if (!ownerCheck.rows[0]) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Analysis not found.' },
      });
    }

    const { status, phase_errors_json: phaseErrors } = ownerCheck.rows[0];

    if (status === 'running' || status === 'queued') {
      return res.status(409).json({
        success: false,
        error: { code: 'ALREADY_RUNNING', message: 'Analysis is already in progress.' },
      });
    }

    const retryablePhases = Object.entries(phaseErrors ?? {})
      .filter(([, e]) => e.retryable)
      .map(([name]) => name);

    if (retryablePhases.length === 0) {
      return res.status(422).json({
        success: false,
        error: { code: 'NO_RETRYABLE_PHASES', message: 'No retryable failed phases found.' },
      });
    }

    setImmediate(() =>
      retryFailedPhases(analysisId, PHASE_IMPLS).catch(err =>
        console.error(`[deepAnalysis] retry error for ${analysisId}:`, err.message),
      ),
    );

    return res.status(202).json({
      success: true,
      data: { analysisId, status: 'running', retryingPhases: retryablePhases },
    });
  } catch (err) {
    console.error('[deepAnalysis] retry error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retry analysis.' } });
  }
});

module.exports = router;
