const crypto = require('crypto');
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const pool = require('../db/postgres');
const sessionManager = require('../services/colaberryLiveLoginSessionManager');
const { getColaberryUserByEmail, getProjectLinksForUser } = require('../services/colaberrySqlClient');
const { scrapeColaberryProjects } = require('../services/colaberryProjectScraper');
const { queueAnalysis } = require('../services/analysisQueue');

const router = express.Router();

// Stable id derived from the project URL so re-running import upserts
// instead of duplicating (idempotency, per CLAUDE.md's non-negotiable rule).
function externalIdForProject(sourceUrl) {
  return crypto.createHash('sha256').update(sourceUrl).digest('hex').slice(0, 40);
}

function buildReadmeContent(project) {
  const stepSections = project.allStepDetails.map(s => `## Step ${s.stepNumber}\n${s.content}`);
  return [project.stepByStepContent, ...stepSections].join('\n\n').slice(0, 100000);
}

// POST /api/colaberry-import — pull the logged-in user's Colaberry projects
// (via SQL + the captured live-login session) and import them alongside
// their GitHub repos, provider='colaberry'. Never touches deep_analyses —
// these aren't source code, so they go through the basic analysis pipeline
// (analyses table) instead. See PROGRESS.md M47.3 / M51 for why.
router.post('/', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;

  try {
    const userRow = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    const email = userRow.rows[0]?.email;
    if (!email) {
      return res.status(400).json({ success: false, error: { code: 'NO_EMAIL', message: 'Your account has no email on file.' } });
    }

    const sessionRow = await pool.query(
      'SELECT encrypted_storage_state, encryption_iv FROM colaberry_sessions WHERE user_id = $1',
      [userId]
    );
    if (!sessionRow.rows[0]) {
      return res.status(400).json({
        success: false,
        error: { code: 'NOT_CONNECTED', message: 'Connect your Colaberry account first.' },
      });
    }

    const encKey = process.env.COLABERRY_SESSION_ENCRYPTION_KEY;
    if (!encKey) {
      return res.status(500).json({ success: false, error: { code: 'NOT_CONFIGURED', message: 'COLABERRY_SESSION_ENCRYPTION_KEY is not configured.' } });
    }
    const storageState = sessionManager.decryptStorageState(sessionRow.rows[0], encKey);

    const colaberryUser = await getColaberryUserByEmail(email);
    if (!colaberryUser) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No Colaberry account found for your email.' },
      });
    }

    const projectLinks = await getProjectLinksForUser(colaberryUser.UserID);
    if (projectLinks.length === 0) {
      return res.status(200).json({ success: true, data: { imported: [], failed: [] } });
    }

    const { succeeded, failed: scrapeFailed } = await scrapeColaberryProjects(storageState, projectLinks);

    const imported = [];
    const importFailed = [...scrapeFailed.map(f => ({ url: f.url, error: f.error }))];

    for (const project of succeeded) {
      try {
        const result = await pool.query(
          `INSERT INTO repositories (
             user_id, provider, external_repo_id, name, full_name, description,
             private, topics, readme_content, imported_at, sync_status, created_at, updated_at
           ) VALUES ($1, 'colaberry', $2, $3, $3, $4, false, $5, $6, NOW(), 'synced', NOW(), NOW())
           ON CONFLICT (provider, external_repo_id) DO UPDATE SET
             name             = EXCLUDED.name,
             full_name        = EXCLUDED.full_name,
             description      = EXCLUDED.description,
             topics           = EXCLUDED.topics,
             readme_content   = EXCLUDED.readme_content,
             imported_at      = NOW(),
             sync_status      = 'synced',
             updated_at       = NOW()
           RETURNING id`,
          [
            userId,
            externalIdForProject(project.sourceUrl),
            project.title,
            project.description,
            JSON.stringify(project.tags),
            buildReadmeContent(project),
          ]
        );

        const repositoryId = result.rows[0].id;

        let analysisId = null;
        try {
          const analysisResult = await queueAnalysis(repositoryId);
          analysisId = analysisResult.analysisId;
        } catch (analysisErr) {
          console.error('[colaberry-import] analysis queue failed for', project.sourceUrl, ':', analysisErr.message);
        }

        imported.push({ repositoryId, title: project.title, analysisId });
      } catch (err) {
        console.error('[colaberry-import] DB upsert failed for', project.sourceUrl, ':', err.message);
        importFailed.push({ url: project.sourceUrl, error: err.message });
      }
    }

    return res.status(200).json({
      success: imported.length > 0,
      data: { imported, failed: importFailed },
    });
  } catch (err) {
    console.error('[colaberry-import] error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

module.exports = router;
