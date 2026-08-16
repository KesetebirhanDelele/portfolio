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
//
// TagNames/TagCategories on that view are each a DISTINCT-aggregated flat
// list per project, with the pairing between an individual tag and its
// category bucket already lost by the time it reaches this app. Since there
// are only 3 real buckets system-wide ("Category"/"Industry"/"Tools"),
// almost every project has tags in all 3 — so a category facet built on that
// column can't meaningfully narrow anything, and can't narrow the tag list
// either. Confirmed live on 2026-08-16 (246/250 projects had all 3).
// vw_ADF_CCS_ProjectTags_New_Catgorize has the real per-(project, tag)
// TagCategory pairing (249/250 deployed projects covered) — used below to
// build tagsByCategory so the UI can do a real cascading facet. TagStatus
// 0/null rows are retired tags; "DO NOT USE" is a housekeeping category, not
// a real one — both excluded.
async function getNetworkProjects() {
  const pool = await getPool();
  const [projectsResult, tagsResult] = await Promise.all([
    pool.request().query(`
      WITH RankedProjects AS (
        SELECT
          projectID, ProjectName, ProjectSummary, ProjectVisual,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(LTRIM(RTRIM(ProjectName)))
            ORDER BY projectID DESC
          ) AS rowNumber
        FROM dbo.vw_ADF_Proj_Deployed_WithTags
        WHERE projectID IS NOT NULL
          AND ProjectName IS NOT NULL
          AND LTRIM(RTRIM(ProjectName)) <> ''
      )
      SELECT projectID, ProjectName, ProjectSummary, ProjectVisual
      FROM RankedProjects
      WHERE rowNumber = 1
      ORDER BY ProjectName
    `),
    pool.request().query(`
      SELECT DISTINCT ProjectID, TagCategory, TagName
      FROM dbo.vw_ADF_CCS_ProjectTags_New_Catgorize
      WHERE TagStatus = 1
        AND TagCategory IS NOT NULL AND TagCategory <> 'DO NOT USE'
        AND TagName IS NOT NULL AND LTRIM(RTRIM(TagName)) <> ''
    `),
  ]);

  const tagsByProjectId = new Map();
  for (const row of tagsResult.recordset) {
    const pid = Number(row.ProjectID);
    const category = row.TagCategory.trim();
    const tagName = row.TagName.trim();
    if (!tagsByProjectId.has(pid)) tagsByProjectId.set(pid, {});
    const buckets = tagsByProjectId.get(pid);
    if (!buckets[category]) buckets[category] = [];
    if (!buckets[category].includes(tagName)) buckets[category].push(tagName);
  }

  return projectsResult.recordset.map(row => {
    const pid = Number(row.projectID);
    const tagsByCategory = tagsByProjectId.get(pid) || {};
    const allTags = Object.values(tagsByCategory).flat();
    return {
      networkId:     pid,
      projectLink:   `https://app.colaberry.com/app/network/network/${row.projectID}/projectinstructions`,
      title:         row.ProjectName,
      summary:       row.ProjectSummary || '',
      imageUrl:      row.ProjectVisual || '',
      tags:          allTags.join(', '),
      tagsByCategory,
    };
  });
}

module.exports = {
  getColaberryUserByEmail, getProjectLinksForUser,
  getNetworkProjects,
};
