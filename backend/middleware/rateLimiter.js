// Rate limiting (observability Tier 1) — scoped to the routes that actually
// cost real money or real host resources (OpenAI calls, Playwright browser
// launches), not applied globally. A global limiter would just as easily
// block legitimate use of cheap CRUD endpoints while doing nothing extra to
// protect the expensive ones.
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { log } = require('../services/logger');

function handler(req, res) {
  log({ level: 'warn', event: 'rate_limit_exceeded', context: { path: req.originalUrl, userId: req.user?.id || null } });
  res.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait before trying again.' },
  });
}

// Keyed by user id when authenticated (authMiddleware runs first on every
// route this is applied to) so one user's usage can't exhaust another
// user's allowance; falls back to IP for the rare unauthenticated case.
// The IP fallback goes through express-rate-limit's own ipKeyGenerator
// helper so IPv6 addresses are normalized to a /64 subnet — otherwise a
// client can trivially rotate the low bits of an IPv6 address to bypass
// the limit entirely.
function keyGenerator(req) {
  return req.user?.id || ipKeyGenerator(req.ip);
}

// Playwright launches (Colaberry import) and multi-phase OpenAI pipelines
// (deep analysis) — the most resource/cost-heavy operations in the app.
const heavyOperationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler,
});

// Single-call OpenAI generation endpoints — cheaper than the above but
// still real API spend if hit in a loop (e.g. a buggy retry, a script).
const generationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler,
});

module.exports = { heavyOperationLimiter, generationLimiter };
