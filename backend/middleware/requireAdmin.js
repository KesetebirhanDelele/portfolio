// Gates a route to users with role='admin' (backend/db/migrations/20250101000001_create_core_tables.js
// already defines this column/check constraint — no new schema needed).
// Must run after authMiddleware, which is what populates req.user.id.
const pool = require('../db/postgres');

module.exports = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (result.rows[0]?.role !== 'admin') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
    }
    next();
  } catch (err) {
    console.error('[requireAdmin] error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error.' } });
  }
};
