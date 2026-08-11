const { Pool } = require('pg');

// Pool sizing/timeouts (observability Tier 1): previously unbounded — `pg`
// silently defaulted to max 10 connections with no statement/connection
// timeout, so a stuck query or a burst of requests had no configured limit
// to fail loudly against. Explicit here so the ceiling is a documented
// decision, not an accidental default.
const pool = new Pool({
  ...(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: 'postgres',
        host: 'localhost',
        database: 'repo2reputation',
        password: process.env.DB_PASSWORD,
        port: 5432,
      }),
  max: Number(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
});

pool.on('error', (err) => {
  // Idle clients emit background errors (e.g. connection dropped by the
  // server) that would otherwise crash the process as an uncaught
  // exception — pg's documented pattern for handling them.
  console.error('[postgres] idle client error:', err.message);
});

// pool.query() (not pool.connect()) so the startup connectivity check
// acquires and releases a client automatically — the previous version called
// pool.connect(callback) and discarded the `client`/`release` args, which
// leaked one checked-out connection for the entire life of the process
// (silently shrinking the effective pool by one).
pool.query('SELECT 1', (err) => {
  if (err) {
    console.error('PostgreSQL connection failed:', err.message);
  } else {
    console.log('PostgreSQL connected successfully');
  }
});

module.exports = pool;
