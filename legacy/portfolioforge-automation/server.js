require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const { chromium } = require('playwright');
const sql = require('mssql');

const app = express();

app.use(cors());
app.use(express.json());
const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

let portfolioStatus = {
  step: 'Idle',
  completed: false,
  failed: false,
  error: '',
  portfolioUrl: ''
};

app.get('/portfolio-status', (req, res) => {
  res.json(portfolioStatus);
});

app.post('/generate-portfolio', async (req, res) => {
  let formData = req.body;
if ((!formData.projectLinks || formData.projectLinks.length === 0) && formData.userId) {
  const pool = await sql.connect(sqlConfig);

  const studentResult = await pool.request()
    .input('userId', sql.Int, Number(formData.userId))
    .query(`
      SELECT UserID, FirstName, LastName, Email
      FROM dbo.ADF_ColaberryActiveUsers
      WHERE UserID = @userId
    `);

  const projectsResult = await pool.request()
    .input('userId', sql.Int, Number(formData.userId))
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

  const student = studentResult.recordset[0];

  formData = {
    ...formData,
    fullName: student ? `${student.FirstName} ${student.LastName}` : formData.fullName,
    email: student?.Email || formData.email,
    projectLinks: projectsResult.recordset.map(row => row.CAP_Launch_UploadLink)
  };
}  

  console.log('Portfolio Request Received:');
  console.log(formData);

  console.log('Portfolio mode:', formData.portfolioMode || 'create');

  fs.writeFileSync(
    'ui-portfolio-request.json',
    JSON.stringify(formData, null, 2)
  );

  portfolioStatus = {
    step: 'Starting portfolio generation...',
    completed: false,
    failed: false,
    error: '',
    portfolioUrl: ''
};

  console.log('OAuth publish values:', {
  username: connectedGithubUser || 'MISSING_USERNAME',
  tokenPreview: githubOAuthToken ? githubOAuthToken.substring(0, 8) + '...' : 'MISSING_TOKEN',
  repoName: formData.repoName || 'MISSING_REPO'
  });

const generator = spawn('node', ['src/index.js'], {
  shell: true,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: {
    ...process.env,
    GITHUB_USERNAME: connectedGithubUser,
    GITHUB_TOKEN: githubOAuthToken,
    GITHUB_REPO_NAME: formData.repoName
  }
});

  generator.stdout.on('data', (data) => {
  const message = data.toString();

  console.log(message);

  if (message.includes('Starting browser')) {
    portfolioStatus.step = '✓ Browser launched';
  }

  if (message.includes('Loaded student profile')) {
    portfolioStatus.step = '✓ Student profile loaded';
  }

  if (message.includes('Loaded project links')) {
    portfolioStatus.step = '✓ Project links loaded';
  }

  if (message.includes('Processing project')) {
    portfolioStatus.step = '⏳ Extracting project data...';
  }

  if (message.includes('Project page loaded')) {
    portfolioStatus.step = '⏳ Reading project content...';
  }

  if (message.includes('README saved')) {
    portfolioStatus.step = '⏳ Generating portfolio content...';
  }

  if (message.includes('Main portfolio README saved')) {
    portfolioStatus.step = '⏳ Building portfolio page...';
  }

  if (message.includes('Copying generated portfolio files')) {
    portfolioStatus.step = '⏳ Publishing to GitHub...';
  }

  if (message.includes('Portfolio generated successfully')) {
    portfolioStatus.step = 'Portfolio generated successfully!';
    portfolioStatus.completed = true;
  }

  if (message.includes('View your portfolio here:')) {
    const match = message.match(/https?:\/\/\S+/);

    if (match) {
      portfolioStatus.portfolioUrl = match[0];
      portfolioStatus.step = `Portfolio completed! View it here: ${match[0]}`;
      portfolioStatus.completed = true;
    }
  }
});

  let generatorError = '';

generator.stderr.on('data', (data) => {
  const errorText = data.toString();

  generatorError += errorText;
  console.error(errorText);
});

generator.on('close', (exitCode) => {
  if (exitCode !== 0) {
    let userMessage =
      'Portfolio generation failed. Please try again.';

    if (
      generatorError.includes('Invalid username or token') ||
      generatorError.includes('Authentication failed')
    ) {
      userMessage =
        'GitHub authentication failed. Please reconnect your GitHub account and try again.';
    }

    portfolioStatus = {
      step: 'Portfolio generation failed',
      completed: false,
      failed: true,
      error: userMessage,
      portfolioUrl: ''
    };

    console.error(
      `Portfolio generator exited with code ${exitCode}: ${userMessage}`
    );
  }
});

  res.json({
    success: true,
    message: 'Portfolio generation started.'
  });
});

app.get('/auth/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;

  const githubAuthUrl =
    `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo`;

  res.redirect(githubAuthUrl);
});

let githubOAuthToken = '';
let connectedGithubUser = '';

app.get('/auth/github/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.send('GitHub authorization failed. No code received.');
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      })
    });

    const tokenData = await tokenResponse.json();

    githubOAuthToken = tokenData.access_token;

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${githubOAuthToken}`,
        Accept: 'application/vnd.github+json'
      }
    });

    const userData = await userResponse.json();
    connectedGithubUser = userData.login;

    res.send(`
<html>
<body style="
  font-family: Arial;
  text-align:center;
  padding-top:40px;
">
  <h3>✅ GitHub Connected</h3>
  <p>${connectedGithubUser}</p>

  <script>
    setTimeout(() => {
      window.close();
    }, 1000);
  </script>
</body>
</html>
`);

  } catch (error) {
    console.error(error);
    res.send('GitHub connection failed.');
  }
});

app.get('/auth/github/status', (req, res) => {
  res.json({
    connected: Boolean(githubOAuthToken && connectedGithubUser),
    username: connectedGithubUser
  });
});

app.get('/api/db-test', async (req, res) => {
  try {
    const pool = await sql.connect(sqlConfig);

    const result = await pool.request().query(`
      SELECT TOP 1
        UserID,
        FirstName,
        LastName,
        Email
      FROM dbo.ADF_ColaberryActiveUsers
    `);

    res.json({
      connected: true,
      sample: result.recordset[0]
    });
  } catch (error) {
    console.error('Database test failed:', error.message);

    res.status(500).json({
      connected: false,
      error: error.message
    });
  }
});

app.get('/api/student/:userId', async (req, res) => {
  try {
    const pool = await sql.connect(sqlConfig);

    const result = await pool.request()
      .input('userId', sql.Int, Number(req.params.userId))
      .query(`
        SELECT
          UserID,
          FirstName,
          LastName,
          Email
        FROM dbo.ADF_ColaberryActiveUsers
        WHERE UserID = @userId
      `);

    res.json({
      found: result.recordset.length > 0,
      student: result.recordset[0] || null
    });
  } catch (error) {
    res.status(500).json({
      found: false,
      error: error.message
    });
  }
});

app.get('/api/student/:userId/projects', async (req, res) => {
  try {
    const pool = await sql.connect(sqlConfig);

    const result = await pool.request()
      .input('userId', sql.Int, Number(req.params.userId))
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

    const projects = result.recordset.map((row) => {
  const match = row.CAP_Launch_UploadLink.match(/network\/(\d+)\/projectinstructions/);

  return {
    userId: row.UserID,
    networkId: match ? match[1] : null,
    projectLink: row.CAP_Launch_UploadLink
  };
});

res.json({
  totalProjects: projects.length,
  projects
});

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.get('/api/student/:userId/portfolio-data', async (req, res) => {
  try {
    const pool = await sql.connect(sqlConfig);
    const userId = Number(req.params.userId);

    const studentResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT UserID, FirstName, LastName, Email
        FROM dbo.ADF_ColaberryActiveUsers
        WHERE UserID = @userId
      `);

    const projectsResult = await pool.request()
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

    const projects = projectsResult.recordset.map((row) => {
      const match = row.CAP_Launch_UploadLink.match(/network\/(\d+)\/projectinstructions/);

      return {
        userId: row.UserID,
        networkId: match ? match[1] : null,
        projectLink: row.CAP_Launch_UploadLink
      };
    });

    res.json({
      student: studentResult.recordset[0] || null,
      totalProjects: projects.length,
      projects
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.get('/api/student/by-email/:email', async (req, res) => {
  try {
    const pool = await sql.connect(sqlConfig);

    const result = await pool.request()
      .input('email', sql.NVarChar, req.params.email)
      .query(`
        SELECT
          UserID,
          FirstName,
          LastName,
          Email
        FROM dbo.ADF_ColaberryActiveUsers
        WHERE Email = @email
      `);

    res.json({
      found: result.recordset.length > 0,
      student: result.recordset[0] || null
    });
  } catch (error) {
    res.status(500).json({
      found: false,
      error: error.message
    });
  }
});

app.get('/api/student/by-email/:email/portfolio-data', async (req, res) => {
  try {
    const pool = await sql.connect(sqlConfig);
    const email = req.params.email;

    const studentResult = await pool.request()
      .input('email', sql.NVarChar, email)
      .query(`
        SELECT UserID, FirstName, LastName, Email
        FROM dbo.ADF_ColaberryActiveUsers
        WHERE Email = @email
      `);

    const student = studentResult.recordset[0];

    if (!student) {
      return res.json({
        found: false,
        student: null,
        totalProjects: 0,
        projects: []
      });
    }

    const projectsResult = await pool.request()
      .input('userId', sql.Int, student.UserID)
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

    const projects = projectsResult.recordset.map((row) => {
      const match = row.CAP_Launch_UploadLink.match(/network\/(\d+)\/projectinstructions/);

      return {
        userId: row.UserID,
        networkId: match ? match[1] : null,
        projectLink: row.CAP_Launch_UploadLink
      };
    });

    res.json({
      found: true,
      student,
      totalProjects: projects.length,
      projects
    });

  } catch (error) {
    res.status(500).json({
      found: false,
      error: error.message
    });
  }
});

app.get('/api/colaberry/load-portfolio-data', async (req, res) => {
  let browser;

  try {
    browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto('https://app.colaberry.com');

    await page.waitForURL(/\/(dashboard|home|app|profile|portal).*/i, {
      timeout: 0
    });

    const cookies = await page.context().cookies();

    const myEmailCookie = cookies.find(
      cookie => cookie.name === 'myEmail' && cookie.domain.includes('colaberry.com')
    );

    const loggedInEmail = myEmailCookie?.value || '';

    if (!loggedInEmail) {
      await browser.close();

      return res.status(404).json({
        found: false,
        error: 'Could not detect logged-in Colaberry email.'
      });
    }

    const pool = await sql.connect(sqlConfig);

    const studentResult = await pool.request()
      .input('email', sql.NVarChar, loggedInEmail)
      .query(`
        SELECT UserID, FirstName, LastName, Email
        FROM dbo.ADF_ColaberryActiveUsers
        WHERE Email = @email
      `);

    const student = studentResult.recordset[0];

    if (!student) {
      await browser.close();

      return res.json({
        found: false,
        email: loggedInEmail,
        student: null,
        totalProjects: 0,
        projects: []
      });
    }

    const projectsResult = await pool.request()
      .input('userId', sql.Int, student.UserID)
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

    const projectRows = projectsResult.recordset.map((row) => {
  const match = row.CAP_Launch_UploadLink.match(/network\/(\d+)\/projectinstructions/);

  return {
    userId: row.UserID,
    networkId: match ? Number(match[1]) : null,
    projectLink: row.CAP_Launch_UploadLink
  };
});

const networkIds = projectRows
  .map(project => project.networkId)
  .filter(Boolean);

let metadataRows = [];

if (networkIds.length > 0) {
  const metadataRequest = pool.request();

  networkIds.forEach((id, index) => {
    metadataRequest.input(`projectId${index}`, sql.Int, id);
  });

  const idParams = networkIds
    .map((_, index) => `@projectId${index}`)
    .join(',');

  const metadataResult = await metadataRequest.query(`
    SELECT
      projectID,
      ProjectName,
      ProjectSummary,
      ProjectVisual
    FROM dbo.ADF_Proj_Deployed
    WHERE projectID IN (${idParams})
  `);

  metadataRows = metadataResult.recordset;
}

const projects = projectRows.map((project) => {
  const metadata = metadataRows.find(
    row => Number(row.projectID) === Number(project.networkId)
  );

  return {
    userId: project.userId,
    networkId: project.networkId,
    projectLink: project.projectLink,
    title: metadata?.ProjectName || `Colaberry Project ${project.networkId}`,
    summary: metadata?.ProjectSummary || '',
    imageUrl: metadata?.ProjectVisual || ''
  };
});

    await page.context().storageState({
      path: 'colaberry-storage-state.json'
    });
    await browser.close();

    res.json({
      found: true,
      student,
      totalProjects: projects.length,
      projects
    });

  } catch (error) {
    if (browser) {
      await browser.close();
    }

    res.status(500).json({
      found: false,
      error: error.message
    });
  }
});

app.get('/api/colaberry/network-projects', async (req, res) => {
  try {
    const category = String(req.query.category || 'All').trim();

const categoryKeywords = {
  'Power BI': ['power bi'],

  'DW ETL': [
    'dw etl',
    'data warehouse',
    'etl'
  ],

  Qlik: ['qlik'],

  Tableau: ['tableau']

};

    const pool = await sql.connect(sqlConfig);
    const request = pool.request();

    let categoryCondition = '';

    if (category !== 'All' && categoryKeywords[category]) {
      const conditions = categoryKeywords[category].map((keyword, index) => {
        request.input(
          `keyword${index}`,
          sql.NVarChar,
          `%${keyword}%`
        );

        return `
          LOWER(ProjectName) LIKE LOWER(@keyword${index})
          OR LOWER(ISNULL(ProjectSummary, '')) LIKE LOWER(@keyword${index})
        `;
      });

      categoryCondition = `
        AND (
          ${conditions.map((condition) => `(${condition})`).join(' OR ')}
        )
      `;
    }

const result = await request.query(`
  WITH RankedProjects AS (
    SELECT
      projectID,
      ProjectName,
      ProjectSummary,
      ProjectVisual,
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
  SELECT
    projectID,
    ProjectName,
    ProjectSummary,
    ProjectVisual
  FROM RankedProjects
  WHERE rowNumber = 1
  ORDER BY ProjectName
`);

    const projects = result.recordset.map((row) => ({
      userId: null,
      networkId: Number(row.projectID),
      projectLink: `https://app.colaberry.com/app/network/network/${row.projectID}/projectinstructions`,
      title: row.ProjectName,
      summary: row.ProjectSummary || '',
      imageUrl: row.ProjectVisual || '',
      source: 'network'
    }));

    res.json({
      category,
      totalProjects: projects.length,
      projects
    });
  } catch (error) {
    console.error('Failed to load Colaberry network projects:', error);

    res.status(500).json({
      totalProjects: 0,
      projects: [],
      error: error.message
    });
  }
});

app.get('/api/colaberry/network-project-categories', async (req, res) => {
  try {
    const pool = await sql.connect(sqlConfig);

    const result = await pool.request().query(`
      SELECT
        'Power BI' AS CategoryName,
        COUNT(DISTINCT LOWER(LTRIM(RTRIM(ProjectName)))) AS ProjectCount
      FROM dbo.ADF_Proj_Deployed
      WHERE projectID IS NOT NULL
        AND ProjectName IS NOT NULL
        AND LTRIM(RTRIM(ProjectName)) <> ''
        AND (
          LOWER(ProjectName) LIKE '%power bi%'
          OR LOWER(ISNULL(ProjectSummary, '')) LIKE '%power bi%'
        )

      UNION ALL

      SELECT
        'DW ETL' AS CategoryName,
        COUNT(DISTINCT LOWER(LTRIM(RTRIM(ProjectName)))) AS ProjectCount
      FROM dbo.ADF_Proj_Deployed
      WHERE projectID IS NOT NULL
        AND ProjectName IS NOT NULL
        AND LTRIM(RTRIM(ProjectName)) <> ''
        AND (
          LOWER(ProjectName) LIKE '%dw etl%'
          OR LOWER(ProjectName) LIKE '%data warehouse%'
          OR LOWER(ProjectName) LIKE '%etl%'
          OR LOWER(ISNULL(ProjectSummary, '')) LIKE '%dw etl%'
          OR LOWER(ISNULL(ProjectSummary, '')) LIKE '%data warehouse%'
          OR LOWER(ISNULL(ProjectSummary, '')) LIKE '%etl%'
        )

      UNION ALL

      SELECT
        'Qlik' AS CategoryName,
        COUNT(DISTINCT LOWER(LTRIM(RTRIM(ProjectName)))) AS ProjectCount
      FROM dbo.ADF_Proj_Deployed
      WHERE projectID IS NOT NULL
        AND ProjectName IS NOT NULL
        AND LTRIM(RTRIM(ProjectName)) <> ''
        AND (
          LOWER(ProjectName) LIKE '%qlik%'
          OR LOWER(ISNULL(ProjectSummary, '')) LIKE '%qlik%'
        )

      UNION ALL

      SELECT
        'Tableau' AS CategoryName,
        COUNT(DISTINCT LOWER(LTRIM(RTRIM(ProjectName)))) AS ProjectCount
      FROM dbo.ADF_Proj_Deployed
      WHERE projectID IS NOT NULL
        AND ProjectName IS NOT NULL
        AND LTRIM(RTRIM(ProjectName)) <> ''
        AND (
          LOWER(ProjectName) LIKE '%tableau%'
          OR LOWER(ISNULL(ProjectSummary, '')) LIKE '%tableau%'
        )

    `);

    const categories = result.recordset.map((row) => ({
      name: row.CategoryName,
      count: Number(row.ProjectCount)
    }));

    res.json({ categories });
  } catch (error) {
    console.error('Failed to load network project categories:', error);

    res.status(500).json({
      categories: [],
      error: error.message
    });
  }
});

app.listen(3001, () => {
  console.log('PortfolioForge API running on port 3001');
});