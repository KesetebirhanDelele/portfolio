const crypto = require('crypto');
const { execFile } = require('child_process');
const pool = require('../db/postgres');
const { encrypt: sharedEncrypt, decrypt: sharedDecrypt } = require('./encryption');

const IMAGE = 'colaberry-live-login';
// Was 2 on the original 2 vCPU / 3.7GB host — raised to 4 after the host was
// resized to 4 vCPU / 7.6GB (measured: ~6.8GB available at idle, 0 swap
// configured) on 2026-08-18. At --memory=1024m per session, 4 concurrent
// sessions is up to 4096MB, alongside the heavy-task queue's own memory
// budget (browserResourceGuard.js, heavyTaskQueue.js) — both still draw from
// the same host. This preserves the same worst-case-overcommit ratio the
// original 2-session cap accepted, just scaled to the new capacity. Raise
// further only after the host gets more RAM or per-session memory drops.
const MAX_CONCURRENT_SESSIONS = 4;
const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // matches driver.js's own safety-net timeout
const SWEEP_INTERVAL_MS = 60 * 1000;

// In-memory only — these are ephemeral, short-lived login sessions, not the
// durable artifact. The durable artifact (encrypted storageState) lands in
// the colaberry_sessions table once capture() succeeds.
const sessions = new Map(); // sessionId -> { userId, containerId, vncHostPort, controlHostPort, createdAt, expiresAt, timeoutHandle }

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.trim());
    });
  });
}

async function getAssignedPort(containerId, containerPort) {
  const output = await run('docker', ['port', containerId, String(containerPort)]);
  // output like "127.0.0.1:54231"
  const match = output.match(/:(\d+)\s*$/m);
  if (!match) throw new Error(`Could not determine assigned host port for ${containerPort}`);
  return Number(match[1]);
}

// 60s, not 20s: observed in practice that container boot (Xvfb -> x11vnc ->
// websockify -> Playwright launch -> navigate to COLABERRY_LOGIN_URL) can
// exceed 20s under real host load (multiple other Docker containers
// competing for CPU/disk I/O) even though the container ultimately succeeds
// fine — a container that "failed" at 20s was still observed healthy and
// ready 3+ minutes later. See PROGRESS.md M54.
async function waitForDriverReady(controlHostPort, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${controlHostPort}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        if (data.ready) return;
      }
    } catch { /* not up yet — retry until deadline */ }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Live-login container did not become ready in time.');
}

function activeSessionCountForUser(userId) {
  let count = 0;
  for (const s of sessions.values()) if (s.userId === userId) count++;
  return count;
}

async function startSession(userId, loginUrl) {
  if (sessions.size >= MAX_CONCURRENT_SESSIONS) {
    const err = new Error('Too many live-login sessions in progress. Try again shortly.');
    err.code = 'CAPACITY_EXCEEDED';
    throw err;
  }
  if (activeSessionCountForUser(userId) > 0) {
    const err = new Error('You already have a live-login session in progress.');
    err.code = 'SESSION_EXISTS';
    throw err;
  }

  const sessionId = crypto.randomUUID();
  const containerName = `colaberry-live-${sessionId}`;

  await run('docker', [
    'run', '-d',
    '--name', containerName,
    '-p', '127.0.0.1::6080',
    '-p', '127.0.0.1::7000',
    // 512m was too tight for a real Chrome session (renderer + GPU process +
    // network service) navigating a real modern web app — confirmed live on
    // 2026-08-16: Colaberry's actual site OOM-killed the renderer (Chrome's
    // "Aw, Snap!" page, error code 9 = SIGKILL) mid-login. 1024m/1 cpu was a
    // conservative doubling at the time, not a precise measurement. Doubled
    // again same-day (2026-08-18) to 2048m/2 cpus specifically for a live
    // demo where a single session needs to start and respond fast, not for
    // sustained multi-session throughput — MAX_CONCURRENT_SESSIONS (4) times
    // this new per-session ceiling exceeds total host RAM if ever actually
    // hit concurrently, an overcommit that's fine for a solo demo run today
    // but should be revisited (lower this, or lower session count) before
    // relying on it under real multi-user load.
    '--memory=2048m',
    '--cpus=2',
    '-e', `COLABERRY_LOGIN_URL=${loginUrl}`,
    IMAGE,
  ]);

  let vncHostPort, controlHostPort;
  try {
    vncHostPort = await getAssignedPort(containerName, 6080);
    controlHostPort = await getAssignedPort(containerName, 7000);
    // start.sh brings up Xvfb -> x11vnc -> websockify -> driver.js last, so
    // the driver reporting ready is a reliable signal the whole chain
    // (including the VNC/websocket stack) is actually up, not just Chrome.
    await waitForDriverReady(controlHostPort);
  } catch (err) {
    // Never silently swallow a cleanup failure — if this container didn't
    // actually get removed, it becomes an invisible orphan consuming RAM
    // until its own 10-minute safety-net timeout. Log it so that's
    // diagnosable instead of a mystery next time.
    await run('docker', ['rm', '-f', containerName]).catch(cleanupErr =>
      console.error(`[colaberry-live-login] failed to remove container ${containerName} after startup error:`, cleanupErr.message)
    );
    throw err;
  }

  const createdAt = Date.now();
  const expiresAt = createdAt + SESSION_TIMEOUT_MS;
  const timeoutHandle = setTimeout(() => {
    console.warn(`[colaberry-live-login] session ${sessionId} timed out, forcing cleanup`);
    teardownSession(sessionId).catch(err =>
      console.error(`[colaberry-live-login] timeout cleanup failed for ${sessionId}:`, err.message)
    );
  }, SESSION_TIMEOUT_MS);
  timeoutHandle.unref?.();

  sessions.set(sessionId, {
    userId, containerId: containerName, vncHostPort, controlHostPort,
    createdAt, expiresAt, timeoutHandle,
  });

  const token = issueStreamToken(sessionId, userId, expiresAt);
  return { sessionId, token, expiresAt };
}

function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

// Browser WebSocket connections can't carry Authorization headers, so the
// stream endpoint is authorized via a signed, short-lived token in the URL
// instead — self-contained (sessionId + userId + expiry), verified with
// JWT_SECRET, timing-safe compared. Reusing JWT_SECRET here (not the DB
// encryption key) since this token never touches storage, only a URL.
function issueStreamToken(sessionId, userId, expiresAt) {
  const payload = `${sessionId}:${userId}:${expiresAt}`;
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyStreamToken(token) {
  let decoded;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const parts = decoded.split(':');
  if (parts.length !== 4) return null;
  const [sessionId, userId, expiresAtStr, sig] = parts;
  const payload = `${sessionId}:${userId}:${expiresAtStr}`;
  const expectedSig = crypto.createHmac('sha256', process.env.JWT_SECRET).update(payload).digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  if (Date.now() > Number(expiresAtStr)) return null;
  return { sessionId, userId, expiresAt: Number(expiresAtStr) };
}

async function teardownSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  clearTimeout(session.timeoutHandle);
  sessions.delete(sessionId);

  // best-effort graceful close, then force-remove regardless
  try {
    await fetch(`http://127.0.0.1:${session.controlHostPort}/close`, { method: 'POST', signal: AbortSignal.timeout(3000) });
  } catch { /* container may already be gone or unresponsive — fall through to force-remove */ }

  await run('docker', ['rm', '-f', session.containerId]).catch(err =>
    console.error(`[colaberry-live-login] failed to remove container ${session.containerId}:`, err.message)
  );
}

async function completeSession(sessionId, userId) {
  const session = sessions.get(sessionId);
  if (!session || session.userId !== userId) {
    const err = new Error('Session not found.');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const key = process.env.COLABERRY_SESSION_ENCRYPTION_KEY;
  if (!key) throw new Error('COLABERRY_SESSION_ENCRYPTION_KEY is not configured.');

  let storageState;
  try {
    const res = await fetch(`http://127.0.0.1:${session.controlHostPort}/capture`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`capture endpoint returned ${res.status}`);
    const data = await res.json();
    storageState = data.storageState;
  } finally {
    await teardownSession(sessionId);
  }

  const { payload, iv } = sharedEncrypt(JSON.stringify(storageState), key);

  await pool.query(
    `INSERT INTO colaberry_sessions (user_id, encrypted_storage_state, encryption_iv, captured_at, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       encrypted_storage_state = EXCLUDED.encrypted_storage_state,
       encryption_iv            = EXCLUDED.encryption_iv,
       captured_at               = NOW(),
       updated_at                = NOW()`,
    [userId, payload, iv]
  );

  return { captured: true };
}

async function cancelSession(sessionId, userId) {
  const session = sessions.get(sessionId);
  if (!session || session.userId !== userId) {
    const err = new Error('Session not found.');
    err.code = 'NOT_FOUND';
    throw err;
  }
  await teardownSession(sessionId);
}

// Defense in depth beyond the per-session setTimeout, in case the process
// itself hiccups — sweeps for anything past its expiry.
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      console.warn(`[colaberry-live-login] sweep found stale session ${sessionId}, cleaning up`);
      teardownSession(sessionId).catch(err =>
        console.error(`[colaberry-live-login] sweep cleanup failed for ${sessionId}:`, err.message)
      );
    }
  }
}, SWEEP_INTERVAL_MS).unref?.();

function decryptStorageState(row, keyHex) {
  return JSON.parse(sharedDecrypt(row.encrypted_storage_state, row.encryption_iv, keyHex));
}

// Run once at backend startup. If the process previously crashed or
// restarted, any containers it was tracking in memory are now orphaned —
// driver.js's own 10-minute safety-net will eventually self-terminate them,
// but there's no reason to wait for that just to tidy up.
async function cleanupOrphanedContainers() {
  try {
    const output = await run('docker', ['ps', '-a', '--filter', 'name=colaberry-live-', '--format', '{{.Names}}']);
    const names = output.split('\n').map(s => s.trim()).filter(Boolean);
    for (const name of names) {
      console.warn(`[colaberry-live-login] removing orphaned container from a previous run: ${name}`);
      await run('docker', ['rm', '-f', name]).catch(err =>
        console.error(`[colaberry-live-login] failed to remove orphaned container ${name}:`, err.message)
      );
    }
  } catch (err) {
    console.error('[colaberry-live-login] orphan cleanup sweep failed:', err.message);
  }
}

module.exports = {
  cleanupOrphanedContainers,
  startSession, getSession, completeSession, cancelSession, teardownSession,
  decryptStorageState, verifyStreamToken,
};
