const sql = require('mssql');

// Read-only client for Colaberry's own student/project SQL Server.
// Ported from legacy/portfolioforge-automation/server.js — narrowed to two
// parameterized, read-only queries. No writes, ever.

const sqlConfig = {
  server:   process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user:     process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  connectionTimeout: 10000,
  requestTimeout: 15000,
};

let poolPromise = null;
function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(sqlConfig).catch(err => {
      poolPromise = null; // allow retry on next call instead of caching a dead connection
      throw err;
    });
  }
  return poolPromise;
}

// Look up a Colaberry UserID by email — NEVER by a client-supplied ID, so a
// logged-in R2R user can only ever pull their own Colaberry projects.
async function getColaberryUserByEmail(email) {
  const pool = await getPool();
  const result = await pool.request()
    .input('email', sql.NVarChar, email)
    .query(`
      SELECT UserID, FirstName, LastName, Email
      FROM dbo.ADF_ColaberryActiveUsers
      WHERE Email = @email
    `);
  return result.recordset[0] || null;
}

// Project upload links for a verified Colaberry UserID.
async function getProjectLinksForUser(userId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT
        p.UserID,
        a.CAP_Launch_UploadLink
      FROM dbo.ADF_CAP_Launch_Participants p
      INNER JOIN dbo.ADF_CAP_Launch_Activity a
        ON p.CAP_Launch_ParticipantID = a.CAP_Launch_ParticipantID
      WHERE p.UserID = @userId
        AND a.CAP_Launch_UploadLink LIKE '%/app/network/network/%'
        AND a.CAP_Launch_UploadLink LIKE '%projectinstructions%'
    `);
  return result.recordset.map(row => row.CAP_Launch_UploadLink);
}

module.exports = { getColaberryUserByEmail, getProjectLinksForUser };
