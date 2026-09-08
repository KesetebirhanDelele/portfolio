'use strict';
const express = require('express');
const axios   = require('axios');
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/postgres');
const { encryptGithubToken } = require('../services/githubTokenCrypto');
const { getColaberryUserByEmail } = require('../services/colaberrySqlClient');

const router = express.Router();

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL     = 'https://github.com/login/oauth/access_token';
const GITHUB_API           = 'https://api.github.com';
const OAUTH_SCOPES         = 'read:user user:email repo';
const SESSION_DAYS         = 7;

// GET /api/auth/github — redirect to GitHub OAuth
// Optional: ?mode=connect&token=JWT  to link a second account to the current user
router.get('/github', (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const { mode, token } = req.query;

  let statePayload = { nonce: crypto.randomBytes(16).toString('hex'), mode: 'login' };

  if (mode === 'connect' && token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      statePayload = { nonce: crypto.randomBytes(16).toString('hex'), mode: 'connect', userId: decoded.id };
    } catch {
      return res.redirect(`${frontendUrl}/settings?error=invalid_token`);
    }
  }

  const state = jwt.sign(statePayload, process.env.JWT_SECRET, { expiresIn: '10m' });
  const oauthQuery = {
    client_id:    process.env.GITHUB_CLIENT_ID,
    // Explicit, not omitted: with more than one callback URL registered on
    // this OAuth App (multiple environments/servers sharing one app), GitHub
    // falls back to an ambiguous default when redirect_uri is left out of
    // the authorize request — confirmed live during the 2026-09-08 server
    // migration, where every login attempt landed back on the OLD server
    // regardless of which one initiated it. Naming it here per-request
    // means each deployment's own FRONTEND_URL decides where it comes back
    // to, with no dependency on registration order.
    redirect_uri: `${frontendUrl}/api/auth/github/callback`,
    scope:        OAUTH_SCOPES,
    state,
  };

  // If a login hint is provided in connect mode, include it so GitHub forces the
  // user to sign in as that specific account rather than reusing the current session.
  const { login: loginHint } = req.query;
  if (statePayload.mode === 'connect' && loginHint) {
    oauthQuery.login = loginHint;
  }

  const params = new URLSearchParams(oauthQuery);
  res.redirect(`${GITHUB_AUTHORIZE_URL}?${params}`);
});

// GET /api/auth/github/callback — exchange code, upsert user, issue JWT
router.get('/github/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error || !code) {
    return res.redirect(`${frontendUrl}/auth/callback?error=access_denied`);
  }

  // Decode signed state
  let stateData = { mode: 'login' };
  if (state) {
    try {
      stateData = jwt.verify(state, process.env.JWT_SECRET);
    } catch {
      // Unsigned state from old flows — treat as login
      stateData = { mode: 'login' };
    }
  }

  try {
    // Exchange code for GitHub access token
    const tokenRes = await axios.post(GITHUB_TOKEN_URL, {
      client_id:     process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      // Must match whatever redirect_uri (if any) was sent in the
      // authorize request — see that route's comment. Both sides now name
      // it explicitly instead of both omitting it.
      redirect_uri:  `${frontendUrl}/api/auth/github/callback`,
    }, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      validateStatus: () => true,
    });

    if (tokenRes.status !== 200 || !tokenRes.data.access_token) {
      console.error('[auth/github] token exchange failed — status:', tokenRes.status, 'body:', tokenRes.data);
      const errDest = stateData.mode === 'connect'
        ? `${frontendUrl}/settings?error=token_exchange_failed`
        : `${frontendUrl}/auth/callback?error=token_exchange_failed`;
      return res.redirect(errDest);
    }

    const accessToken = tokenRes.data.access_token;
    const ghHeaders = { Authorization: `token ${accessToken}`, 'User-Agent': 'Repo2Reputation/1.0' };
    // Encrypted once here — every storage site below uses the ciphertext,
    // never the raw token (see PROGRESS.md M53: tokens were plaintext before).
    const { encryptedToken, tokenIv } = encryptGithubToken(accessToken);

    // Fetch GitHub profile + emails
    const [profileRes, emailsRes] = await Promise.all([
      axios.get(`${GITHUB_API}/user`, { headers: ghHeaders }),
      axios.get(`${GITHUB_API}/user/emails`, { headers: ghHeaders }).catch(() => ({ data: [] })),
    ]);

    const profile        = profileRes.data;
    const githubId       = String(profile.id);
    const githubUsername = profile.login;
    const name           = profile.name || profile.login;
    const avatarUrl      = profile.avatar_url;

    const emails = Array.isArray(emailsRes.data) ? emailsRes.data : [];
    const primaryEmail =
      emails.find(e => e.primary && e.verified && !e.email.includes('noreply'))?.email ||
      emails.find(e => e.primary)?.email ||
      profile.email ||
      `${githubId}+${githubUsername}@users.noreply.github.com`;

    // ── CONNECT MODE: link additional account to existing user ────────────────
    if (stateData.mode === 'connect' && stateData.userId) {
      const targetUserId = stateData.userId;

      // Check if this GitHub account is already connected anywhere
      const existing = await pool.query(
        'SELECT user_id FROM github_accounts WHERE github_user_id = $1',
        [githubId]
      );

      if (existing.rows[0]) {
        const conflict = existing.rows[0].user_id === targetUserId
          ? 'already_connected'
          : 'account_taken';
        return res.redirect(`${frontendUrl}/settings?error=${conflict}`);
      }

      await pool.query(
        `INSERT INTO github_accounts (user_id, github_user_id, github_username, github_email, encrypted_access_token, access_token_iv, avatar_url, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
        [targetUserId, githubId, githubUsername, primaryEmail, encryptedToken, tokenIv, avatarUrl]
      );

      return res.redirect(`${frontendUrl}/?connected=${encodeURIComponent(githubUsername)}`);
    }

    // ── LOGIN MODE: access gate — Colaberry account required ──────────────────
    // Only people with an active Colaberry account may create or use an
    // account here — check every *verified* email on the GitHub account, not
    // just the profile's primary one, since a student's GitHub primary email
    // is often personal while their Colaberry account uses a school/work
    // address that may also be verified on the same GitHub account.
    const verifiedEmails = [...new Set(
      emails.filter(e => e.verified).map(e => e.email.toLowerCase())
    )];
    if (verifiedEmails.length === 0) verifiedEmails.push(primaryEmail.toLowerCase());

    let hasColaberryAccount = false;
    try {
      for (const email of verifiedEmails) {
        if (await getColaberryUserByEmail(email)) { hasColaberryAccount = true; break; }
      }
    } catch (err) {
      // Fail closed: an SQL Server outage must not silently grant access as
      // if verification had passed — that would defeat the whole gate.
      console.error('[auth/github] Colaberry account check failed:', err.message);
      return res.redirect(`${frontendUrl}/auth/callback?error=colaberry_check_failed`);
    }

    if (!hasColaberryAccount) {
      return res.redirect(`${frontendUrl}/auth/callback?error=no_colaberry_account`);
    }

    // ── LOGIN MODE: upsert user + primary github_account ─────────────────────
    let userId;
    const byGithubId = await pool.query('SELECT id FROM users WHERE github_user_id = $1', [githubId]);

    if (byGithubId.rows[0]) {
      userId = byGithubId.rows[0].id;
      await pool.query(
        `UPDATE users
         SET github_username = $1, name = $2, avatar_url = $3,
             encrypted_github_access_token = $4, github_access_token_iv = $5,
             last_login_at = NOW(), updated_at = NOW()
         WHERE id = $6`,
        [githubUsername, name, avatarUrl, encryptedToken, tokenIv, userId]
      );
    } else {
      const byEmail = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1)', [primaryEmail]);
      if (byEmail.rows[0]) {
        userId = byEmail.rows[0].id;
        await pool.query(
          `UPDATE users
           SET github_user_id = $1, github_username = $2, name = $3,
               avatar_url = $4, encrypted_github_access_token = $5, github_access_token_iv = $6,
               last_login_at = NOW(), updated_at = NOW()
           WHERE id = $7`,
          [githubId, githubUsername, name, avatarUrl, encryptedToken, tokenIv, userId]
        );
      } else {
        const created = await pool.query(
          `INSERT INTO users (email, github_user_id, github_username, name, avatar_url, encrypted_github_access_token, github_access_token_iv, last_login_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           RETURNING id`,
          [primaryEmail, githubId, githubUsername, name, avatarUrl, encryptedToken, tokenIv]
        );
        userId = created.rows[0].id;
      }
    }

    // Sync github_accounts: if this github_user_id exists (even as secondary), take ownership
    await pool.query(
      `INSERT INTO github_accounts (user_id, github_user_id, github_username, github_email, encrypted_access_token, access_token_iv, avatar_url, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       ON CONFLICT (github_user_id) DO UPDATE SET
         user_id                = EXCLUDED.user_id,
         github_username        = EXCLUDED.github_username,
         github_email           = EXCLUDED.github_email,
         encrypted_access_token = EXCLUDED.encrypted_access_token,
         access_token_iv        = EXCLUDED.access_token_iv,
         avatar_url             = EXCLUDED.avatar_url,
         is_primary             = true`,
      [userId, githubId, githubUsername, primaryEmail, encryptedToken, tokenIv, avatarUrl]
    );

    // Create session
    const refreshTokenHash = crypto.createHash('sha256')
      .update(crypto.randomBytes(64))
      .digest('hex');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

    const sessionResult = await pool.query(
      `INSERT INTO sessions (user_id, refresh_token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [userId, refreshTokenHash, req.ip, req.headers['user-agent'], expiresAt]
    );
    const sessionId = sessionResult.rows[0].id;

    const token = jwt.sign(
      { id: userId, sessionId },
      process.env.JWT_SECRET,
      { expiresIn: `${SESSION_DAYS}d` }
    );

    return res.redirect(`${frontendUrl}/auth/callback?token=${encodeURIComponent(token)}`);

  } catch (err) {
    console.error('[auth/github/callback] error:', err.message);
    const dest = stateData.mode === 'connect'
      ? `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?error=server_error`
      : `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?error=server_error`;
    return res.redirect(dest);
  }
});

// POST /api/auth/logout — revoke session
router.post('/logout', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(400).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.sessionId) {
      await pool.query(`UPDATE sessions SET revoked_at = NOW() WHERE id = $1`, [decoded.sessionId]);
    }
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch {
    return res.status(200).json({ message: 'Logged out' });
  }
});

module.exports = router;
