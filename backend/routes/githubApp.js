'use strict';

const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/postgres');
const authMiddleware = require('../middleware/authMiddleware');
const { getInstallation } = require('../services/githubApp');

const router = express.Router();

// GET /api/github-app/install?token=JWT
// Browser redirect — token passed as query param since headers aren't available
router.get('/install', (req, res) => {
  const appSlug = process.env.GITHUB_APP_SLUG;
  if (!appSlug) return res.status(500).send('GITHUB_APP_SLUG not configured');

  const { token } = req.query;
  if (!token) return res.status(401).send('Not authenticated');

  let userId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.id;
  } catch {
    return res.status(401).send('Invalid or expired session');
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
    const installation = await getInstallation(installation_id);
    const accountLogin  = installation.account.login;
    const accountType   = installation.account.type;   // 'User' or 'Organization'
    const avatarUrl     = installation.account.avatar_url;

    await pool.query(
      `INSERT INTO github_app_installations
         (user_id, installation_id, account_login, account_type, account_avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (installation_id) DO UPDATE SET
         user_id            = EXCLUDED.user_id,
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
