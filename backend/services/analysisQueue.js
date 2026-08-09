'use strict';
const pool              = require('../db/postgres');
const { analyzeRepository } = require('./openai');

// Runs analysis jobs sequentially in the background after response is sent
async function processAnalyses(analysisIds) {
  for (const analysisId of analysisIds) {
    try {
      const result = await pool.query(
        `SELECT a.id, a.repository_id,
                r.name, r.description, r.primary_language, r.topics,
                r.stars_count, r.forks_count, r.readme_content
         FROM analyses a
         JOIN repositories r ON r.id = a.repository_id
         WHERE a.id = $1`,
        [analysisId]
      );

      const repo = result.rows[0];
      if (!repo) continue;

      await pool.query(
        `UPDATE analyses SET status = 'running' WHERE id = $1`,
        [analysisId]
      );

      const analysis = await analyzeRepository(repo);

      const technologies    = analysis.technologies     || [];
      const keyTakeaways    = analysis.key_takeaways    || [];
      const summary         = analysis.summary          || '';
      const whatItDoes      = analysis.what_it_does     || '';
      const highlights      = analysis.highlights       || {};
      const confidenceLabel = analysis.confidence_label || 'Medium';
      const confidence      = parseFloat(analysis.overall_confidence) || 0;

      const summaryJson = {
        text:             summary,
        key_takeaways:    keyTakeaways,
        what_it_does:     whatItDoes,
        highlights,
        confidence_label: confidenceLabel,
      };

      await pool.query(
        `UPDATE analyses SET
           status           = 'completed',
           model_version    = 'gpt-4o-mini',
           confidence_score = $1,
           skills_json      = $2,
           domains_json     = $3,
           summary_json     = $4,
           completed_at     = NOW()
         WHERE id = $5`,
        [
          confidence,
          JSON.stringify(technologies),
          JSON.stringify([]),
          JSON.stringify(summaryJson),
          analysisId,
        ]
      );

      for (const tech of technologies) {
        await pool.query(
          `INSERT INTO evidence_refs (analysis_id, claim_type, claim_key, source_path, confidence, created_at)
           VALUES ($1, 'skill', $2, $3, $4, NOW())`,
          [analysisId, tech.name, tech.evidence || 'Repository metadata', tech.confidence]
        );
      }

      console.log(`[analysisQueue] completed ${analysisId} — ${technologies.length} technologies found`);
    } catch (err) {
      console.error(`[analysisQueue] failed ${analysisId}:`, err.message);
      await pool.query(
        `UPDATE analyses SET status = 'failed', completed_at = NOW() WHERE id = $1`,
        [analysisId]
      );
    }
  }
}

// Queue analysis for a single repository. Skips if already queued/running/completed.
async function queueAnalysis(repositoryId) {
  const existing = await pool.query(
    `SELECT id, status FROM analyses
     WHERE repository_id = $1 AND status IN ('queued', 'running', 'completed')
     ORDER BY created_at DESC LIMIT 1`,
    [repositoryId]
  );

  if (existing.rows[0]) {
    return { analysisId: existing.rows[0].id, queued: false, status: existing.rows[0].status };
  }

  const inserted = await pool.query(
    `INSERT INTO analyses (repository_id, status, created_at)
     VALUES ($1, 'queued', NOW()) RETURNING id`,
    [repositoryId]
  );

  const analysisId = inserted.rows[0].id;
  setImmediate(() => processAnalyses([analysisId]));
  return { analysisId, queued: true, status: 'queued' };
}

module.exports = { processAnalyses, queueAnalysis };
