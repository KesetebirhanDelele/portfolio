'use strict';

const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/postgres');
const authMiddleware = require('../middleware/authMiddleware');
const { getInstallation } = require('../services/githubApp');

const router = express.Router();

// GET /api/github-app/install?token=JWT
// Browser redirect — token passed as query param since headers aren't available
router.get('/install', async (req, res) => {
  const appSlug = process.env.GITHUB_APP_SLUG;
  if (!appSlug) return res.status(500).send('GITHUB_APP_SLUG not configured');

  const { token } = req.query;
  if (!token) return res.status(401).send('Not authenticated');

  let userId, sessionId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.id;
    sessionId = decoded.sessionId;
  } catch {
    return res.status(401).send('Invalid or expired session');
  }

  // This route can't use authMiddleware directly (token arrives as a query
  // param for a browser redirect, not an Authorization header on an API
  // fetch), but a logged-out/revoked session must still be rejected here
  // the same as everywhere else — otherwise logging out wouldn't actually
  // invalidate a token for this one endpoint. Mirrors authMiddleware.js's
  // own check exactly.
  const sessionResult = await pool.query(
    `SELECT id FROM sessions WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > NOW()`,
    [sessionId, userId]
  );
  if (!sessionResult.rows[0]) {
    return res.status(401).send('Session invalid or expired');
  }

  const state = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
  res.redirect(`https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(state)}`);
});

// GET /api/github-app/installed
// GitHub redirects here after the user installs (or updates) the app
// Query params: installation_id, setup_action, state
router.get('/installed', async (req, res) => {
  const { installation_id, setup_action, state } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (setup_action === 'delete') return res.redirect(frontendUrl);

  let userId;
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    userId = decoded.userId;
  } catch {
    return res.redirect(`${frontendUrl}/settings?error=invalid_state`);
  }

  try {
    // installation_id is a client-supplied, unauthenticated query param —
    // getInstallation()/getInstallationToken() authenticate as the GitHub
    // App itself (app-wide credentials), not as this specific user, so
    // nothing here proves the caller is who actually completed GitHub's
    // consent screen for THIS installation_id. Without the ownership check
    // below, any logged-in user could mint their own valid `state` (just by
    // starting the connect flow for themselves) and replay this URL with a
    // different org's real installation_id to silently reassign that org's
    // installation — and the private-repo access it grants — to themselves.
    // See PROGRESS.md M62.
    const existing = await pool.query(
      `SELECT user_id FROM github_app_installations WHERE installation_id = $1`,
      [String(installation_id)]
    );
    if (existing.rows[0] && existing.rows[0].user_id !== userId) {
      console.warn(`[github-app] rejected installation ${installation_id} reassignment attempt: already owned by a different user`);
      return res.redirect(`${frontendUrl}/settings?error=installation_already_claimed`);
    }

    const installation = await getInstallation(installation_id);
    const accountLogin  = installation.account.login;
    const accountType   = installation.account.type;   // 'User' or 'Organization'
    const avatarUrl     = installation.account.avatar_url;

    await pool.query(
      `INSERT INTO github_app_installations
         (user_id, installation_id, account_login, account_type, account_avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (installation_id) DO UPDATE SET
         account_login      = EXCLUDED.account_login,
         account_type       = EXCLUDED.account_type,
         account_avatar_url = EXCLUDED.account_avatar_url,
         updated_at         = NOW()`,
      [userId, String(installation_id), accountLogin, accountType, avatarUrl]
    );

    return res.redirect(`${frontendUrl}/?installed=${encodeURIComponent(accountLogin)}`);
  } catch (err) {
    console.error('[github-app] installed callback error:', err.message);
    return res.redirect(`${frontendUrl}/settings?error=server_error`);
  }
});

// GET /api/github-app/installations — list all app installations for current user
router.get('/installations', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  try {
    const result = await pool.query(
      `SELECT id, installation_id, account_login, account_type, account_avatar_url, created_at
       FROM github_app_installations
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[github-app] installations list error:', err.message);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE /api/github-app/installations/:id — remove an installation record
router.delete('/installations/:id', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM github_app_installations WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: 'Installation not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[github-app] installation delete error:', err.message);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
