'use strict';

const MAX_SAMPLES_PER_GROUP = 500;

// In-memory rolling window per route group (e.g. '/api/repos') — resets on
// restart, same tradeoff as healthMonitor.js. Sized for this app's actual
// traffic (single/few-user scale, per admin.js's own framing), not a
// general-purpose metrics store.
const groups = new Map(); // groupKey -> number[] (durationMs, oldest first)

function routeGroup(path) {
  const parts = path.split('/').filter(Boolean);
  return parts.length >= 2 ? `/${parts[0]}/${parts[1]}` : `/${parts[0] || ''}`;
}

function record(groupKey, durationMs) {
  let arr = groups.get(groupKey);
  if (!arr) {
    arr = [];
    groups.set(groupKey, arr);
  }
  arr.push(durationMs);
  if (arr.length > MAX_SAMPLES_PER_GROUP) arr.shift();
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return Math.round(sorted[idx]);
}

function summarize(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: percentile(sorted, 0.50),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

function getSummary() {
  const byGroup = {};
  for (const [key, arr] of groups.entries()) byGroup[key] = summarize(arr);

  const overallSamples = [...groups.values()].flat();
  return { overall: summarize(overallSamples), byRouteGroup: byGroup };
}

module.exports = { routeGroup, record, getSummary };
