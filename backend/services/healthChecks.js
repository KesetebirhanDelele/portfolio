'use strict';

const Redis = require('ioredis');
const pool = require('../db/postgres');
const { getPool: getColaberryPool } = require('./colaberrySqlClient');
const { openaiClient } = require('./openai');

const HEALTH_CHECK_TIMEOUT_MS = 5000;

async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function timedCheck(label, fn) {
  const start = Date.now();
  try {
    await withTimeout(fn(), HEALTH_CHECK_TIMEOUT_MS, label);
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (err) {
    return { status: 'down', latencyMs: Date.now() - start, error: err.message };
  }
}

const checkPostgres = () => timedCheck('postgres', () => pool.query('SELECT 1'));

// BullMQ v6's Queue class doesn't expose its internal ioredis client
// publicly (confirmed against this version's actual type declarations —
// older BullMQ docs describing Queue.client don't apply here), so this is
// its own lazy singleton connection, same pattern as
// colaberrySqlClient.js's getPool(). Same REDIS_URL heavyTaskQueue.js uses.
let redisClient = null;
function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // health check has its own timeout/retry framing — don't let ioredis retry underneath it
    });
    redisClient.on('error', () => {}); // avoid an unhandled 'error' event crash; timedCheck's own catch surfaces the failure
  }
  return redisClient;
}

const checkRedis = () => timedCheck('redis', async () => {
  const client = getRedisClient();
  if (client.status === 'wait' || client.status === 'end') await client.connect();
  await client.ping();
});

// Colaberry's own SQL Server — read-only, optional dependency (only
// touched by the network-projects import feature; the app degrades
// gracefully without it).
const checkColaberryMssql = () => timedCheck('colaberry-mssql', async () => {
  const mssqlPool = await getColaberryPool();
  await mssqlPool.request().query('SELECT 1');
});

// models.list() is a metadata call (no completion generated, no token
// cost) — safe to run on an interval without burning usage budget.
const checkOpenAI = () => timedCheck('openai', () => openaiClient.models.list());

// Required = the app cannot serve any request without these (every route
// touches Postgres; the heavy-task queue touches Redis). Optional = the app
// degrades gracefully — matches how each dependency is actually used
// elsewhere in this codebase, not a guess.
const REQUIRED = ['postgres', 'redis'];

async function runAllHealthChecks() {
  const [postgres, redis, colaberryMssql, openai] = await Promise.all([
    checkPostgres(), checkRedis(), checkColaberryMssql(), checkOpenAI(),
  ]);
  const checks = { postgres, redis, colaberryMssql, openai };

  const requiredDown = REQUIRED.some(name => checks[name].status === 'down');
  const anyDown = Object.values(checks).some(c => c.status === 'down');
  const status = requiredDown ? 'unhealthy' : anyDown ? 'degraded' : 'healthy';

  return { status, checks, timestamp: new Date().toISOString() };
}

module.exports = { runAllHealthChecks, checkPostgres, checkRedis, checkColaberryMssql, checkOpenAI };
