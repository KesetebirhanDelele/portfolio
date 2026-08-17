'use strict';

const crypto = require('crypto');
const { log } = require('../services/logger');
const latencyTracker = require('../services/latencyTracker');

// Correlation ID + duration logging for every request (Observability
// Framework, Tier 1) — propagates an inbound X-Correlation-ID if the caller
// already set one, generates one otherwise. Also feeds latencyTracker.js's
// in-memory p50/p95/p99 rollup, surfaced on the admin dashboard.
function requestTiming(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  const start = process.hrtime.bigint();
  // req.originalUrl is set once and never mutated as Express descends into
  // sub-routers — req.path/req.url get progressively stripped of their
  // mount-point prefix at each level (e.g. inside colaberryLiveLoginRouter,
  // req.path for POST /api/colaberry-login/start reads back as just
  // '/start'). Reading req.path here — after routing has fully run, since
  // this fires on res.on('finish') — silently recorded every sub-routed
  // request under its innermost relative path, breaking both the log
  // output and latencyTracker's route grouping. Capture the real full path
  // (stripped of any query string) up front instead.
  const fullPath = req.originalUrl.split('?')[0];

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const outcome = res.statusCode >= 500 ? 'failure' : res.statusCode >= 400 ? 'partial' : 'success';
    const groupKey = latencyTracker.routeGroup(fullPath);

    latencyTracker.record(groupKey, durationMs);

    log({
      level: outcome === 'failure' ? 'error' : 'info',
      event: 'http_request',
      correlationId,
      durationMs: Math.round(durationMs),
      outcome,
      context: { method: req.method, path: fullPath, statusCode: res.statusCode },
    });
  });

  next();
}

module.exports = requestTiming;
