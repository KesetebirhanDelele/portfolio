'use strict';

const fs = require('fs');
const { log } = require('./logger');

// Chromium/Puppeteer processes launched in-process (colaberryProjectScraper.js,
// pdfGenerator.js) have no enforced memory ceiling — unlike the live-login
// sibling containers, which get a hard --memory=1024m via Docker (see
// colaberryLiveLoginSessionManager.js). Containerizing these two call sites
// the same way would be a much larger rewrite, so this is the
// application-level equivalent: poll the browser's own OS process RSS (via
// /proc, since this only ever runs inside the Linux backend container) and
// force-close it if it exceeds a threshold, so one oversized page can't
// consume unbounded host memory. This is a softer guarantee than Docker's
// cgroup limit — a fast enough spike between polls could exceed the
// threshold before it's caught — but it requires no new container/image and
// keeps the fix scoped to these two call sites. DEFAULT_MAX_RSS_MB is a
// reasoned starting point (headless-only, no VNC/Xvfb overhead, so lighter
// than live-login's tested 1024m), not a measured ceiling like live-login's
// — watch for browser_memory_cap_exceeded log events in production and
// adjust HEAVY_BROWSER_MAX_RSS_MB if it trips on legitimate requests.
const DEFAULT_MAX_RSS_MB = Number(process.env.HEAVY_BROWSER_MAX_RSS_MB) || 512;
const DEFAULT_CHECK_INTERVAL_MS = 2000;

function readRssMb(pid) {
  try {
    const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
    const match = status.match(/^VmRSS:\s+(\d+)\s+kB/m);
    return match ? Number(match[1]) / 1024 : null;
  } catch {
    // Process already exited, or /proc unavailable (non-Linux dev machine) —
    // caller treats null as "can't determine," never as "over the limit."
    return null;
  }
}

class ResourceLimitExceededError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ResourceLimitExceeded';
    this.code = 'RESOURCE_LIMIT_EXCEEDED';
  }
}

// Wraps a launched Playwright/Puppeteer `browser` (both expose
// browser.process().pid) with an RSS watchdog. Callers must call
// guard.stop() once done with the browser, in a `finally`, whether the work
// succeeded or not — an unstopped interval leaks and keeps polling a dead
// process. After stopping, check guard.wasKilledForMemory() to distinguish
// a resource-cap kill from an unrelated failure.
function guardBrowser(browser, { label, maxRssMb = DEFAULT_MAX_RSS_MB, checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS } = {}) {
  const pid = browser.process?.()?.pid;
  let killedForMemory = false;

  if (!pid) {
    // No child-process handle (shouldn't happen for a real launch) — guard
    // becomes a no-op rather than blocking the caller on a false negative.
    return { stop() {}, wasKilledForMemory: () => false };
  }

  const interval = setInterval(async () => {
    const rssMb = readRssMb(pid);
    if (rssMb !== null && rssMb > maxRssMb) {
      killedForMemory = true;
      log({
        level: 'warn', event: 'browser_memory_cap_exceeded',
        context: { label, pid, rssMb: Math.round(rssMb), maxRssMb },
      });
      clearInterval(interval);
      try { await browser.close(); } catch { /* already closing/closed */ }
    }
  }, checkIntervalMs);
  interval.unref?.();

  return {
    stop() { clearInterval(interval); },
    wasKilledForMemory: () => killedForMemory,
  };
}

module.exports = { guardBrowser, ResourceLimitExceededError, DEFAULT_MAX_RSS_MB };
