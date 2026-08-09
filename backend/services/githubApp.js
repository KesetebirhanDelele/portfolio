'use strict';

const jwt  = require('jsonwebtoken');
const axios = require('axios');

const GITHUB_API = 'https://api.github.com';

function getPrivateKey() {
  const b64 = process.env.GITHUB_APP_PRIVATE_KEY_BASE64;
  if (!b64) throw new Error('GITHUB_APP_PRIVATE_KEY_BASE64 not set in .env');
  return Buffer.from(b64, 'base64').toString('utf8');
}

// Short-lived JWT used to authenticate AS the GitHub App (not a user)
function createAppJwt() {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iat: now - 60, exp: now + 540, iss: String(process.env.GITHUB_APP_ID) },
    getPrivateKey(),
    { algorithm: 'RS256' }
  );
}

const APP_HEADERS = (appJwt) => ({
  Authorization: `Bearer ${appJwt}`,
  Accept: 'application/vnd.github.v3+json',
  'User-Agent': 'Repo2Reputation/1.0',
});

// Get metadata for a specific installation
async function getInstallation(installationId) {
  const res = await axios.get(`${GITHUB_API}/app/installations/${installationId}`, {
    headers: APP_HEADERS(createAppJwt()),
  });
  return res.data;
}

// Exchange an installation_id for a short-lived repo access token (expires in 1 hour)
async function getInstallationToken(installationId) {
  const res = await axios.post(
    `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
    {},
    { headers: APP_HEADERS(createAppJwt()) }
  );
  return res.data.token;
}

// Fetch all repos granted to an installation (handles pagination)
async function getInstallationRepos(installationId) {
  const token = await getInstallationToken(installationId);
  const instHeaders = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Repo2Reputation/1.0',
  };

  const repos = [];
  let page = 1;
  while (true) {
    const res = await axios.get(`${GITHUB_API}/installation/repositories`, {
      headers: instHeaders,
      params: { per_page: 100, page },
    });
    repos.push(...res.data.repositories);
    if (res.data.repositories.length < 100) break;
    page++;
  }
  return repos;
}

module.exports = { createAppJwt, getInstallation, getInstallationToken, getInstallationRepos };
