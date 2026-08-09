'use strict';
const express = require('express');
const axios   = require('axios');
const pool = require('../db/postgres');
const authMiddleware = require('../middleware/authMiddleware');

const GITHUB_API = 'https://api.github.com';

const router = express.Router();

// GET /api/github-accounts — list all connected GitHub accounts for the current user
router.get('/', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  try {
    const result = await pool.query(
      `SELECT id, github_user_id, github_username, github_email, avatar_url, is_primary, connected_at
       FROM github_accounts
       WHERE user_id = $1
       ORDER BY is_primary DESC, connected_at ASC`,
      [userId]
    );
    return res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[github-accounts] list error:', err.message);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/github-accounts/pat — connect a secondary account via Personal Access Token
router.post('/pat', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { pat } = req.body;

  if (!pat || typeof pat !== 'string' || !pat.trim()) {
    return res.status(400).json({ success: false, error: 'Personal access token is required' });
  }

  const ghHeaders = { Authorization: `token ${pat.trim()}`, 'User-Agent': 'Repo2Reputation/1.0' };

  try {
    // Verify the token and fetch profile
    const [profileRes, emailsRes] = await Promise.all([
      axios.get(`${GITHUB_API}/user`, { headers: ghHeaders }),
      axios.get(`${GITHUB_API}/user/emails`, { headers: ghHeaders }).catch(() => ({ data: [] })),
    ]);

    const profile        = profileRes.data;
    const githubId       = String(profile.id);
    const githubUsername = profile.login;
    const avatarUrl      = profile.avatar_url;

    const emails = Array.isArray(emailsRes.data) ? emailsRes.data : [];
    const primaryEmail =
      emails.find(e => e.primary && e.verified)?.email ||
      emails.find(e => e.primary)?.email ||
      profile.email ||
      `${githubId}@users.noreply.github.com`;

    // Check if already connected
    const existing = await pool.query(
      'SELECT user_id FROM github_accounts WHERE github_user_id = $1',
      [githubId]
    );
    if (existing.rows[0]) {
      const code = existing.rows[0].user_id === userId ? 'already_connected' : 'account_taken';
      return res.status(409).json({ success: false, error: code });
    }

    await pool.query(
      `INSERT INTO github_accounts (user_id, github_user_id, github_username, github_email, access_token, avatar_url, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, false)`,
      [userId, githubId, githubUsername, primaryEmail, pat.trim(), avatarUrl]
    );

    return res.status(201).json({ success: true, data: { username: githubUsername, avatarUrl } });

  } catch (err) {
    if (err.response?.status === 401) {
      return res.status(401).json({ success: false, error: 'Invalid token — check that the PAT is correct and has not expired' });
    }
    console.error('[github-accounts] PAT connect error:', err.message);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE /api/github-accounts/:id — disconnect a secondary GitHub account
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { id: accountId } = req.params;

  try {
    const result = await pool.query(
      'SELECT id, is_primary FROM github_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );
    const account = result.rows[0];
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }
    if (account.is_primary) {
      return res.status(400).json({ success: false, error: 'Cannot disconnect your primary GitHub account' });
    }

    await pool.query('DELETE FROM github_accounts WHERE id = $1', [accountId]);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[github-accounts] delete error:', err.message);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
