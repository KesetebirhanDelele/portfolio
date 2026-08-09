const jwt = require("jsonwebtoken");
const pool = require("../db/postgres");

module.exports = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  let id, sessionId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    ({ id, sessionId } = decoded);
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM sessions
       WHERE id = $1
         AND user_id = $2
         AND revoked_at IS NULL
         AND expires_at > NOW()`,
      [sessionId, id]
    );

    if (!result.rows[0]) {
      return res.status(401).json({ error: "Session invalid or expired" });
    }

    req.user = { id };
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};


