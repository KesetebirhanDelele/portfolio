// Unauthenticated by design — this is what Docker's healthcheck and any
// future external uptime pinger hit. Deliberately minimal response: status
// and latency per dependency only, no error text (which could leak
// internal hostnames/connection detail) — the full detail (including error
// messages) is only ever surfaced on the admin-authenticated stats route
// via healthMonitor.js.
const express = require('express');
const { runAllHealthChecks } = require('../services/healthChecks');

const router = express.Router();

router.get('/', async (req, res) => {
  const result = await runAllHealthChecks();
  const httpStatus = result.status === 'unhealthy' ? 503 : 200;
  const sanitizedChecks = Object.fromEntries(
    Object.entries(result.checks).map(([name, c]) => [name, { status: c.status, latencyMs: c.latencyMs }])
  );
  res.status(httpStatus).json({ status: result.status, checks: sanitizedChecks, timestamp: result.timestamp });
});

module.exports = router;
