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
    // PARTITION BY projectID, not by normalized name — confirmed live
    // (2026-08-17) that Colaberry's own view has projectID 1443 under two
    // DIFFERENT ProjectName records ("Human Resource Dashboard" and a
    // shorter "Human Resources"), a data artifact on Colaberry's side, not
    // a naming coincidence. Partitioning by name alone let both survive as
    // separate rowNumber=1 rows sharing one projectID — which becomes a
    // React key collision downstream (networkId is projectID), causing
    // real, hard-to-diagnose duplicate rendering and filter-matching bugs
    // in production (React only warns about duplicate keys in dev builds).
    // Deduping by projectID instead is strictly safer: it still keeps
    // genuinely distinct projects that happen to share a title (different
    // projectIDs, never collapsed against each other), while guaranteeing
    // each projectID can only ever produce one row/key downstream. Ties
    // prefer the longer name — the more complete/final title, not a
    // possibly-stale shorter one.
    pool.request().query(`
      WITH RankedProjects AS (
        SELECT
          projectID, ProjectName, ProjectSummary, ProjectVisual,
          ROW_NUMBER() OVER (
            PARTITION BY projectID
            ORDER BY LEN(LTRIM(RTRIM(ProjectName))) DESC, ProjectName DESC
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

// Full detail for one deployed project, by projectID — the SQL-only
// replacement for what colaberryProjectScraper.js used to pull from the
// live page (title, description, image, deployment link). Same source
// table as getNetworkProjects above, scoped to a single project instead of
// the whole catalog. Returns null if the project isn't in the deployed
// catalog at all — the SQL-only import path (see PROGRESS.md M101) treats
// that as a real "not found," not a fallback trigger.
//
// A handful of projectIDs have more than one row in ADF_Proj_Deployed
// (261 total rows vs 253 distinct IDs, confirmed during the M101
// investigation) — ORDER BY Updated DESC takes the most recently edited one.
async function getProjectDetailsById(projectId) {
  const pool = await getPool();
  const [projectResult, tagsResult] = await Promise.all([
    pool.request()
      .input('projectId', sql.Int, projectId)
      .query(`
        SELECT TOP 1 projectID, ProjectName, ProjectSummary, ProjectVisual, HtmlCode
        FROM dbo.ADF_Proj_Deployed
        WHERE projectID = @projectId
          AND HtmlCode IS NOT NULL AND LEN(HtmlCode) > 0
        ORDER BY Updated DESC
      `),
    pool.request()
      .input('projectId', sql.Int, projectId)
      .query(`
        SELECT DISTINCT TagName
        FROM dbo.vw_ADF_CCS_ProjectTags_New_Catgorize
        WHERE ProjectID = @projectId
          AND TagStatus = 1
          AND TagCategory IS NOT NULL AND TagCategory <> 'DO NOT USE'
          AND TagName IS NOT NULL AND LTRIM(RTRIM(TagName)) <> ''
      `),
  ]);
  const row = projectResult.recordset[0];
  if (!row) return null;
  return {
    networkId:           Number(row.projectID),
    title:               row.ProjectName,
    description:         row.ProjectSummary || '',
    imageUrl:            row.ProjectVisual || '',
    deploymentEmbedHtml: row.HtmlCode,
    tags:                tagsResult.recordset.map(t => t.TagName.trim()),
  };
}

// Step-by-step content for one project, sourced from the CMS table
// Colaberry's own project authors use to build the "Step By Step" page —
// dbo.ADF_CCS_ProjectQuestions. PQ_TypeID meanings (from the
// dbo.ADF_CCS_QuestionType lookup table, confirmed during the M101
// investigation): 1 = Step Name, 3 = Detailed Instructions, 5 = Insight.
// (2/4/6/7 — order/screenshot/code file/data file — carry no reusable text
// for this catalog and are skipped.) Values are stored as author-pasted
// HTML fragments, not rendered page text, so they still need converting to
// plain text — see colaberryStepContentBuilder.js.
async function getProjectStepsById(projectId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('projectId', sql.Int, projectId)
    .query(`
      SELECT PQ_Order, PQ_TypeID, PQ_Value
      FROM dbo.ADF_CCS_ProjectQuestions
      WHERE PQ_ProjectID = @projectId AND PQ_TypeID IN (1, 3, 5)
      ORDER BY PQ_Order, PQ_TypeID
    `);

  const stepsByOrder = new Map();
  for (const row of result.recordset) {
    const order = Number(row.PQ_Order);
    if (!stepsByOrder.has(order)) {
      stepsByOrder.set(order, { stepNumber: order, title: '', instructionsHtml: '', insightHtml: '' });
    }
    const step = stepsByOrder.get(order);
    if (row.PQ_TypeID === 1) step.title = (row.PQ_Value || '').trim();
    else if (row.PQ_TypeID === 3) step.instructionsHtml = row.PQ_Value || '';
    else if (row.PQ_TypeID === 5) step.insightHtml = row.PQ_Value || '';
  }
  return [...stepsByOrder.values()].sort((a, b) => a.stepNumber - b.stepNumber);
}

module.exports = {
  getColaberryUserByEmail, getProjectLinksForUser,
  getNetworkProjects,
  getProjectDetailsById, getProjectStepsById,
  getPool, // exposed for healthChecks.js's read-only connectivity probe
};
