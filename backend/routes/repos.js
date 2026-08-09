const express = require('express');
const axios = require('axios');
const pool = require('../db/postgres');
const authMiddleware = require('../middleware/authMiddleware');
const { generateReadme } = require('../services/openai');
const { queueAnalysis }        = require('../services/analysisQueue');
const { queueDeepAnalysis }    = require('../services/deepAnalysisQueue');
const { getInstallationRepos, getInstallationToken } = require('../services/githubApp');

const router = express.Router();

const GITHUB_API = 'https://api.github.com';
const README_MAX_REPO_SIZE_KB = 5120; // skip README fetch if repo > 5 MB

function makeGithubHeaders(userToken) {
  const token = userToken || process.env.GITHUB_TOKEN;
  return {
    'User-Agent': 'Repo2Reputation/1.0',
    'Accept': 'application/vnd.github.v3+json',
    ...(token && { Authorization: `token ${token}` }),
  };
}

async function getGithubInfo(userId) {
  const result = await pool.query(
    'SELECT github_username, github_access_token FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0] || {};
}

async function getGithubAccounts(userId) {
  const result = await pool.query(
    `SELECT id, github_username, access_token, is_primary
     FROM github_accounts
     WHERE user_id = $1
     ORDER BY is_primary DESC, connected_at ASC`,
    [userId]
  );
  return result.rows;
}

async function getAppInstallations(userId) {
  const result = await pool.query(
    'SELECT installation_id, account_login FROM github_app_installations WHERE user_id = $1',
    [userId]
  );
  return result.rows;
}

// Resolve the best token to use when importing a repo owned by `owner`
async function getTokenForOwner(userId, owner) {
  const accounts = await getGithubAccounts(userId);
  const oauthMatch = accounts.find(a => a.github_username.toLowerCase() === owner.toLowerCase());
  if (oauthMatch) return oauthMatch.access_token;

  const installations = await getAppInstallations(userId);
  const appMatch = installations.find(i => i.account_login.toLowerCase() === owner.toLowerCase());
  if (appMatch) {
    try { return await getInstallationToken(appMatch.installation_id); } catch { /* fall through */ }
  }

  const primary = accounts.find(a => a.is_primary) || accounts[0];
  return primary?.access_token || null;
}

async function fetchReadme(owner, repo, userToken) {
  try {
    const response = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}/readme`, {
      headers: makeGithubHeaders(userToken),
    });
    return Buffer.from(response.data.content, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

function mapGithubRepo(r, accountUsername) {
  return {
    externalRepoId:  String(r.id),
    name:            r.name,
    fullName:        r.full_name,
    description:     r.description || null,
    private:         r.private,
    fork:            r.fork || false,
    language:        r.language || null,
    starsCount:      r.stargazers_count,
    forksCount:      r.forks_count,
    topics:          r.topics || [],
    defaultBranch:   r.default_branch,
    repoCreatedAt:   r.created_at,
    repoUpdatedAt:   r.updated_at,
    pushedAt:        r.pushed_at || r.updated_at,
    sizeKb:          r.size,
    accountUsername,
  };
}

// GET /api/repos — list GitHub repos for the logged-in user + any extra usernames
// ?extra=username1,username2  adds public repos from those GitHub usernames
router.get('/', authMiddleware, async (req, res) => {
  const { id } = req.user;
  const sort = req.query.sort || 'updated';
  const extraUsernames = req.query.extra
    ? req.query.extra.split(',').map(u => u.trim()).filter(Boolean)
    : [];

  try {
    // Primary account: try github_accounts, fall back to users table
    const primaryInfo = await getGithubInfo(id);
    if (!primaryInfo.github_username) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_GITHUB_CONNECTED', message: 'GitHub account not connected.' },
      });
    }

    // Fetch primary account repos (authenticated — includes private)
    const primaryApiUrl = primaryInfo.github_access_token
      ? `${GITHUB_API}/user/repos`
      : `${GITHUB_API}/users/${primaryInfo.github_username}/repos`;

    const primaryResponse = await axios.get(primaryApiUrl, {
      headers: makeGithubHeaders(primaryInfo.github_access_token),
      params: { per_page: 100, sort, type: 'owner' },
    });
    const primaryRepos = primaryResponse.data.map(r => mapGithubRepo(r, primaryInfo.github_username));

    // Secondary connected accounts — fetch with stored OAuth token (private repos included)
    const allAccounts = await getGithubAccounts(id);
    const secondaryAccounts = allAccounts.filter(a => !a.is_primary);
    const connectedUsernames = new Set(allAccounts.map(a => a.github_username.toLowerCase()));

    const secondaryResults = await Promise.all(
      secondaryAccounts.map(async (account) => {
        try {
          const response = await axios.get(`${GITHUB_API}/user/repos`, {
            headers: makeGithubHeaders(account.access_token),
            params: { per_page: 100, sort, type: 'owner' },
          });
          return response.data.map(r => mapGithubRepo(r, account.github_username));
        } catch (err) {
          console.error(`[repos] secondary account ${account.github_username} fetch failed:`, err.message);
          return [];
        }
      })
    );
    const secondaryRepos = secondaryResults.flat();

    // GitHub App installations — skip accounts already covered by OAuth
    const installations = await getAppInstallations(id);
    const installationResults = await Promise.all(
      installations
        .filter(i => !connectedUsernames.has(i.account_login.toLowerCase()))
        .map(async (inst) => {
          try {
            const repos = await getInstallationRepos(inst.installation_id);
            return repos.map(r => mapGithubRepo(r, inst.account_login));
          } catch (err) {
            console.error(`[repos] GitHub App installation ${inst.installation_id} fetch failed:`, err.message);
            return [];
          }
        })
    );
    const installationRepos = installationResults.flat();
    installations.forEach(i => connectedUsernames.add(i.account_login.toLowerCase()));

    // Extra public usernames — skip any already connected via OAuth (avoids duplicates)
    const extraResults = await Promise.all(
      extraUsernames
        .filter(u => !connectedUsernames.has(u.toLowerCase()))
        .map(async (username) => {
          try {
            const response = await axios.get(`${GITHUB_API}/users/${username}/repos`, {
              headers: makeGithubHeaders(null),
              params: { per_page: 100, sort, type: 'owner' },
            });
            return response.data.map(r => mapGithubRepo(r, username));
          } catch (err) {
            const status = err.response?.status;
            if (status === 404) return { error: `GitHub user @${username} not found`, username };
            return [];
          }
        })
    );

    // Separate errors from valid repo arrays
    const extraErrors = extraResults.filter(r => r && r.error);
    const extraRepos  = extraResults.filter(Array.isArray).flat();

    const repos = [...primaryRepos, ...secondaryRepos, ...installationRepos, ...extraRepos]
      .sort((a, b) => new Date(b.repoUpdatedAt) - new Date(a.repoUpdatedAt));

    return res.status(200).json({
      success: true,
      data: repos,
      meta: { count: repos.length, extraErrors },
    });
  } catch (err) {
    console.error('[repos] list error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch repositories.' } });
  }
});

// POST /api/repos/auto-import — first-login helper: fetch top 10 non-fork repos by push date
router.post('/auto-import', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;

  try {
    // Skip if user already has imported repos
    const existing = await pool.query(
      'SELECT COUNT(*) FROM repositories WHERE user_id = $1',
      [userId]
    );
    if (parseInt(existing.rows[0].count, 10) > 0) {
      return res.status(200).json({ success: true, data: { skipped: true } });
    }

    const primaryInfo = await getGithubInfo(userId);
    if (!primaryInfo.github_username) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_GITHUB_CONNECTED', message: 'GitHub account not connected.' },
      });
    }

    const apiUrl = primaryInfo.github_access_token
      ? `${GITHUB_API}/user/repos`
      : `${GITHUB_API}/users/${primaryInfo.github_username}/repos`;

    const response = await axios.get(apiUrl, {
      headers: makeGithubHeaders(primaryInfo.github_access_token),
      params: { per_page: 100, sort: 'pushed', type: 'owner' },
    });

    const top10 = response.data
      .filter(r => !r.fork)
      .slice(0, 10)
      .map(r => r.full_name);

    return res.status(200).json({ success: true, data: { repoFullNames: top10 } });

  } catch (err) {
    console.error('[repos] auto-import error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to auto-import repositories.' } });
  }
});

// POST /api/repos/auto-import-account — discover top N repos from a connected private GitHub account
// Uses the account's OAuth token so private repos are included
router.post('/auto-import-account', authMiddleware, async (req, res) => {
  const { username, limit = 10 } = req.body;
  const { id: userId } = req.user;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'username is required.' } });
  }
  try {
    const accounts = await getGithubAccounts(userId);
    const account  = accounts.find(a => a.github_username.toLowerCase() === username.toLowerCase());
    if (!account) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Account @${username} is not connected.` } });
    }
    const response = await axios.get(`${GITHUB_API}/user/repos`, {
      headers: makeGithubHeaders(account.access_token),
      params: { per_page: 100, sort: 'pushed', type: 'owner' },
    });
    const repoFullNames = response.data
      .filter(r => !r.fork)
      .slice(0, Math.min(Number(limit), 15))
      .map(r => r.full_name);
    return res.status(200).json({ success: true, data: { repoFullNames } });
  } catch (err) {
    console.error('[repos] auto-import-account error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch repositories.' } });
  }
});

// POST /api/repos/auto-import-public — discover top N non-fork repos from any public GitHub username
router.post('/auto-import-public', authMiddleware, async (req, res) => {
  const { username, limit = 5 } = req.body;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'username is required.' } });
  }
  try {
    const response = await axios.get(`${GITHUB_API}/users/${encodeURIComponent(username)}/repos`, {
      headers: makeGithubHeaders(null),
      params: { per_page: 30, sort: 'pushed', type: 'owner' },
    });
    const repoFullNames = response.data
      .filter(r => !r.fork)
      .slice(0, Math.min(Number(limit), 15))
      .map(r => r.full_name);
    return res.status(200).json({ success: true, data: { repoFullNames } });
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `GitHub user @${username} not found.` } });
    }
    console.error('[repos] auto-import-public error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch public repositories.' } });
  }
});

// GET /api/repos/imported — list repos already imported into the DB for this user
router.get('/imported', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const page   = parseInt(req.query.page)  || 1;
  const limit  = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT id, name, full_name, description, primary_language, stars_count,
                forks_count, topics, sync_status, imported_at, repo_updated_at
         FROM repositories
         WHERE user_id = $1
         ORDER BY imported_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      pool.query('SELECT COUNT(*) FROM repositories WHERE user_id = $1', [userId]),
    ]);

    return res.status(200).json({
      success: true,
      data: rows.rows,
      meta: { page, limit, total: parseInt(countRow.rows[0].count) },
    });
  } catch (err) {
    console.error('[repos] imported list error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch imported repositories.' } });
  }
});

// POST /api/repos/import — fetch selected repos from GitHub and persist to DB
router.post('/import', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { repoFullNames } = req.body;

  if (!Array.isArray(repoFullNames) || repoFullNames.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'repoFullNames must be a non-empty array of "owner/repo" strings.' },
    });
  }

  let accounts;
  try {
    accounts = await getGithubAccounts(userId);
    if (!accounts.length) {
      const info = await getGithubInfo(userId);
      if (!info.github_username) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_GITHUB_CONNECTED', message: 'GitHub account not connected.' },
        });
      }
      accounts = [{ github_username: info.github_username, access_token: info.github_access_token, is_primary: true }];
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error.' } });
  }

  const results = [];

  for (const fullName of repoFullNames) {
    const parts = fullName.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      results.push({ fullName, status: 'failed', error: 'Invalid format — use "owner/repo".' });
      continue;
    }
    const [owner, repoName] = parts;

    const accessToken = await getTokenForOwner(userId, owner);
    const ghInfo = { github_access_token: accessToken };

    // Create import job record (repository_id linked after successful fetch)
    let jobId;
    try {
      const jobResult = await pool.query(
        `INSERT INTO import_jobs (user_id, status, started_at, created_at)
         VALUES ($1, 'running', NOW(), NOW()) RETURNING id`,
        [userId]
      );
      jobId = jobResult.rows[0].id;
    } catch (err) {
      results.push({ fullName, status: 'failed', error: 'Could not create import job.' });
      continue;
    }

    try {
      // Fetch repo details from GitHub
      const { data: repo } = await axios.get(`${GITHUB_API}/repos/${owner}/${repoName}`, {
        headers: makeGithubHeaders(ghInfo.github_access_token),
      });

      // Fetch README only when repo is small enough to stay within rate limits
      const readmeContent = repo.size < README_MAX_REPO_SIZE_KB
        ? await fetchReadme(owner, repoName, ghInfo.github_access_token)
        : null;

      // Upsert into repositories — update on re-import
      const repoResult = await pool.query(
        `INSERT INTO repositories (
           user_id, provider, external_repo_id, name, full_name, description,
           private, default_branch, primary_language, stars_count, forks_count,
           topics, readme_content, repo_created_at, repo_updated_at,
           imported_at, sync_status, created_at, updated_at
         ) VALUES (
           $1, 'github', $2, $3, $4, $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14, NOW(), 'synced', NOW(), NOW()
         )
         ON CONFLICT (provider, external_repo_id) DO UPDATE SET
           user_id          = EXCLUDED.user_id,
           name             = EXCLUDED.name,
           full_name        = EXCLUDED.full_name,
           description      = EXCLUDED.description,
           primary_language = EXCLUDED.primary_language,
           stars_count      = EXCLUDED.stars_count,
           forks_count      = EXCLUDED.forks_count,
           topics           = EXCLUDED.topics,
           readme_content   = EXCLUDED.readme_content,
           repo_updated_at  = EXCLUDED.repo_updated_at,
           imported_at      = NOW(),
           sync_status      = 'synced',
           updated_at       = NOW()
         RETURNING id`,
        [
          userId,
          String(repo.id),
          repo.name,
          repo.full_name,
          repo.description || null,
          repo.private,
          repo.default_branch,
          repo.language || null,
          repo.stargazers_count,
          repo.forks_count,
          JSON.stringify(repo.topics || []),
          readmeContent,
          repo.created_at,
          repo.updated_at,
        ]
      );

      const repositoryId = repoResult.rows[0].id;

      // Link job to repository and mark succeeded
      await pool.query(
        `UPDATE import_jobs
         SET repository_id = $1, status = 'succeeded', progress_pct = 100, completed_at = NOW()
         WHERE id = $2`,
        [repositoryId, jobId]
      );

      // Auto-queue basic analysis — non-blocking
      let analysisId = null;
      try {
        const analysisResult = await queueAnalysis(repositoryId);
        analysisId = analysisResult.analysisId;
      } catch (analysisErr) {
        console.error('[repos] basic analysis queue failed for', fullName, ':', analysisErr.message);
      }

      // Auto-queue deep analysis — non-blocking
      let deepAnalysisId = null;
      try {
        const deepResult = await queueDeepAnalysis(repositoryId, userId);
        deepAnalysisId = deepResult?.analysisId ?? null;
        if (!deepResult) console.warn('[repos] deep analysis not queued for', fullName, '— repo not found for userId', userId);
      } catch (deepErr) {
        console.error('[repos] deep analysis queue failed for', fullName, ':', deepErr.message);
      }

      results.push({
        fullName,
        status: 'succeeded',
        jobId,
        repositoryId,
        analysisId,
        deepAnalysisId,
        readmeFetched: readmeContent !== null,
      });
    } catch (err) {
      const errorMessage = err.response?.status === 404
        ? 'Repository not found on GitHub.'
        : err.response?.status === 403
        ? 'GitHub API rate limit exceeded.'
        : err.message;

      await pool.query(
        `UPDATE import_jobs SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2`,
        [errorMessage, jobId]
      );

      results.push({ fullName, status: 'failed', jobId, error: errorMessage });
    }
  }

  const allSucceeded  = results.every(r => r.status === 'succeeded');
  const anySucceeded  = results.some(r => r.status === 'succeeded');

  return res.status(200).json({
    success: anySucceeded,
    data: {
      results,
      overallStatus: allSucceeded ? 'succeeded' : anySucceeded ? 'partial' : 'failed',
    },
  });
});

// GET /api/repos/import/:jobId — check the status of an import job
router.get('/import/:jobId', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { jobId } = req.params;

  try {
    const result = await pool.query(
      `SELECT ij.id, ij.status, ij.progress_pct, ij.error_message,
              ij.started_at, ij.completed_at,
              r.name AS repo_name, r.full_name AS repo_full_name
       FROM import_jobs ij
       LEFT JOIN repositories r ON r.id = ij.repository_id
       WHERE ij.id = $1 AND ij.user_id = $2`,
      [jobId, userId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Import job not found.' } });
    }

    const job = result.rows[0];
    return res.status(200).json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        progress: job.progress_pct,
        repoName: job.repo_name,
        repoFullName: job.repo_full_name,
        errorMessage: job.error_message,
        startedAt: job.started_at,
        completedAt: job.completed_at,
      },
    });
  } catch (err) {
    console.error('[repos] job status error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch job status.' } });
  }
});

// POST /api/repos/:repositoryId/generate-readme — generate a README draft from analysis data
// DELETE /api/repos/:repositoryId — remove an imported repo and all its analysis data
router.delete('/:repositoryId', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { repositoryId } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM repositories WHERE id = $1 AND user_id = $2 RETURNING id, full_name',
      [repositoryId, userId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: 'Repository not found.' });
    }
    return res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error('[repos] delete error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to delete repository.' });
  }
});

router.post('/:repositoryId/generate-readme', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { repositoryId } = req.params;
  const { mediaUrls = [] } = req.body; // [{ label: string, url: string }]

  try {
    const repoResult = await pool.query(
      `SELECT id, name, full_name, description, primary_language, topics
       FROM repositories WHERE id = $1 AND user_id = $2`,
      [repositoryId, userId]
    );

    if (!repoResult.rows[0]) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Repository not found.' } });
    }

    const repo = repoResult.rows[0];

    const [analysisResult, deepResult] = await Promise.all([
      pool.query(
        `SELECT skills_json, summary_json, confidence_score
         FROM analyses
         WHERE repository_id = $1 AND status = 'completed'
         ORDER BY created_at DESC LIMIT 1`,
        [repositoryId]
      ),
      pool.query(
        `SELECT intelligence_json, inference_json, code_intelligence_json
         FROM deep_analyses
         WHERE repository_id = $1 AND status IN ('completed', 'partial')
         ORDER BY completed_at DESC LIMIT 1`,
        [repositoryId]
      ),
    ]);

    if (!analysisResult.rows[0] && !deepResult.rows[0]) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_ANALYSIS', message: 'Run an analysis on this repository before generating a README.' },
      });
    }

    const deep    = deepResult.rows[0] || {};
    const intel   = deep.intelligence_json;
    const infer   = deep.inference_json;
    const codeInt = deep.code_intelligence_json;

    const row = analysisResult.rows[0] || {};
    const analysis = {
      technologies:             row.skills_json   || [],
      summary:                  row.summary_json?.text,
      what_it_does:             row.summary_json?.what_it_does,
      highlights:               row.summary_json?.highlights,
      key_takeaways:            row.summary_json?.key_takeaways || [],
      probableDomain:           intel?.businessValue?.probableDomain           || null,
      operationalCapabilities:  intel?.businessValue?.operationalCapabilities  || [],
      technicalDifferentiation: intel?.portfolioNarrative?.technicalDifferentiation || [],
      impactStatements:         intel?.resume?.impactStatements                || [],
      patternsInferred:         infer?.patternsInferred                        || [],
      architecturePatterns:     codeInt?.architecturePatterns                  || [],
    };

    const readme = await generateReadme(repo, analysis, mediaUrls);
    return res.status(200).json({ success: true, data: { readme } });
  } catch (err) {
    console.error('[repos] generate-readme error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to generate README.' } });
  }
});

module.exports = router;
