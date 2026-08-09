// Runs inside the live-login container. Launches a real, visible Chrome under
// the container's Xvfb display (streamed out to the user via VNC/noVNC), and
// exposes a tiny internal control API for the backend's session-manager to
// call — never exposed outside the container's Docker network.
const express = require('express');
const { chromium } = require('playwright-core');

const CONTROL_PORT = process.env.CONTROL_PORT || 7000;
const LOGIN_URL = process.env.COLABERRY_LOGIN_URL;

if (!LOGIN_URL) {
  console.error('[driver] COLABERRY_LOGIN_URL is required');
  process.exit(1);
}

let browser, context, page;
let ready = false;

async function start() {
  browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,800',
      '--window-position=0,0',
      '--disable-infobars',
    ],
  });
  context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  page = await context.newPage();
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  ready = true;
  console.log('[driver] browser ready, navigated to login URL');
}

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ready });
});

app.get('/status', async (req, res) => {
  if (!ready) return res.status(503).json({ ready: false });
  try {
    res.json({ ready: true, url: page.url() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Called once the human confirms (via the R2R UI) that they've finished
// logging in. Captures cookies/storage directly through Playwright's own
// context API — never reads document.cookie, so HttpOnly session cookies
// are captured correctly.
app.post('/capture', async (req, res) => {
  if (!ready) return res.status(503).json({ error: 'Browser not ready.' });
  try {
    const storageState = await context.storageState();
    res.json({ storageState, url: page.url() });
  } catch (err) {
    console.error('[driver] capture failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/close', async (req, res) => {
  res.json({ closing: true });
  try {
    await browser.close();
  } catch (err) {
    console.error('[driver] close error:', err.message);
  }
  process.exit(0);
});

app.listen(CONTROL_PORT, '0.0.0.0', () => {
  console.log(`[driver] control API listening on :${CONTROL_PORT}`);
});

start().catch(err => {
  console.error('[driver] failed to start browser:', err.message);
  process.exit(1);
});

// Safety net: never let a session outlive its purpose indefinitely even if
// the backend forgets to call /close (e.g., crashed, network partition).
const MAX_SESSION_MS = 10 * 60 * 1000; // 10 minutes
setTimeout(() => {
  console.error('[driver] max session lifetime reached, forcing exit');
  process.exit(1);
}, MAX_SESSION_MS);
