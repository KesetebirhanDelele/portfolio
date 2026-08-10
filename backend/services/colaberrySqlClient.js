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

// Keyword sets defining each network category. Values are fixed constants we
// control (never derived from a request), so string-interpolating the
// category name into SQL below (getNetworkProjectCategories) is safe.
const NETWORK_CATEGORY_KEYWORDS = {
  'Power BI': ['power bi'],
  'DW ETL': ['dw etl', 'data warehouse', 'etl'],
  Qlik: ['qlik'],
  Tableau: ['tableau'],
};

function categoryConditionSql(request, keywords, paramPrefix) {
  const conditions = keywords.map((keyword, index) => {
    const paramName = `${paramPrefix}${index}`;
    request.input(paramName, sql.NVarChar, `%${keyword}%`);
    return `(LOWER(ProjectName) LIKE LOWER(@${paramName}) OR LOWER(ISNULL(ProjectSummary, '')) LIKE LOWER(@${paramName}))`;
  });
  return conditions.join(' OR ');
}

// Colaberry's full catalog of network-deployed projects — not tied to any
// specific user, unlike getProjectLinksForUser above. Ported from
// legacy/portfolioforge-automation/server.js's /api/colaberry/network-projects.
// `category` is only ever used as an object-key lookup below, never
// interpolated into SQL, so an unrecognized value safely falls back to no filter.
async function getNetworkProjects(category = 'All') {
  const pool = await getPool();
  const request = pool.request();
  const keywords = NETWORK_CATEGORY_KEYWORDS[category];
  const categoryCondition = category !== 'All' && keywords
    ? `AND (${categoryConditionSql(request, keywords, 'kw')})`
    : '';

  const result = await request.query(`
    WITH RankedProjects AS (
      SELECT
        projectID, ProjectName, ProjectSummary, ProjectVisual,
        ROW_NUMBER() OVER (
          PARTITION BY LOWER(LTRIM(RTRIM(ProjectName)))
          ORDER BY projectID DESC
        ) AS rowNumber
      FROM dbo.ADF_Proj_Deployed
      WHERE projectID IS NOT NULL
        AND ProjectName IS NOT NULL
        AND LTRIM(RTRIM(ProjectName)) <> ''
        ${categoryCondition}
    )
    SELECT projectID, ProjectName, ProjectSummary, ProjectVisual
    FROM RankedProjects
    WHERE rowNumber = 1
    ORDER BY ProjectName
  `);

  return result.recordset.map(row => ({
    networkId:   Number(row.projectID),
    projectLink: `https://app.colaberry.com/app/network/network/${row.projectID}/projectinstructions`,
    title:       row.ProjectName,
    summary:     row.ProjectSummary || '',
    imageUrl:    row.ProjectVisual || '',
  }));
}

// Per-category counts for the network-projects browser's filter pills.
async function getNetworkProjectCategories() {
  const pool = await getPool();
  const request = pool.request();

  const categoryQueries = Object.entries(NETWORK_CATEGORY_KEYWORDS).map(([name, keywords], catIndex) => {
    const condition = categoryConditionSql(request, keywords, `cat${catIndex}kw`);
    return `
      SELECT '${name.replace(/'/g, "''")}' AS CategoryName,
             COUNT(DISTINCT LOWER(LTRIM(RTRIM(ProjectName)))) AS ProjectCount
      FROM dbo.ADF_Proj_Deployed
      WHERE projectID IS NOT NULL
        AND ProjectName IS NOT NULL
        AND LTRIM(RTRIM(ProjectName)) <> ''
        AND (${condition})
    `;
  });

  const result = await request.query(categoryQueries.join('\nUNION ALL\n'));
  return result.recordset.map(row => ({ name: row.CategoryName, count: Number(row.ProjectCount) }));
}

module.exports = {
  getColaberryUserByEmail, getProjectLinksForUser,
  getNetworkProjects, getNetworkProjectCategories,
};
