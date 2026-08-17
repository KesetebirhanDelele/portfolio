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

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const outcome = res.statusCode >= 500 ? 'failure' : res.statusCode >= 400 ? 'partial' : 'success';
    const groupKey = latencyTracker.routeGroup(req.path);

    latencyTracker.record(groupKey, durationMs);

    log({
      level: outcome === 'failure' ? 'error' : 'info',
      event: 'http_request',
      correlationId,
      durationMs: Math.round(durationMs),
      outcome,
      context: { method: req.method, path: req.path, statusCode: res.statusCode },
    });
  });

  next();
}

module.exports = requestTiming;
