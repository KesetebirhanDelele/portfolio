const express = require('express');
const pool = require('../db/postgres');
const authMiddleware = require('../middleware/authMiddleware');
const { processAnalyses, queueAnalysis } = require('../services/analysisQueue');

const router = express.Router();

// POST /api/analysis/run — queue analysis for selected repos
router.post('/run', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { repositoryIds } = req.body;

  if (!Array.isArray(repositoryIds) || repositoryIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'repositoryIds must be a non-empty array.' },
    });
  }

  try {
    // Verify all repos belong to this user
    const repoCheck = await pool.query(
      `SELECT id FROM repositories WHERE id = ANY($1::uuid[]) AND user_id = $2`,
      [repositoryIds, userId]
    );

    if (repoCheck.rows.length !== repositoryIds.length) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'One or more repositories not found or not owned by you.' },
      });
    }

    const analyses = [];

    for (const repositoryId of repositoryIds) {
      const result = await queueAnalysis(repositoryId);
      analyses.push({ analysisId: result.analysisId, repositoryId, status: result.status });
    }

    return res.status(202).json({ success: true, data: { analyses } });
  } catch (err) {
    console.error('[analysis] run error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to start analysis.' } });
  }
});

// GET /api/analysis/repo/:repositoryId — latest analysis for a repo
router.get('/repo/:repositoryId', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { repositoryId } = req.params;

  try {
    const result = await pool.query(
      `SELECT a.id, a.status, a.confidence_score, a.skills_json,
              a.domains_json, a.summary_json, a.model_version,
              a.created_at, a.completed_at
       FROM analyses a
       JOIN repositories r ON r.id = a.repository_id
       WHERE a.repository_id = $1 AND r.user_id = $2
       ORDER BY a.created_at DESC LIMIT 1`,
      [repositoryId, userId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No analysis found for this repository.' },
      });
    }

    const a = result.rows[0];
    return res.status(200).json({
      success: true,
      data: {
        analysisId:      a.id,
        status:          a.status,
        confidenceScore: a.confidence_score,
        technologies:    a.skills_json,
        summary:         a.summary_json?.text,
        keyTakeaways:    a.summary_json?.key_takeaways,
        whatItDoes:      a.summary_json?.what_it_does,
        highlights:      a.summary_json?.highlights,
        confidenceLabel: a.summary_json?.confidence_label,
        modelVersion:    a.model_version,
        createdAt:       a.created_at,
        completedAt:     a.completed_at,
      },
    });
  } catch (err) {
    console.error('[analysis] repo get error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch analysis.' } });
  }
});

// GET /api/analysis/:analysisId — poll status + results for one analysis
router.get('/:analysisId', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { analysisId } = req.params;

  try {
    const result = await pool.query(
      `SELECT a.id, a.status, a.confidence_score, a.skills_json,
              a.domains_json, a.summary_json, a.model_version,
              a.created_at, a.completed_at,
              r.name AS repo_name, r.id AS repository_id
       FROM analyses a
       JOIN repositories r ON r.id = a.repository_id
       WHERE a.id = $1 AND r.user_id = $2`,
      [analysisId, userId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Analysis not found.' },
      });
    }

    const a = result.rows[0];
    return res.status(200).json({
      success: true,
      data: {
        analysisId:      a.id,
        repositoryId:    a.repository_id,
        repoName:        a.repo_name,
        status:          a.status,
        confidenceScore: a.confidence_score,
        technologies:    a.skills_json,
        summary:         a.summary_json?.text,
        keyTakeaways:    a.summary_json?.key_takeaways,
        whatItDoes:      a.summary_json?.what_it_does,
        highlights:      a.summary_json?.highlights,
        confidenceLabel: a.summary_json?.confidence_label,
        modelVersion:    a.model_version,
        createdAt:       a.created_at,
        completedAt:     a.completed_at,
      },
    });
  } catch (err) {
    console.error('[analysis] get error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch analysis.' } });
  }
});

module.exports = router;
