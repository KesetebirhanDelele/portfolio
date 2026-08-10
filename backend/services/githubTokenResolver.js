// Resolves which GitHub token to use for a given user + repo owner.
// Shared by routes/repos.js and the deep-analysis pipeline (deepAnalysisQueue.js,
// routes/deepAnalysis.js) — extracted so both use the same resolution order
// and both decrypt tokens the same way, instead of drifting apart. See
// PROGRESS.md M53.
const pool = require('../db/postgres');
const { getInstallationToken } = require('./githubApp');
const { decryptGithubToken } = require('./githubTokenCrypto');

async function getGithubInfo(userId) {
  const result = await pool.query(
    'SELECT github_username, encrypted_github_access_token, github_access_token_iv FROM users WHERE id = $1',
    [userId]
  );
  const row = result.rows[0];
  if (!row) return {};
  return {
    github_username: row.github_username,
    github_access_token: decryptGithubToken(row.encrypted_github_access_token, row.github_access_token_iv),
  };
}

async function getGithubAccounts(userId) {
  const result = await pool.query(
    `SELECT id, github_username, encrypted_access_token, access_token_iv, is_primary
     FROM github_accounts
     WHERE user_id = $1
     ORDER BY is_primary DESC, connected_at ASC`,
    [userId]
  );
  return result.rows.map(row => ({
    id: row.id,
    github_username: row.github_username,
    access_token: decryptGithubToken(row.encrypted_access_token, row.access_token_iv),
    is_primary: row.is_primary,
  }));
}

async function getAppInstallations(userId) {
  const result = await pool.query(
    'SELECT installation_id, account_login FROM github_app_installations WHERE user_id = $1',
    [userId]
  );
  return result.rows;
}

// Resolve the best token to use for a repo owned by `owner`: prefer a
// connected OAuth account matching that owner, then a GitHub App
// installation, then fall back to the user's primary account token.
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

module.exports = { getGithubInfo, getGithubAccounts, getAppInstallations, getTokenForOwner };
