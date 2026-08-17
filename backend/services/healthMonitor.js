'use strict';

const { runAllHealthChecks } = require('./healthChecks');
const { log } = require('./logger');

const SAMPLE_INTERVAL_MS = 30 * 1000;
const RETENTION_MS = 24 * 60 * 60 * 1000; // keep 24h of samples

// In-memory only, by design: resets on every restart/deploy, so "uptime"
// here means "uptime since this backend process last started," not a
// durable historical record. Self-reported — if the backend process itself
// is fully down, it can't record that; an external synthetic pinger would
// close that gap but wasn't in scope for this pass (2026-08-16).
let samples = []; // { timestamp: number, status: 'healthy'|'degraded'|'unhealthy' }
let latestFullResult = null;
let timer = null;

function prune(now) {
  const cutoff = now - RETENTION_MS;
  while (samples.length > 0 && samples[0].timestamp < cutoff) samples.shift();
}

async function sampleOnce() {
  const result = await runAllHealthChecks();
  latestFullResult = result;
  const now = Date.now();
  samples.push({ timestamp: now, status: result.status });
  prune(now);
  if (result.status !== 'healthy') {
    log({
      level: result.status === 'unhealthy' ? 'error' : 'warn',
      event: 'health_check_degraded',
      outcome: result.status === 'unhealthy' ? 'failure' : 'partial',
      context: { checks: result.checks },
    });
  }
}

function start() {
  if (timer) return; // idempotent — a second call is a no-op, not a second interval
  const runAndLog = () => sampleOnce().catch(err =>
    log({ level: 'error', event: 'health_monitor_sample_failed', context: { message: err.message } })
  );
  runAndLog();
  timer = setInterval(runAndLog, SAMPLE_INTERVAL_MS);
  timer.unref?.();
}

function uptimePctSince(now, windowMs) {
  const cutoff = now - windowMs;
  const windowSamples = samples.filter(s => s.timestamp >= cutoff);
  if (windowSamples.length === 0) return null;
  const healthyCount = windowSamples.filter(s => s.status !== 'unhealthy').length;
  return (healthyCount / windowSamples.length) * 100;
}

function getUptimeSummary() {
  const now = Date.now();
  return {
    uptimePercent1h:  uptimePctSince(now, 60 * 60 * 1000),
    uptimePercent24h: uptimePctSince(now, RETENTION_MS),
    sampleCount: samples.length,
    since: samples.length > 0 ? new Date(samples[0].timestamp).toISOString() : null,
  };
}

function getLatestResult() {
  return latestFullResult;
}

module.exports = { start, getUptimeSummary, getLatestResult };
