const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const sessionManager = require('../services/colaberryLiveLoginSessionManager');

const router = express.Router();

// POST /api/colaberry-login/start — spin up an isolated live-browser session
// for the logged-in user. Returns a sessionId + signed stream token; the
// frontend uses these to open the noVNC WebSocket connection.
router.post('/start', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const loginUrl = process.env.COLABERRY_LOGIN_URL;

  if (!loginUrl) {
    return res.status(500).json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'COLABERRY_LOGIN_URL is not configured.' },
    });
  }

  try {
    const { sessionId, token, expiresAt } = await sessionManager.startSession(userId, loginUrl);
    return res.status(200).json({ success: true, data: { sessionId, token, expiresAt } });
  } catch (err) {
    const status = err.code === 'CAPACITY_EXCEEDED' ? 503
      : err.code === 'SESSION_EXISTS' ? 409
      : 500;
    console.error('[colaberry-login] start error:', err.message);
    return res.status(status).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message },
    });
  }
});

// POST /api/colaberry-login/:sessionId/complete — user has confirmed they've
// finished logging in inside the live-browser panel. Captures and encrypts
// the resulting session, tears the container down.
router.post('/:sessionId/complete', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { sessionId } = req.params;
  try {
    await sessionManager.completeSession(sessionId, userId);
    return res.status(200).json({ success: true, data: { captured: true } });
  } catch (err) {
    const status = err.code === 'NOT_FOUND' ? 404 : 500;
    console.error('[colaberry-login] complete error:', err.message);
    return res.status(status).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message },
    });
  }
});

// POST /api/colaberry-login/:sessionId/cancel — user backed out; tear down
// without capturing anything.
router.post('/:sessionId/cancel', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { sessionId } = req.params;
  try {
    await sessionManager.cancelSession(sessionId, userId);
    return res.status(200).json({ success: true });
  } catch (err) {
    const status = err.code === 'NOT_FOUND' ? 404 : 500;
    console.error('[colaberry-login] cancel error:', err.message);
    return res.status(status).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message },
    });
  }
});

module.exports = router;
