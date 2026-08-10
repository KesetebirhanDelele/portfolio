// Thin, readable wrappers around the shared AES-256-GCM helpers, specific to
// GitHub OAuth access tokens. Keeps call sites in auth.js/repos.js/
// portfolios.js/githubAccounts.js from having to know the encryption details.
const { encrypt, decrypt } = require('./encryption');

function requireKey() {
  const key = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY is not configured.');
  return key;
}

// Returns { encryptedToken, tokenIv } — matches the two-column pattern used
// for encrypted_access_token / access_token_iv and
// encrypted_github_access_token / github_access_token_iv.
function encryptGithubToken(plaintextToken) {
  const { payload, iv } = encrypt(plaintextToken, requireKey());
  return { encryptedToken: payload, tokenIv: iv };
}

// encryptedToken/tokenIv: the two column values as stored. Returns null if
// either is missing (no token on file) rather than throwing.
function decryptGithubToken(encryptedToken, tokenIv) {
  if (!encryptedToken || !tokenIv) return null;
  return decrypt(encryptedToken, tokenIv, requireKey());
}

module.exports = { encryptGithubToken, decryptGithubToken };
