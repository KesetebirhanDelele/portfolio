'use strict';
const express = require('express');
const pool = require('../db/postgres');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/users/me
router.get('/me', authMiddleware, async (req, res) => {
  const { id } = req.user;
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, github_username, avatar_url FROM users WHERE id = $1',
      [id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
