const crypto = require('crypto');
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { heavyOperationLimiter } = require('../middleware/rateLimiter');
const pool = require('../db/postgres');
const {
  getColaberryUserByEmail, getProjectLinksForUser,
  getNetworkProjects, getProjectDetailsById, getProjectStepsById,
} = require('../services/colaberrySqlClient');
const { buildStepByStepReadme } = require('../services/colaberryStepContentBuilder');
const { queueAnalysis } = require('../services/analysisQueue');
const { registerHeavyTaskHandler, enqueueHeavyTask } = require('../services/heavyTaskQueue');

const router = express.Router();

// Matches Portfolioforge's original MAX_LINKS constant.
const MAX_MANUAL_LINKS = 10;
// Kept as a validation/UX check (clear error message for a pasted non-Colaberry
// URL) even though, unlike the old live-login scrape, nothing here ever makes
// a server-side request to the pasted URL itself anymore — see PROGRESS.md
// M101. Only the numeric project ID is extracted from it; the actual content
// comes from SQL, so this is no longer an SSRF boundary, just a sanity check.
const ALLOWED_LINK_PREFIX = 'https://app.colaberry.com/';

// Stable id derived from the project URL so re-running import upserts
// instead of duplicating (idempotency, per CLAUDE.md's non-negotiable rule).
// Unchanged from the live-login era so re-importing a project that was
// previously scraped still upserts the same row instead of duplicating it.
function externalIdForProject(sourceUrl) {
  return crypto.createHash('sha256').update(sourceUrl).digest('hex').slice(0, 40);
}

// Every Colaberry project URL this app produces or accepts — the network
// catalog, CAP_Launch_UploadLink from SQL, and manually pasted links — uses
// this same /network/network/{id}/ shape. SQL is keyed on the bare numeric
// id, not the URL, so this is the one place that id gets extracted.
function projectIdFromColaberryUrl(url) {
  const match = typeof url === 'string' ? url.match(/\/network\/network\/(\d+)\//) : null;
  return match ? Number(match[1]) : null;
}

function sourceUrlForProjectId(projectId) {
  return `https://app.colaberry.com/app/network/network/${projectId}/projectinstructions`;
}

function validateManualLinks(links) {
  if (!Array.isArray(links) || links.length === 0) return 'projectLinks must be a non-empty array of URLs.';
  if (links.length > MAX_MANUAL_LINKS) return `You can import up to ${MAX_MANUAL_LINKS} project links at a time.`;
  for (const link of links) {
    if (typeof link !== 'string' || !link.startsWith(ALLOWED_LINK_PREFIX)) {
      return `Each link must be a Colaberry project URL starting with ${ALLOWED_LINK_PREFIX}`;
    }
    if (projectIdFromColaberryUrl(link) === null) {
      return `Couldn't find a project id in this link: ${link}`;
    }
  }
  return null;
}

// Job data is { userId, projectIds } — plain numbers, nothing secret, so
// (unlike the old live-login era) there's no decrypted session to keep off
// the Redis job-data boundary here. One bad project id never aborts the
// rest of the batch (Failure-First Design) — a projectId with no SQL match
// at all (the accepted ~2-14% gap from PROGRESS.md M101's SQL-only decision)
// lands in `failed`, not a retry or a scrape fallback.
registerHeavyTaskHandler('colaberry-sql-import', async ({ userId, projectIds }) => {
  const imported = [];
  const failed = [];

  for (const projectId of projectIds) {
    const sourceUrl = sourceUrlForProjectId(projectId);
    try {
      const detail = await getProjectDetailsById(projectId);
      if (!detail) {
        failed.push({ url: sourceUrl, error: 'This project isn’t in Colaberry’s deployed catalog — nothing to import.' });
        continue;
      }

      const steps = await getProjectStepsById(projectId);
      const readmeContent = buildStepByStepReadme(steps);

      const result = await pool.query(
        `INSERT INTO repositories (
           user_id, provider, external_repo_id, name, full_name, description,
           private, topics, readme_content, image_url, imported_at, sync_status, created_at, updated_at
         ) VALUES ($1, 'colaberry', $2, $3, $3, $4, false, $5, $6, $7, NOW(), 'synced', NOW(), NOW())
         ON CONFLICT (provider, external_repo_id) DO UPDATE SET
           name             = EXCLUDED.name,
           full_name        = EXCLUDED.full_name,
           description      = EXCLUDED.description,
           topics           = EXCLUDED.topics,
           readme_content   = EXCLUDED.readme_content,
           image_url        = EXCLUDED.image_url,
           imported_at      = NOW(),
           sync_status      = 'synced',
           updated_at       = NOW()
         RETURNING id`,
        [
          userId,
          externalIdForProject(sourceUrl),
          detail.title,
          detail.description,
          JSON.stringify(detail.tags),
          readmeContent,
          detail.imageUrl || null,
        ]
      );

      const repositoryId = result.rows[0].id;

      let analysisId = null;
      try {
        const analysisResult = await queueAnalysis(repositoryId);
        analysisId = analysisResult.analysisId;
      } catch (analysisErr) {
        console.error('[colaberry-import] analysis queue failed for', sourceUrl, ':', analysisErr.message);
      }

      imported.push({ repositoryId, title: detail.title, analysisId });
    } catch (err) {
      console.error('[colaberry-import] SQL import failed for', sourceUrl, ':', err.message);
      failed.push({ url: sourceUrl, error: err.message });
    }
  }

  return { imported, failed };
});

// POST /api/colaberry-import — import Colaberry projects alongside the
// user's GitHub repos, provider='colaberry'. Never touches deep_analyses —
// these aren't source code, so they go through the basic analysis pipeline
// (analyses table) instead. See PROGRESS.md M47.3 / M51 for why.
//
// SQL-only as of PROGRESS.md M101 — no Colaberry login/session is needed to
// import at all anymore, live-login and colaberryProjectScraper.js are no
// longer on this path (kept in the repo, unused, pending a follow-up
// cleanup pass).
//
// Body (optional): { projectLinks: string[] } — explicit Colaberry project
// URLs to import, matching Portfolioforge's original primary flow (paste
// 1-10 project links directly). Each link must resolve to a project id that
// exists in Colaberry's deployed catalog — see PROGRESS.md M101 for the
// accepted gap (a project not in that catalog fails per-item with a clear
// reason, rather than falling back to a scrape). When omitted, falls back
// to auto-discovering the logged-in user's own projects via SQL (the M51
// behavior, unchanged). See PROGRESS.md M55.
router.post('/', authMiddleware, heavyOperationLimiter, async (req, res) => {
  const { id: userId } = req.user;
  const { projectLinks: manualLinks } = req.body || {};

  let projectIds;

  if (manualLinks !== undefined) {
    const validationError = validateManualLinks(manualLinks);
    if (validationError) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: validationError } });
    }
    projectIds = manualLinks.map(projectIdFromColaberryUrl);
  }

  try {
    if (projectIds === undefined) {
      const userRow = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
      const email = userRow.rows[0]?.email;
      if (!email) {
        return res.status(400).json({ success: false, error: { code: 'NO_EMAIL', message: 'Your account has no email on file.' } });
      }
      const colaberryUser = await getColaberryUserByEmail(email);
      if (!colaberryUser) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No Colaberry account found for your email.' },
        });
      }
      const projectLinks = await getProjectLinksForUser(colaberryUser.UserID);
      projectIds = projectLinks.map(projectIdFromColaberryUrl).filter(id => id !== null);
      if (projectIds.length === 0) {
        return res.status(200).json({ success: true, data: { imported: [], failed: [] } });
      }
    }

    // Dedupe — a user's own project links and a manual paste can both
    // legitimately reference the same id more than once; no need to import
    // it twice in the same batch.
    projectIds = [...new Set(projectIds)];

    // Fire-and-forget: enqueue and return immediately with a jobId instead
    // of blocking this request until every project's SQL lookups + DB
    // upsert finish. The client polls GET /api/heavy-tasks/:jobId/status,
    // which reports queue position and an ETA so the UI can show "you're
    // #2, ~40s" instead of holding one HTTP connection open for up to the
    // queue's 10-minute default timeout.
    const job = await enqueueHeavyTask('colaberry-sql-import', { userId, projectIds });
    return res.status(202).json({ success: true, data: { jobId: job.id } });
  } catch (err) {
    console.error('[colaberry-import] error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/colaberry-import/network-projects — Colaberry's full network
// catalog, not scoped to the logged-in user (that's the point: it's how a
// user discovers a project that isn't "theirs" to begin with). See
// PROGRESS.md M57. Previously accepted ?category= against a 4-bucket
// keyword filter; now returns the full catalog with real tag metadata and
// lets the client search across it — see colaberrySqlClient.js's
// getNetworkProjects for why.
router.get('/network-projects', authMiddleware, async (req, res) => {
  try {
    const projects = await getNetworkProjects();
    return res.status(200).json({ success: true, data: { projects } });
  } catch (err) {
    console.error('[colaberry-import] network-projects error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to load network projects.' } });
  }
});

module.exports = router;
