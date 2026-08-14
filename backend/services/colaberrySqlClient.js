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

// Colaberry's full catalog of network-deployed projects — not tied to any
// specific user, unlike getProjectLinksForUser above. Ported from
// legacy/portfolioforge-automation/server.js's /api/colaberry/network-projects,
// then upgraded to match Kalkidan2129/Portfolioforge-automation's later
// version: that build reads from dbo.vw_ADF_Proj_Deployed_WithTags (a view
// joining in Colaberry's real per-project tag metadata) with no server-side
// category filter, and lets the UI search across the real tags instead of a
// handful of hardcoded keyword buckets. The old 4-category LIKE filter
// (Power BI/DW ETL/Qlik/Tableau only) silently hid every project whose name
// or summary didn't literally contain one of those strings — confirmed live
// on 2026-08-14: it surfaced 54 of the catalog's 250 projects. The view
// query returns the same 250 (verified: same row/dedup counts as the base
// table), just enriched with tags, so nothing is filtered out server-side.
async function getNetworkProjects() {
  const pool = await getPool();
  const result = await pool.request().query(`
    WITH RankedProjects AS (
      SELECT
        projectID, ProjectName, ProjectSummary, ProjectVisual, TagNames, TagCategories,
        ROW_NUMBER() OVER (
          PARTITION BY LOWER(LTRIM(RTRIM(ProjectName)))
          ORDER BY projectID DESC
        ) AS rowNumber
      FROM dbo.vw_ADF_Proj_Deployed_WithTags
      WHERE projectID IS NOT NULL
        AND ProjectName IS NOT NULL
        AND LTRIM(RTRIM(ProjectName)) <> ''
    )
    SELECT projectID, ProjectName, ProjectSummary, ProjectVisual, TagNames, TagCategories
    FROM RankedProjects
    WHERE rowNumber = 1
    ORDER BY ProjectName
  `);

  return result.recordset.map(row => ({
    networkId:     Number(row.projectID),
    projectLink:   `https://app.colaberry.com/app/network/network/${row.projectID}/projectinstructions`,
    title:         row.ProjectName,
    summary:       row.ProjectSummary || '',
    imageUrl:      row.ProjectVisual || '',
    tags:          row.TagNames || '',
    tagCategories: row.TagCategories || '',
  }));
}

module.exports = {
  getColaberryUserByEmail, getProjectLinksForUser,
  getNetworkProjects,
};
