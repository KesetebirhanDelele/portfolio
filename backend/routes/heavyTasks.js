'use strict';

const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getQueuePosition } = require('../services/heavyTaskQueue');

const router = express.Router();

// GET /api/heavy-tasks/:jobId/status — polled by clients waiting on a
// fire-and-forget heavy-task job (currently: Colaberry import,
// colaberryImport.js) to show "you're #N in line, ~Xs" instead of holding
// one HTTP connection open for the queue's 10-minute default timeout. See
// PROGRESS.md M89.
//
// Ownership: jobs enqueued by authenticated flows carry `userId` in their
// data — enforced below so one user can't poll another's job. A job with no
// userId in its data (none currently route through this endpoint) is
// treated as ownerless and returned to any authenticated caller; if an
// anonymous flow is ever wired to this endpoint, it will need its own
// bearer-token scheme instead (see colaberryLiveLoginSessionManager.js's
// stream-token pattern for the precedent).
router.get('/:jobId/status', authMiddleware, async (req, res) => {
  try {
    const info = await getQueuePosition(req.params.jobId);
    if (!info) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found.' } });
    }
    if (info.userId && info.userId !== req.user.id) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found.' } });
    }
    const { userId, ...publicInfo } = info;
    return res.status(200).json({ success: true, data: publicInfo });
  } catch (err) {
    console.error('[heavy-tasks] status error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch job status.' } });
  }
});

module.exports = router;
