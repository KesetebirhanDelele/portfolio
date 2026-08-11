// Error tracking (observability Tier 2) — dormant by default. Wiring is in
// place so error visibility is one env var away, but nothing is sent
// anywhere until SENTRY_DSN is actually set: no Sentry account exists for
// this project yet, and creating one isn't something to do on someone
// else's behalf. Get a free-tier DSN from sentry.io and set SENTRY_DSN to
// turn this on — no code changes needed at that point.
const Sentry = require('@sentry/node');
const { log } = require('./logger');

const enabled = Boolean(process.env.SENTRY_DSN);

function initErrorTracking() {
  if (!enabled) {
    log({ event: 'error_tracking_disabled', context: { reason: 'SENTRY_DSN not set' } });
    return;
  }
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0, // error capture only — no performance tracing at this scale
  });
  log({ event: 'error_tracking_enabled' });
}

// Must be called after all routes are registered, before any custom error
// middleware — this is what actually forwards unhandled request errors to
// Sentry. A no-op when disabled.
function setupExpressErrorHandler(app) {
  if (!enabled) return;
  Sentry.setupExpressErrorHandler(app);
}

// For errors that never pass through Express at all — background queue job
// failures (heavyTaskQueue.js), startup errors. A no-op when disabled.
function captureException(err, context) {
  if (!enabled) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

module.exports = { initErrorTracking, setupExpressErrorHandler, captureException, isEnabled: () => enabled };
