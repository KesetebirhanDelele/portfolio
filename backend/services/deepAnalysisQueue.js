'use strict';

const pool                          = require('../db/postgres');
const { runDeepAnalysisPipeline }   = require('./deepAnalysisPipeline');
const { enrichRepository }          = require('./githubEnricher');
const { analyzeRepositoryIntelligence } = require('./codeIntelligence');

const CURRENT_ANALYSIS_VERSION = 'v2';
const CURRENT_PIPELINE_VERSION = '2.0';

// Phase implementations — mirrors deepAnalysis route; kept here as the shared source.
const PHASE_IMPLS = {
  enrichment: enrichRepository,

  async codeIntelligence(enrichmentData) {
    const filesAvailable = Object.keys(enrichmentData?.fileContents ?? {}).length;
    console.log('[deepAnalysisQueue][codeIntelligence] Starting —', {
      filesAvailable,
      complexity:   enrichmentData?.complexity?.complexity ?? 'unknown',
      repoFullName: enrichmentData?.repoMeta?.fullName    ?? 'unknown',
    });

    const result = analyzeRepositoryIntelligence(enrichmentData);

    const meta = {
      filesAnalyzed:        result.meta.filesAnalyzed,
      signalsExtracted:     result.meta.totalSignals,
      frameworksDetected:   result.data.frameworks.length,
      technologiesDetected: result.data.technologies.length,
      confidenceScore:      result.meta.confidenceScore,
    };

    console.log('[deepAnalysisQueue][codeIntelligence] Completed —', {
      dominantStack:   result.data.dominantStack,
      detectedDomains: result.data.detectedDomains,
      ...meta,
    });

    return { data: result.data, meta, dbUpdate: result.dbUpdate };
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

async function fetchRepo(repositoryId, userId) {
  const result = await pool.query(
    `SELECT id, name, full_name, description, primary_language, default_branch,
            topics, stars_count, forks_count, readme_content
     FROM repositories WHERE id = $1 AND user_id = $2`,
    [repositoryId, userId]
  );
  return result.rows[0] ?? null;
}

// Queue a deep analysis for one repository.
// Skips silently if one is already queued or running.
// Returns { analysisId, queued } or null if repo not found.
async function queueDeepAnalysis(repositoryId, userId) {
  const repoData = await fetchRepo(repositoryId, userId);
  if (!repoData) return null;

  const existing = await pool.query(
    `SELECT id, status FROM deep_analyses
     WHERE repository_id = $1 AND status IN ('queued', 'running')
     ORDER BY created_at DESC LIMIT 1`,
    [repositoryId]
  );

  if (existing.rows[0]) {
    return { analysisId: existing.rows[0].id, queued: false, status: existing.rows[0].status };
  }

  const inserted = await pool.query(
    `INSERT INTO deep_analyses
       (repository_id, status, pipeline_version, analysis_version, legacy, created_at)
     VALUES ($1, 'queued', $2, $3, false, NOW()) RETURNING id`,
    [repositoryId, CURRENT_PIPELINE_VERSION, CURRENT_ANALYSIS_VERSION]
  );

  const analysisId = inserted.rows[0].id;

  setImmediate(() =>
    runDeepAnalysisPipeline(analysisId, repoData, PHASE_IMPLS).catch(err =>
      console.error(`[deepAnalysisQueue] pipeline error for ${analysisId}:`, err.message)
    )
  );

  return { analysisId, queued: true, status: 'queued' };
}

module.exports = { queueDeepAnalysis, PHASE_IMPLS };
