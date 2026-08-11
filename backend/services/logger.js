// Minimal structured-log helper (observability Tier 1). Not a wholesale
// replacement of every console.log in the codebase — that would be a huge,
// low-value diff. This exists for the handful of places that actually need
// operational visibility: heavy-operation entry/exit/failure, rate-limit
// hits, and queue job lifecycle (Tier 2). Everything else keeps using plain
// console.log/console.error as before.
//
// One JSON object per line to stdout — greppable/jq-able without a logging
// service, and upgradeable later (e.g. to Sentry breadcrumbs or a log
// shipper) without touching call sites, since they only depend on this
// function's signature.
function log({ level = 'info', event, correlationId, durationMs, outcome, errorClass, context, ...extra }) {
  // Supports both call styles: log({ event, context: {...} }) and
  // log({ event, someField: 'x' }) — merged into one context object so a
  // caller passing an explicit `context` key doesn't end up double-nested
  // inside the rest-spread of everything else.
  const mergedContext = { ...(context || {}), ...extra };
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(correlationId !== undefined ? { correlationId } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(outcome !== undefined ? { outcome } : {}),
    ...(errorClass !== undefined ? { errorClass } : {}),
    ...(Object.keys(mergedContext).length ? { context: mergedContext } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

module.exports = { log };
