require('dotenv').config();
const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const readline = require('readline');
const { chromium } = require('playwright');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const allProjectsData = [];
const links = [];
const studentProfile = {};
const MAX_LINKS = 10;
const MIN_LINKS = 1;

console.log('GitHub config loaded:', {
  username: process.env.GITHUB_USERNAME ? 'yes' : 'missing',
  token: process.env.GITHUB_TOKEN ? 'yes' : 'missing',
  repo: process.env.GITHUB_REPO_NAME || 'missing'
});

async function createGitHubRepo() {
  const repoName = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;

  if (!repoName || !token) {
    console.log('Missing GitHub repo name or token.');
    return;
  }

  try {
    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: repoName,
        description: 'Automatically generated data analytics portfolio',
        private: false,
        auto_init: false
      })
    });

    const data = await response.json();

    if (response.status === 201) {
      console.log(`GitHub repo created: ${data.html_url}`);
      return data;
    }

    if (response.status === 422) {
      console.log(`GitHub repo already exists: ${repoName}`);
      return data;
    }

    console.log('GitHub repo creation failed:', data.message);
  } catch (error) {
    console.log('GitHub repo creation error:', error.message);
  }
}

function replaceSection(readme, sectionTitle, newContent) {
  const regex = new RegExp(
    `(## ${sectionTitle}\\n\\n)([\\s\\S]*?)(\\n\\n---|\\n\\n## )`,
    'm'
  );

  return readme.replace(regex, `$1${newContent}$3`);
}

async function pushGeneratedPortfolioToGitHub() {
  const username = process.env.GITHUB_USERNAME;
  const token = process.env.GITHUB_TOKEN;
  const repoName = process.env.GITHUB_REPO_NAME;

  const sourceFolder = path.resolve('generated-portfolio');
  const publishFolder = path.resolve(`../published-portfolio-${repoName}`);

  if (!username || !token || !repoName) {
    console.log('Missing GitHub username, token, or repo name.');
    return;
  }

  if (!fs.existsSync(sourceFolder)) {
    console.log('generated-portfolio folder not found.');
    return;
  }

  const repoUrl = `https://${username}:${token}@github.com/${username}/${repoName}.git`;

  if (!fs.existsSync(publishFolder)) {
    console.log('Cloning portfolio repository...');
    await simpleGit().clone(repoUrl, publishFolder);
  }

  console.log('Copying generated portfolio files...');

  const portfolioMode = process.env.PORTFOLIO_MODE || 'create';

if (portfolioMode === 'create') {
  console.log('Create mode: replacing existing portfolio contents.');

  const items = fs.readdirSync(publishFolder);

  for (const item of items) {
    if (item !== '.git') {
      fs.rmSync(path.join(publishFolder, item), {
        recursive: true,
        force: true
      });
    }
  }

  fs.cpSync(sourceFolder, publishFolder, { recursive: true });
}

if (portfolioMode === 'update') {
  console.log('Update mode: preserving existing portfolio contents.');

  const existingProjectTitles = new Set();

  fs.readdirSync(publishFolder)
    .filter(item => /^project-\d+$/.test(item))
    .forEach(folder => {
      const dataPath = path.join(publishFolder, folder, 'project-data.json');

      if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        if (data.title) {
          existingProjectTitles.add(data.title.trim().toLowerCase());
        }
      }
    });

  const existingProjectNumbers = fs
    .readdirSync(publishFolder)
    .filter(item => /^project-\d+$/.test(item))
    .map(item => Number(item.replace('project-', '')))
    .filter(Number.isFinite);

  let nextProjectNumber =
    existingProjectNumbers.length > 0
      ? Math.max(...existingProjectNumbers) + 1
      : 1;

  const addedProjects = [];

  const generatedProjectFolders = fs
    .readdirSync(sourceFolder)
    .filter(item => /^project-\d+$/.test(item));

  for (const folder of generatedProjectFolders) {
    const generatedDataPath = path.join(sourceFolder, folder, 'project-data.json');

    if (!fs.existsSync(generatedDataPath)) continue;

    const generatedData = JSON.parse(fs.readFileSync(generatedDataPath, 'utf-8'));
    const generatedTitle = generatedData.title?.trim().toLowerCase();

    if (existingProjectTitles.has(generatedTitle)) {
      console.log(`Skipped duplicate project: ${generatedData.title}`);
      continue;
    }

    const targetProjectFolder = `project-${nextProjectNumber}`;

    fs.cpSync(
      path.join(sourceFolder, folder),
      path.join(publishFolder, targetProjectFolder),
      {
        recursive: true,
        force: true
      }
    );

    addedProjects.push({
      oldFolder: folder,
      newFolder: targetProjectFolder,
      title: generatedData.title
    });

    console.log(`Added ${targetProjectFolder}`);
    nextProjectNumber++;
  }

  const existingReadmePath = path.join(publishFolder, 'README.md');
  const newReadmePath = path.join(sourceFolder, 'README.md');
if (!fs.existsSync(existingReadmePath) && fs.existsSync(newReadmePath)) {
  fs.copyFileSync(newReadmePath, existingReadmePath);
  console.log('Update mode: no existing README found, created README from generated portfolio.');
}
  if (fs.existsSync(existingReadmePath) && fs.existsSync(newReadmePath)) {
    const existingReadme = fs.readFileSync(existingReadmePath, 'utf-8');
    const newReadme = fs.readFileSync(newReadmePath, 'utf-8');

    const newHeader = newReadme.split('## Projects')[0];
    function mergeSkillsBadges(existingHeader, newHeader) {
  const existingSkillsMatch = existingHeader.match(/## Skills & Tools\n\n([\s\S]*?)\n\n---/);
  const newSkillsMatch = newHeader.match(/## Skills & Tools\n\n([\s\S]*?)\n\n---/);

  const existingSkills = existingSkillsMatch ? existingSkillsMatch[1].trim() : '';
  const newSkills = newSkillsMatch ? newSkillsMatch[1].trim() : '';

  const allBadges = [...existingSkills.matchAll(/<img[^>]+alt="([^"]+)"[^>]*>/g)]
    .concat([...newSkills.matchAll(/<img[^>]+alt="([^"]+)"[^>]*>/g)]);

  const seen = new Set();
  const mergedBadges = [];

  for (const match of allBadges) {
    const badge = match[0];
    const skillName = match[1].toLowerCase().trim();

    if (!seen.has(skillName)) {
      seen.add(skillName);
      mergedBadges.push(badge);
    }
  }

  return existingHeader.replace(
    /## Skills & Tools\n\n[\s\S]*?\n\n---/,
    `## Skills & Tools\n\n${mergedBadges.join(' ')}\n\n---`
  );
}

const existingHeader = existingReadme.split('## Projects')[0];
const mergedHeader = mergeSkillsBadges(newHeader, existingHeader);

const oldProjectsSection = existingReadme
  .split('## Projects')[1]
  ?.split('---\n\n## Contact')[0];

const newContactSection = newReadme
  .split('---\n\n## Contact')[1];

let updatedReadme = existingReadme;

//const existingHeader = existingReadme.split('## Projects')[0];

if (existingHeader && oldProjectsSection && newContactSection) {
  updatedReadme =
    `${mergedHeader}## Projects\n\n${oldProjectsSection.trim()}\n\n---\n\n## Contact${newContactSection}`;
}

    const newProjectsSection = newReadme
      .split('## Projects')[1]
      ?.split('---\n\n## Contact')[0]
      ?.trim();

    if (addedProjects.length > 0) {
  const cardsToAppend = addedProjects.map((project) => {
  const dataPath = path.join(
    publishFolder,
    project.newFolder,
    'project-data.json'
  );

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  const tools = (
    data.portfolioContent?.tools ||
    data.tags ||
    []
  )
    .slice(0, 3)
    .map(tool => `<code>${tool.replace(/\s*\([^)]*\)/g, '')}</code>`)
    .join(' ');

  const imageSrc = data.imageUrl || '';

  const summary =
    data.portfolioContent?.portfolioSummary ||
    data.portfolioContent?.summary ||
    data.description ||
    '';

  return `
<table>
<tr>
<td width="45%" align="center" valign="middle">

<img src="${imageSrc}" width="100%" height="220">

</td>

<td width="55%" valign="top">

## ${data.title}

${summary}

<br>

${tools}

<br>

<p align="right">
  <a href="./${project.newFolder}/README.md"><b>View Full Project →</b></a>
</p>

</td>
</tr>
</table>

<br>
`;
});

  const contactMarker = '\n---\n\n## Contact';
const contactIndex = updatedReadme.lastIndexOf(contactMarker);

if (contactIndex !== -1) {
  updatedReadme =
    updatedReadme.slice(0, contactIndex).trimEnd() +
    '\n\n' +
    cardsToAppend.join('\n') +
    '\n' +
    updatedReadme.slice(contactIndex);
} else {
  updatedReadme =
    updatedReadme.trimEnd() +
    '\n\n' +
    cardsToAppend.join('\n') +
    '\n\n---\n\n## Contact\n';
}
}

    fs.writeFileSync(existingReadmePath, updatedReadme);
    console.log('Update mode: profile updated and only new projects appended.');
  }
}

  const git = simpleGit(publishFolder);

// Always refresh the remote URL so Git uses the current OAuth token.
const existingRemotes = await git.getRemotes(true);
const originExists = existingRemotes.some(
  (remote) => remote.name === 'origin'
);

if (originExists) {
  await git.remote([
    'set-url',
    'origin',
    repoUrl
  ]);
} else {
  await git.addRemote('origin', repoUrl);
}

await git.add('.');

const status = await git.status();

if (status.files.length > 0) {
  await git.commit('Update generated portfolio');
} else {
  console.log('No portfolio file changes to commit.');
}

await git.push('origin', 'main');

  console.log('\nPortfolio generated successfully!');
  console.log(`View your portfolio here: https://github.com/${username}/${repoName}`);
  console.log('Share this GitHub link with recruiters or add it to your resume/LinkedIn.\n');
}
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isDuplicate(url) {
  return links.includes(url);
}

async function downloadImage(imageUrl, outputPath) {
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      console.log(`Image download failed: ${imageUrl}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);

    return outputPath;
  } catch (error) {
    console.log(`Image download error: ${error.message}`);
    return null;
  }
}
 
function detectProjectCategory(project) {
  const text = `${project.title || ''} ${project.description || ''} ${(project.tags || []).join(' ')}`.toLowerCase();

  if (/vodafone|telecom|telecommunications|subscriber|churn|network|arpu/.test(text)) {
    return 'telecom';
  }

  if (/walmart|retail|store|sales|inventory/.test(text)) {
    return 'retail';
  }

  if (/finance|revenue|profit|loss|forecast|budget/.test(text)) {
    return 'finance';
  }

  if (/healthcare|patient|hospital|medical|clinical/.test(text)) {
    return 'healthcare';
  }

  if (/machine learning|classification|prediction|model|ai/.test(text)) {
    return 'machine_learning';
  }

  if (/sql|database|etl|warehouse|pipeline/.test(text)) {
    return 'data_engineering';
  }

  if (/power bi|dashboard|visualization|dax|reporting/.test(text)) {
    return 'business_intelligence';
  }
  // Healthcare
  if (/healthcare|patient|hospital|medical|clinical/.test(text)) {
    return 'healthcare';
  }

  // SQL / Database
  if (/sql|database|query|mysql|postgresql|etl|warehouse/.test(text)) {
    return 'sql_analytics';
  }

  // Tableau
  if (/tableau/.test(text)) {
    return 'tableau';
  }

  // Data Engineering
  if (/pipeline|data engineering|spark|hadoop|airflow/.test(text)) {
    return 'data_engineering';
  }

  // Cloud
  if (/aws|azure|gcp|cloud/.test(text)) {
    return 'cloud';
  }

  // Excel Analytics
  if (/excel|spreadsheet/.test(text)) {
    return 'excel_analytics';
  }

  return 'general_analytics';
}

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function collectStudentProfile() {
  if (fs.existsSync('ui-portfolio-request.json')) {
  const uiRequest = JSON.parse(fs.readFileSync('ui-portfolio-request.json', 'utf-8'));

  studentProfile.fullName = uiRequest.fullName;
  studentProfile.professionalTitle = uiRequest.professionalTitle;
  studentProfile.linkedinUrl = uiRequest.linkedinUrl;
  studentProfile.email = uiRequest.email;
  studentProfile.githubUsername = uiRequest.githubUsername;
  studentProfile.repoName = uiRequest.repoName;
  studentProfile.portfolioMode =
  uiRequest.portfolioMode || 'create';

  process.env.GITHUB_USERNAME = uiRequest.githubUsername;
  
  process.env.GITHUB_REPO_NAME = uiRequest.repoName;
  process.env.PORTFOLIO_MODE =
  studentProfile.portfolioMode;
  process.env.OPENROUTER_API_KEY = uiRequest.openRouterApiKey;

  console.log('\nLoaded student profile from UI request.');
  console.log(`Student: ${studentProfile.fullName}`);
  console.log(`Portfolio repo: ${studentProfile.repoName}\n`);
  console.log(
  `Portfolio mode: ${studentProfile.portfolioMode}`
  );

  return;
}
  if (fs.existsSync('student-profile.json')) {
  const savedProfile = JSON.parse(fs.readFileSync('student-profile.json', 'utf-8'));
  Object.assign(studentProfile, savedProfile);

  if (studentProfile.repoName) {
    process.env.GITHUB_REPO_NAME = studentProfile.repoName;
  }

  console.log('\nLoaded saved student profile.');
  console.log(`Student: ${studentProfile.fullName}`);
  console.log(`Portfolio repo: ${studentProfile.repoName}\n`);
  return;
  }

  console.log('\nStudent Profile Setup');
  console.log('This information will be used to personalize the GitHub portfolio.\n');

  studentProfile.fullName = await askQuestion('Full name: ');
  studentProfile.professionalTitle = await askQuestion('Professional title/headline: ');
  studentProfile.linkedinUrl = await askQuestion('LinkedIn URL (optional): ');
  studentProfile.email = await askQuestion('Email (optional): ');
  studentProfile.githubUsername = await askQuestion('GitHub username: ');
  studentProfile.repoName = await askQuestion('Portfolio repository name: ');

  if (!studentProfile.repoName) {
    studentProfile.repoName = 'data-analytics-portfolio';
  }

  process.env.GITHUB_REPO_NAME = studentProfile.repoName;
  
  fs.writeFileSync(
    'student-profile.json',
    JSON.stringify(studentProfile, null, 2)
  );
  console.log('\nStudent profile collected successfully.');
  console.log(`Portfolio repo: ${studentProfile.repoName}\n`);
}

function formatTitleCase(text) {
  if (!text) return '';

  return text
    .split(' ')
    .map(word => {
      if (word.toLowerCase() === 'bi') return 'BI';
      if (word.toLowerCase() === 'sql') return 'SQL';
      if (word.toLowerCase() === 'ai') return 'AI';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function promptForLink() {
  return new Promise((resolve) => {
    const prompt = links.length === 0 
      ? `Enter project link 1 of ${MAX_LINKS} (press Enter to stop, minimum ${MIN_LINKS} required): `
      : `Enter project link ${links.length + 1} of ${MAX_LINKS} (press Enter to stop): `;
    
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function run() {
  const generatedFolder = path.resolve('generated-portfolio');

  if (fs.existsSync(generatedFolder)) {
    fs.rmSync(generatedFolder, { recursive: true, force: true });
  }

  fs.mkdirSync(generatedFolder, { recursive: true });

  console.log("PortfolioForge AI started\n");

  await collectStudentProfile();
  
  if (fs.existsSync('ui-portfolio-request.json')) {
  const uiRequest = JSON.parse(fs.readFileSync('ui-portfolio-request.json', 'utf-8'));

  links.push(...(uiRequest.projectLinks || []));

  console.log('\nLoaded project links from UI request:');
  links.forEach((link, index) => {
    console.log(`  ${index + 1}. ${link}`);
  });
}

  await createGitHubRepo();

  if (links.length === 0) {
  console.log('\nNo project links were provided from the UI.');
  console.log('Project links will be loaded after Colaberry login.\n');
}
  
  if (links.length === MAX_LINKS) {
    console.log("\nMaximum links reached.");
  }
  
  console.log("\nAccepted links:");
  links.forEach((link, index) => {
    console.log(`  ${index + 1}. ${link}`);
  });
  
  rl.close();
  
  // Run browser test for each validated project link
  await processProjects(links);
}

async function processProjects(projectLinks) {
  console.log("Starting browser...");
  const browser = await chromium.launch({ headless: false });
  let context;

if (fs.existsSync('colaberry-storage-state.json')) {
  context = await browser.newContext({
    storageState: 'colaberry-storage-state.json'
  });

  console.log('Loaded saved Colaberry session.');
} else {
  context = await browser.newContext();
}

const page = await context.newPage();

  await page.goto('https://app.colaberry.com');

  await page.waitForURL(/\/(dashboard|home|app|profile|portal).*/i, { timeout: 0 });

console.log("Login completed successfully");

// Read browser cookies
const cookies = await page.context().cookies();

// Find the logged-in student's email
const myEmailCookie = cookies.find(
  cookie => cookie.name === 'myEmail' && cookie.domain.includes('colaberry.com')
);

const loggedInEmail = myEmailCookie?.value || '';

console.log('Logged in Colaberry email:', loggedInEmail || 'not found');

if (projectLinks.length === 0 && loggedInEmail) {
  const response = await fetch(
    `http://localhost:3001/api/student/by-email/${encodeURIComponent(loggedInEmail)}/portfolio-data`
  );

  const portfolioData = await response.json();

  if (portfolioData.student) {
    studentProfile.fullName =
      `${portfolioData.student.FirstName} ${portfolioData.student.LastName}`;

    studentProfile.email = portfolioData.student.Email;
  }

  const databaseLinks = (portfolioData.projects || [])
    .map(project => project.projectLink)
    .filter(Boolean);

  projectLinks.push(...databaseLinks);

  console.log('\nLoaded project links from database:');
  projectLinks.forEach((link, index) => {
    console.log(`  ${index + 1}. ${link}`);
  });
}

if (projectLinks.length === 0) {
  console.log('No project links found for this student. Stopping generation.');
  await browser.close();
  return;
}

  for (let index = 0; index < projectLinks.length; index++) {
    await processSingleProject(page, projectLinks[index], index + 1);
  }

  const normalizeSkillKey = (skill) => {
  return skill
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

  const formatSkillLabel = (skill) => {
  return skill
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/python\s*-\s*pandas/i, 'Pandas')
    .replace(/powerbi/i, 'Power BI')
    .replace(/power bi desktop/i, 'Power BI')
    .replace(/power query editor/i, 'Power Query')
    .replace(/csv data files/i, 'CSV')
    .replace(/sql server management studio/i, 'SSMS')
    .replace(/microsoft windows os/i, '')
    .replace(/^t$/i, '')
    .replace(/power bi service/i, 'Power BI')
    .replace(/power bi themes/i, 'Power BI')
    .replace(/power bi report server/i, 'Power BI')
    .replace(/dax\s*\(.*?\)/i, 'DAX')
  };

  const skillMap = new Map();

allProjectsData
  .flatMap(project => project.portfolioContent?.tools || project.tags || [])
  .forEach(skill => {
    const label = formatSkillLabel(skill);
    const key = normalizeSkillKey(label);

    if (!skillMap.has(key)) {
      skillMap.set(key, label);
    }
  });

const excludedSkillKeys = new Set([
  'instructions',
  'casestudy',
  'sales',
  'reporting',
  'finance',
  'retail',
  'telecommunications',
  'dataanalytics',
  'datascience'
]);

const extractedSkills = [...skillMap.entries()]
  .filter(([key]) => !excludedSkillKeys.has(key))
  .map(([, label]) => label);

const skills = extractedSkills
  .filter(skill => skill && skill.length <= 30)
  .slice(0, 10);

const colors = [
  'F2C811',
  '025E8C',
  '3776AB',
  '217346',
  'FF7A00',
  '00A6A6',
  '6A5ACD',
  'D83B01'
];

const skillsBadges = skills.map((skill, index) => {
  const color = colors[index % colors.length];

  return `<img src="https://img.shields.io/badge/${encodeURIComponent(skill)}-${color}?style=for-the-badge&logoColor=white" alt="${skill}">`;
}).join(' ');

function generateHomepageProjectSummary(project) {
  const category = detectProjectCategory(project);
  const title = project.title || 'Data Analytics Project';

  if (category === 'telecom') {
    return `Analyzed telecom data in ${title} to support revenue, churn, and performance reporting through clear analytics and dashboard insights.`;
  }

  if (category === 'retail') {
    return `Built a retail analytics project for ${title}, focusing on sales trends, store performance, and business reporting using dashboard-driven insights.`;
  }

  if (category === 'healthcare') {
    return `Developed a healthcare analytics project for ${title}, transforming healthcare data into clear reporting insights for operational and business decision-making.`;
  }

  if (category === 'finance') {
    return `Created a financial analytics project for ${title}, focusing on revenue, forecasting, profitability, and performance reporting for business decision-making.`;
  }

  if (category === 'machine_learning') {
    return `Prepared and analyzed project data for ${title}, supporting forecasting, machine learning, and predictive analytics workflows.`;
  }

  if (category === 'sql_analytics') {
    return `Built a SQL-based analytics project for ${title}, using structured data analysis to support reporting, insights, and business intelligence workflows.`;
  }

  if (category === 'tableau') {
    return `Created a Tableau analytics project for ${title}, using interactive visualizations to communicate trends, patterns, and business insights.`;
  }

  if (/crime|shooting|safety|incident/i.test(title)) {
    return `Analyzed public safety data in ${title} to identify incident patterns, trends, and reporting insights that support data-driven decision-making.`;
  }

  if (/traffic|aviation|wildlife|air/i.test(title)) {
    return `Analyzed aviation and wildlife strike data in ${title} to identify operational risk patterns and support safety-focused reporting.`;
  }

  return `Developed a data analytics project for ${title}, using reporting, visualization, and business intelligence techniques to communicate key insights.`;
}

async function generateAIProjectCardSummary(project) {
  if (!process.env.OPENROUTER_API_KEY) {
    return generateHomepageProjectSummary(project);
  }
let rawSummary = '';
  try {
    const prompt = `
Create a GitHub portfolio project card summary.

Requirements:
- EXACTLY 1 sentence
- Maximum 25 words
- Professional and recruiter-friendly
- Business focused
- Mention the main tool only if clearly present
- Use strong action verbs such as:
  Analyzed, Built, Developed, Created, Designed, Automated, Evaluated, Integrated
- Vary the opening verb across projects
- Do not start every summary with "Developed"
- Do not use bullet points
- Do not invent results or metrics
- Return ONLY the summary text

Project Data:
${JSON.stringify(project, null, 2)}
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2
    });

    const summaryContent = response?.choices?.[0]?.message?.content;

    if (!summaryContent || typeof summaryContent !== 'string') {
      throw new Error('AI summary response was empty or invalid.');
    }

    rawSummary = summaryContent.trim();

    const cleanedSummary = rawSummary
      .replace(/^["']|["']$/g, '')
      .replace(/[\r\n]+/g, ' ')
      .trim();
    
    if (
      !cleanedSummary ||
      /user safety:\s*safe|triangle|heron|sqrt/i.test(cleanedSummary) ||
      cleanedSummary.length < 30
    ) {
      throw new Error('AI card summary was invalid or unrelated.');
    }

    const sentences = cleanedSummary
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean)
      .slice(0, 1);
    
    console.log('AI CARD SUMMARY:', cleanedSummary);
    return sentences.join(' ');

  } catch (error) {
    console.log('CARD SUMMARY FALLBACK:', project.title);
    console.log(error.message);
    
    return generateHomepageProjectSummary(project);
  }
}

async function generateAIHomepageAbout(projects) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log('OPENROUTER_API_KEY missing. Using fallback homepage about.');
    return null;
  }

  const safeProjects = projects.map(project => ({
    title: project.title,
    description: project.description,
    tags: project.tags,
    category: detectProjectCategory(project)
  }));

const prompt = `
You are writing the About Me section for a GitHub data analytics portfolio.

Use the project data only to understand the person's skills, tools, project themes, and analytics focus areas.

Write as the portfolio owner using first person "I".

Do NOT:
- mention specific project names
- say "For Vodafone" or "For Walmart"
- list projects one by one
- invent jobs, degrees, certifications, years of experience, or employment history
- make unsupported claims

Focus on:
- who the person is professionally
- tools and skills demonstrated
- ability to transform raw data into insights
- dashboarding, reporting, business intelligence, and decision-making
- industries/themes only if useful

Write one polished paragraph, 3 sentences maximum.

Tone:
- professional
- confident
- recruiter-friendly
- beginner-to-intermediate data analyst appropriate

Project data:
${JSON.stringify(safeProjects, null, 2)}
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.4
    });

    const aboutContent = response?.choices?.[0]?.message?.content;

    if (!aboutContent || typeof aboutContent !== 'string') {
      throw new Error('AI homepage about response was empty or invalid.');
    }

    return aboutContent.trim();
  } catch (error) {
    console.log('AI homepage about generation failed. Using fallback about.');
    console.log(error.message);
    return null;
  }
}

function generatePortfolioAbout(projects) {
  const projectCount = projects.length;

  const allTags = [...new Set(projects.flatMap(project => project.tags || []))];

  const focusKeywords = [];

  if (allTags.some(tag => /forecast/i.test(tag))) focusKeywords.push('forecasting');
  if (allTags.some(tag => /telecommunications/i.test(tag))) focusKeywords.push('telecommunications');
  if (allTags.some(tag => /retail/i.test(tag))) focusKeywords.push('retail analytics');
  if (allTags.some(tag => /machine learning|ai/i.test(tag))) focusKeywords.push('machine learning');
  if (allTags.some(tag => /finance/i.test(tag))) focusKeywords.push('business performance analysis');

  const focusAreas = focusKeywords.length > 0
    ? focusKeywords.join(', ')
    : 'business intelligence and data analytics';

  return `This portfolio showcases ${projectCount} data analytics and business intelligence projects focused on ${focusAreas}. It demonstrates practical experience in transforming raw project work into professional dashboards, analytics solutions, and business-focused reporting outputs.`;
}

function generatePortfolioTitle(projects) {
  const allTags = projects.flatMap(project => project.tags || []);

  if (allTags.some(tag => /machine learning|ai/i.test(tag))) {
    return 'AI & Data Analytics Portfolio';
  }

  if (allTags.some(tag => /finance/i.test(tag))) {
    return 'Finance & Data Analytics Portfolio';
  }

  if (allTags.some(tag => /retail/i.test(tag))) {
    return 'Retail & Business Intelligence Portfolio';
  }

  return 'Data Analytics Portfolio';
}

  const aiHomepageAbout = await generateAIHomepageAbout(allProjectsData);
  const homepageAbout = aiHomepageAbout || generatePortfolioAbout(allProjectsData);

  const homepageCardSummaries = await Promise.all(
    allProjectsData.map(project => generateAIProjectCardSummary(project))
  );

  const mainReadmeContent = `# Hi, I'm ${studentProfile.fullName || 'a Data Professional'} 👋

## ${formatTitleCase(studentProfile.professionalTitle) || generatePortfolioTitle(allProjectsData)}


## Skills & Tools

${skillsBadges}

---

## About

${homepageAbout}

---

## Projects

${allProjectsData.map((project, index) => `
<table>
<tr>
<td width="45%" align="center" valign="middle">

<img src="${
  project.imageUrl?.startsWith('./screenshots/')
    ? `./project-${index + 1}/${project.imageUrl.replace('./', '')}`
    : project.imageUrl || ''
}" width="100%" height="220">

</td>

<td width="55%" valign="top">

## ${project.title}

${homepageCardSummaries[index] || project.portfolioContent?.portfolioSummary || generateHomepageProjectSummary(project)}

<br>

${(project.portfolioContent?.tools || project.tags || [])
  .slice(0, 3)
  .map(tool => `<code>${tool.replace(/\s*\([^)]*\)/g, '')}</code>`)
  .join(' ')}

<br>

<p align="right">
  <a href="./project-${index + 1}/README.md"><b>View Full Project →</b></a>
</p>

</td>
</tr>
</table>

<br>
`).join('\n')}

---

## Contact

${[
  studentProfile.linkedinUrl
    ? `<a href="${studentProfile.linkedinUrl}"><img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white"></a>`
    : null,

  studentProfile.githubUsername
    ? `<a href="https://github.com/${studentProfile.githubUsername}"><img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white"></a>`
    : null,

  studentProfile.email
    ? `<a href="mailto:${studentProfile.email}"><img src="https://img.shields.io/badge/Email-EA4335?style=for-the-badge&logo=gmail&logoColor=white"></a>`
    : null
].filter(Boolean).join(' ')}
`;
 
  fs.writeFileSync('generated-portfolio/README.md', mainReadmeContent);
  
  console.log('Main portfolio README saved to generated-portfolio/README.md');
  await pushGeneratedPortfolioToGitHub();
  if (!browser.isConnected()) {
    console.log("Browser already closed.");
    return;
  }

  await browser.close();
  console.log("Browser workflow complete.");
}

async function getBestDashboardImage(page, projectUrl, deploymentLink, outputFolder) {
  try {
    await page.goto(projectUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForTimeout(2000);

    const projectImage =
      (await page
        .locator('div.col-sm-6.hidden-xs img')
        .first()
        .getAttribute('src')
        .catch(() => null)) || '';

    console.log('Selected first-page project image:', projectImage || 'none');

    return projectImage;
  } catch (error) {
    console.log('First-page image selection failed:', error.message);
    return '';
  }
}

async function processSingleProject(page, projectUrl, projectNumber) {
  const outputFolder = `generated-portfolio/project-${projectNumber}`;

  console.log(`\nProcessing project ${projectNumber}...`);

  await page.goto(projectUrl);
  await page.waitForLoadState('load');
  console.log("Project page loaded");

  const projectTitle = (await page.locator('h1.ng-binding').first().textContent()) || 'Untitled Project';
  const description = (await page.locator('p.ng-binding').first().textContent()) || '';
  const tags = (await page.locator('a.tagstyle.ng-binding').allTextContents())
    .map(tag => tag.trim())
    .filter(tag => tag !== '');

  const stepByStepLink =
  (await page
    .locator('a:has-text("Step By Step")')
    .first()
    .getAttribute('href')
    .catch(() => null)) || '';

// Find Deployment FIRST
let deploymentHref =
  (await page
    .locator('a:has-text("Deployment")')
    .first()
    .getAttribute('href')
    .catch(() => null)) || '';

// Fallback to Launch Demo if Deployment doesn't exist
if (!deploymentHref) {
  deploymentHref =
    (await page
      .locator('a:has-text("Launch Demo")')
      .first()
      .getAttribute('href')
      .catch(() => null)) || '';
}

console.log('Raw deployment href:', deploymentHref);

// Convert #/network/... links to real URLs
let deploymentLink = '';

if (deploymentHref.startsWith('#/')) {
  deploymentLink =
    `https://app.colaberry.com/app/network${deploymentHref.substring(1)}`;
} else {
  deploymentLink = deploymentHref;
}

console.log('Deployment URL:', deploymentLink || 'none');

const projectImage =
  await getBestDashboardImage(page, projectUrl, deploymentLink, outputFolder);

  const stepUrl = projectUrl.replace('projectinstructions', 'projectsteps');

  await page.goto(stepUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.locator('text=Step Name:').first().waitFor({ timeout: 60000 });

const stepButtons = page.locator('button[ng-click^="GetSteps"]');

const detectedSteps = [...new Set(
  (await stepButtons.allTextContents())
    .map(text => text.trim())
    .filter(text => /^\d+$/.test(text))
    .map(Number)
)].sort((a, b) => a - b);

console.log(`Detected ${detectedSteps.length} real step numbers:`, detectedSteps);

const allStepDetails = [];

for (const stepNumber of detectedSteps) {

  const stepButton = page
  .locator(`button[ng-click^="GetSteps"]`)
  .filter({ hasText: String(stepNumber) })
  .locator('visible=true')
  .first();

await stepButton.click();

  await page.waitForTimeout(2000);

  let stepContent = await page.locator('body').innerText();

stepContent = stepContent
  .replace(/Chat/g, '')
  .replace(/Contact Support/g, '')
  .replace(/Job Help/g, '')
  .replace(/^\s*\d+\s*$/gm, '')
  .replace(/< back to Network Page/g, '')
  .replace(/Tagged Projects[\s\S]*?(×|Please wait\.\.)/gi, '')
  .replace(/\d+\s+Comments[\s\S]*/gi, '')
  .replace(/\d+\s*Comments?/gi, '')
  .replace(/[a-z]{8}\n\d{4}-\d{2}-\d{2}T[\s\S]*/gi, '')
  .replace(/Add this comment/g, '')
  .replace(/sans-serif/gi, '')
  .replace(/Please wait\.\./gi, '')
  .replace(/×/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

  allStepDetails.push({
    stepNumber,
    content: stepContent
  });

  console.log(`Extracted step ${stepNumber}`);
}

  const rawStepByStepContent = await page.locator('body').innerText();

  const stepByStepContent = rawStepByStepContent
  .replace(/Chat[\s\S]*?< back to Network Page/, '')
  .replace(/Tagged Projects[\s\S]*/i, '')
  .replace(/\d+\s+Comments[\s\S]*?Add this comment/gi, '')
  .replace(/sans-serif/gi, '')
  .replace(/×\s*Please wait\.\./i, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

  const projectData = {
  title: projectTitle,
  description,
  tags,
  imageUrl: projectImage,
  stepByStepLink,
  deploymentLink,
  stepByStepContent,
  allStepDetails,

  category: '',
  industry: '',
  tools: [],
  skills: [],
  portfolioSummary: '',
  keyInsights: [],
  businessImpact: []
};
  allProjectsData.push(projectData);
  //console.log('\n--- Extracted Project Data ---');
 // console.log(JSON.stringify(projectData, null, 2));

  function generateProfessionalInsights(project) {
  const title = (project.title || '').toLowerCase();
  const description = (project.description || '').toLowerCase();
  const tags = (project.tags || []).join(' ').toLowerCase();

  const text = `${title} ${description} ${tags}`;

  // Telecom / Vodafone Projects
if (/vodafone|telecom|telecommunications|revenue|churn/.test(text)) {
  return [
    'Analyzed telecom revenue, subscriber, churn, and network performance metrics.',
    'Built analytics dashboards to help stakeholders monitor KPI performance and revenue trends.',
    'Prepared and transformed project data for forecasting and business analysis workflows.',
    'Connected operational metrics to business-focused visual reporting for decision-making.'
  ];
}

  // Retail / Walmart Projects
if (/walmart|retail|sales/.test(text)) {
  return [
    'Analyzed retail sales performance across multiple stores to identify sales trends and business patterns.',
    'Built Power BI dashboard visuals to compare yearly sales, store activity, and operational performance.',
    'Used Power BI modeling concepts such as date tables, relationships, conditional columns, and DAX measures.',
    'Converted raw sales data into a structured business intelligence reporting solution.'
  ];
}

if (/finance|revenue|profit|loss|forecast|budget/.test(text)) {
  return [
    'Analyzed financial performance trends to identify revenue, cost, or profitability patterns.',
    'Built reporting outputs to support forecasting, budgeting, and KPI tracking.',
    'Connected financial metrics to business-focused insights for decision-making.',
    'Presented financial analysis in a clear portfolio-ready business intelligence format.'
  ];
}

if (/healthcare|patient|hospital|medical|clinical/.test(text)) {
  return [
    'Analyzed healthcare operational and performance metrics to identify trends and reporting insights.',
    'Built dashboards to support KPI monitoring and healthcare performance analysis.',
    'Prepared healthcare datasets for analytics and business reporting workflows.',
    'Connected operational healthcare metrics to business-focused decision-making insights.'
  ];
}

  // AI / Forecasting / ML Projects
  if (/forecast|machine learning|ai/.test(text)) {
    return [
      'Prepared project data for forecasting and machine learning analysis workflows.',
      'Identified patterns and trends that support predictive analytics and business planning.',
      'Structured project outputs into clear analytics deliverables and reporting assets.',
      'Presented findings in a recruiter-friendly portfolio format.'
    ];
  }

  if (/sql|database|query|mysql|postgresql|etl|warehouse/.test(text)) {
  return [
    'Used SQL queries to extract and analyze structured business data.',
    'Joined and transformed relational datasets to support reporting needs.',
    'Identified patterns from database records for business decision-making.',
    'Presented query-driven insights in a recruiter-friendly analytics format.'
  ];
  }
  
  if (/tableau/.test(text)) {
  return [
    'Built Tableau dashboards to communicate project trends and KPI performance.',
    'Used interactive visualizations to support business analysis and reporting.',
    'Designed dashboard views to make patterns easier for stakeholders to understand.',
    'Presented Tableau-based findings in a recruiter-friendly analytics format.'
  ];
  }

  if (/excel|spreadsheet|pivot table|worksheet/.test(text)) {
  return [
    'Used Excel-based analysis techniques to identify business trends and operational patterns.',
    'Prepared spreadsheet data for reporting and business-focused insights.',
    'Built structured reporting views using Excel calculations and summaries.',
    'Presented Excel-driven analysis in a recruiter-friendly portfolio format.'
  ];
}

if (/pipeline|etl|data engineering|spark|hadoop|airflow/.test(text)) {
  return [
    'Built data engineering workflows to prepare and transform datasets for analytics.',
    'Used ETL and pipeline techniques to support scalable reporting processes.',
    'Validated and structured transformed datasets for downstream analysis.',
    'Presented engineering workflows in a recruiter-friendly portfolio format.'
  ];
  }

  if (/aws|azure|gcp|cloud/.test(text)) {
  return [
    'Used cloud-based workflows to support scalable analytics and reporting.',
    'Prepared cloud resources or data outputs for business intelligence use cases.',
    'Connected cloud automation concepts to practical analytics delivery.',
    'Presented cloud analytics work in a recruiter-friendly portfolio format.'
  ];
  }

  if (/machine learning|ml|ai|prediction|forecast|classification|regression/.test(text)) {
  return [
    'Prepared and transformed datasets for machine learning and predictive analytics workflows.',
    'Built AI or forecasting models to identify trends, classifications, or predictive outcomes.',
    'Connected machine learning outputs to business-focused reporting and analysis.',
    'Presented AI-driven insights in a recruiter-friendly portfolio format.'
  ];
}

  // Default Fallback
  return [
    'Analyzed project data to identify meaningful business and operational patterns.',
    'Built structured analytics outputs to communicate findings clearly.',
    'Transformed raw project work into a professional portfolio-ready case study.',
    'Presented project results using business-focused reporting and visualization techniques.'
  ];
}

function generateProjectSummaryText(project) {
  const title = (project.title || '').toLowerCase();
  const description = project.description || '';
  const tags = (project.tags || []).join(' ').toLowerCase();
  const text = `${title} ${description} ${tags}`;

  if (/vodafone|telecom|telecommunications/.test(text)) {
    return 'This project analyzes Vodafone Qatar performance data to support revenue forecasting, churn analysis, KPI monitoring, and business reporting.';
  }

  if (/walmart|retail/.test(text)) {
    return 'This project analyzes Walmart store sales data using Power BI to identify sales trends, compare store performance, and support retail decision-making.';
  }

  return description || 'This project transforms raw project data into a structured analytics case study with clear insights, visuals, and business value.';
}

function generateBusinessProblem(project) {
  const title = (project.title || '').toLowerCase();
  const description = project.description || '';
  const tags = (project.tags || []).join(' ').toLowerCase();
  const text = `${title} ${description} ${tags}`;

  if (/vodafone|telecom|telecommunications/.test(text)) {
    return 'Telecom leaders need reliable visibility into revenue trends, churn behavior, subscriber activity, and network performance so they can make better forecasting and strategy decisions.';
  }

  if (/walmart|retail/.test(text)) {
    return 'Retail teams need to understand sales trends, seasonal patterns, and store-level performance so they can improve planning, operations, and business decision-making.';
  }

  return 'Organizations need clear analytics outputs that transform raw project data into actionable insights for better decision-making.';
}

function generateProjectObjectives(project) {
  const text = `${project.title || ''} ${project.description || ''} ${(project.tags || []).join(' ')}`.toLowerCase();

  if (/vodafone|telecom|telecommunications/.test(text)) {
    return [
      'Analyze telecom revenue, churn, subscriber, and network performance trends.',
      'Prepare data for forecasting and KPI-based business analysis.',
      'Create a clear analytics story for finance and strategy decision-making.'
    ];
  }

  if (/walmart|retail/.test(text)) {
    return [
      'Analyze Walmart sales performance across stores and time periods.',
      'Build Power BI reporting views for sales trends and store-level comparison.',
      'Use data modeling and DAX measures to support retail performance analysis.'
    ];
  }

  if (detectProjectCategory(project) === 'finance') {
  return [
    'Analyze financial performance trends, revenue patterns, and business KPIs.',
    'Build reporting views to support forecasting, budgeting, and performance analysis.',
    'Present financial insights in a clear portfolio-ready business intelligence format.'
  ];
  }
  
  if (detectProjectCategory(project) === 'healthcare') {
  return [
    'Analyze healthcare operational and performance data to identify trends and insights.',
    'Build reporting dashboards to support healthcare monitoring and decision-making.',
    'Present healthcare analytics findings in a professional business intelligence format.'
  ];
  }
  
  if (detectProjectCategory(project) === 'sql_analytics') {
  return [
    'Analyze database records using SQL queries to identify trends and patterns.',
    'Build structured reporting outputs from relational data sources.',
    'Present query-based insights in a clear portfolio-ready analytics format.'
  ];
  }

  if (detectProjectCategory(project) === 'tableau') {
  return [
    'Analyze project data using Tableau dashboards and visual reporting techniques.',
    'Build interactive visualizations to communicate trends, KPIs, and business patterns.',
    'Present Tableau-based insights in a professional portfolio-ready format.'
  ];
  }

  if (detectProjectCategory(project) === 'excel_analytics') {
  return [
    'Analyze business data using Excel-based reporting and spreadsheet techniques.',
    'Build structured reporting outputs to identify trends and operational insights.',
    'Present Excel-driven analysis in a professional portfolio-ready format.'
  ];
  }

  if (detectProjectCategory(project) === 'data_engineering') {
  return [
    'Build and analyze scalable data workflows for transformation and reporting.',
    'Prepare and process structured datasets using ETL and pipeline techniques.',
    'Present data engineering workflows in a professional portfolio-ready format.'
  ];
  }

  if (detectProjectCategory(project) === 'cloud') {
  return [
    'Analyze cloud-based data workflows and reporting requirements.',
    'Use cloud platforms to support scalable analytics, storage, or automation workflows.',
    'Present cloud analytics work in a professional portfolio-ready format.'
  ];
  }

  if (detectProjectCategory(project) === 'machine_learning') {
  return [
    'Analyze datasets and build machine learning workflows to identify predictive patterns.',
    'Prepare and transform data for model training, evaluation, and forecasting tasks.',
    'Present AI and machine learning insights in a professional portfolio-ready format.'
  ];
}

  return [
    'Analyze project data to identify meaningful patterns.',
    'Create a structured analytics deliverable for business users.',
    'Present results in a recruiter-friendly portfolio format.'
  ];
}

function generateBusinessImpact(project) {
  const text = `${project.title || ''} ${project.description || ''} ${(project.tags || []).join(' ')}`.toLowerCase();

  if (/vodafone|telecom|telecommunications/.test(text)) {
    return [
      'Improves visibility into telecom revenue, churn, and subscriber performance.',
      'Supports forecasting and strategic planning for finance and leadership teams.',
      'Helps decision-makers monitor business health through KPI-focused reporting.'
    ];
  }

  if (/walmart|retail/.test(text)) {
    return [
      'Helps retail teams compare store performance and identify sales trends.',
      'Supports better planning around seasonal demand and store-level operations.',
      'Turns historical sales data into a clear dashboard for business review.'
    ];
  }
  
  if (detectProjectCategory(project) === 'finance') {
  return [
    'Supports financial planning and KPI-based business performance monitoring.',
    'Improves visibility into revenue, profitability, and forecasting trends.',
    'Helps stakeholders make more informed budgeting and strategic decisions.'
  ];
  }

  if (detectProjectCategory(project) === 'healthcare') {
  return [
    'Supports healthcare performance monitoring and operational reporting.',
    'Improves visibility into healthcare KPIs and business performance trends.',
    'Helps stakeholders make more informed operational and reporting decisions.'
  ];
  }
  
  if (detectProjectCategory(project) === 'sql_analytics') {
  return [
    'Improves access to structured business data through SQL-based analysis.',
    'Supports reporting and decision-making using clean query outputs.',
    'Demonstrates practical database querying and analytics skills.'
  ];
  }

  if (detectProjectCategory(project) === 'tableau') {
  return [
    'Improves business visibility through interactive Tableau dashboards.',
    'Helps stakeholders understand performance trends and KPI patterns.',
    'Demonstrates practical dashboard design and visual analytics skills.'
  ];
  }

  if (detectProjectCategory(project) === 'excel_analytics') {
  return [
    'Supports business reporting and operational analysis using spreadsheet workflows.',
    'Improves visibility into trends and business performance metrics.',
    'Demonstrates practical Excel analytics and reporting skills.'
  ];
  }
  
  if (detectProjectCategory(project) === 'data_engineering') {
  return [
    'Improves scalability and reliability of analytics data workflows.',
    'Supports cleaner and more efficient reporting processes through ETL automation.',
    'Demonstrates practical data engineering and pipeline development skills.'
  ];
  }

  if (detectProjectCategory(project) === 'cloud') {
  return [
    'Supports scalable analytics and reporting through cloud-based workflows.',
    'Improves reliability and accessibility of data-driven business outputs.',
    'Demonstrates practical cloud analytics and automation skills.'
  ];
  }

  if (detectProjectCategory(project) === 'machine_learning') {
  return [
    'Supports predictive analytics and data-driven forecasting workflows.',
    'Improves business visibility through AI-driven trend and pattern analysis.',
    'Demonstrates practical machine learning and predictive analytics skills.'
  ];
  }

  return [
    'Improves visibility into project outcomes and business patterns.',
    'Supports better decision-making through structured analysis and reporting.',
    'Turns raw project work into a clear, professional analytics case study.'
  ];
}

function generateProfessionalTools(project) {
  const category = detectProjectCategory(project);

  if (category === 'telecom') {
    return ['Power BI', 'Python', 'Pandas', 'Microsoft Fabric', 'ETL', 'Data Forecasting'];
  }

  if (category === 'retail') {
    return ['Power BI', 'Excel', 'DAX', 'Data Modeling', 'Retail Analytics'];
  }

  if (category === 'machine_learning') {
    return ['Python', 'Pandas', 'Machine Learning', 'Forecasting', 'Data Analytics'];
  }
  if (category === 'finance') {
  return ['Power BI', 'Excel', 'Financial Analysis', 'Forecasting', 'Business Intelligence'];
  }

  if (category === 'healthcare') {
  return ['Power BI', 'Excel', 'Healthcare Analytics', 'Data Visualization', 'Reporting'];
  }

  if (category === 'sql_analytics') {
  return ['SQL', 'Database Analysis', 'ETL', 'Data Modeling', 'Reporting'];
  }

  if (category === 'tableau') {
  return ['Tableau', 'Data Visualization', 'Dashboard Design', 'Business Intelligence'];
  }

  if (category === 'data_engineering') {
  return ['Python', 'SQL', 'ETL', 'Data Pipelines', 'Data Warehousing'];
  }

  if (category === 'cloud') {
  return ['Cloud Platforms', 'Data Engineering', 'ETL', 'Analytics', 'Automation'];
  }

  if (category === 'excel_analytics') {
  return ['Excel', 'Pivot Tables', 'Data Cleaning', 'Reporting', 'Business Analysis'];
}

  return [...new Set((project.tags || [])
    .map(tag => tag.trim())
    .filter(tag => tag && !['Instructions', 'Case Study'].includes(tag))
  )].slice(0, 6);
}

function generateProjectWorkflow(project) {
  const category = detectProjectCategory(project);

  // Telecom Projects
  if (category === 'telecom') {
    return [
      'Defined the telecom forecasting and KPI monitoring objectives.',
      'Reviewed Vodafone Qatar revenue, subscriber, churn, and network performance data.',
      'Prepared and transformed project data for analytics and forecasting workflows.',
      'Built Power BI dashboards to monitor telecom business performance trends.',
      'Summarized findings into business-focused insights and reporting outputs.'
    ];
  }

  // Retail Projects
  if (category === 'retail') {
    return [
      'Imported and prepared Walmart sales data in Power BI.',
      'Built calendar tables and data relationships for time-based analysis.',
      'Created DAX measures and calculated fields for sales performance reporting.',
      'Designed dashboard visuals to compare store and yearly sales trends.',
      'Summarized retail insights to support business decision-making.'
    ];
  }
  
  if (category === 'finance') {
   return [
      'Reviewed financial performance data and key business metrics.',
      'Prepared revenue, cost, profit, or forecasting data for analysis.',
      'Built reporting views to monitor financial trends and KPI performance.',
      'Analyzed patterns that support forecasting, budgeting, and business planning.',
      'Summarized financial insights into decision-ready reporting outputs.'
    ];
  }

  if (category === 'healthcare') {
  return [
    'Reviewed healthcare operational and performance datasets.',
    'Prepared healthcare data for reporting and analytics workflows.',
    'Built dashboards and visual reporting views for KPI monitoring.',
    'Analyzed healthcare trends and operational patterns.',
    'Summarized findings into business-focused healthcare insights.'
  ];
  }

  // Machine Learning Projects
  if (category === 'machine_learning') {
    return [
      'Prepared and cleaned the dataset for machine learning analysis.',
      'Explored data patterns and feature relationships.',
      'Built predictive or analytical models using Python-based workflows.',
      'Evaluated model performance and analytical outputs.',
      'Documented findings and business recommendations.'
    ];
  }

  if (category === 'sql_analytics') {
  return [
    'Reviewed database tables, fields, and project requirements.',
    'Wrote SQL queries to extract and filter relevant records.',
    'Joined and transformed relational data for analysis.',
    'Created reporting outputs to summarize key business patterns.',
    'Documented SQL-based findings in a professional portfolio format.'
  ];
  }

  if (category === 'tableau') {
  return [
    'Reviewed project data and business reporting requirements.',
    'Prepared the dataset for Tableau visualization and analysis.',
    'Built interactive dashboards to highlight trends, KPIs, and comparisons.',
    'Refined dashboard layout for clear business storytelling.',
    'Summarized Tableau insights into a professional portfolio case study.'
  ];
  }

  if (category === 'excel_analytics') {
  return [
    'Reviewed and prepared spreadsheet data for analysis.',
    'Cleaned and organized business records using Excel functions and formatting.',
    'Created calculations, summaries, and reporting views for business insights.',
    'Analyzed trends and operational patterns using spreadsheet techniques.',
    'Presented findings in a professional analytics portfolio format.'
  ];
}

if (category === 'data_engineering') {
  return [
    'Reviewed source datasets and data pipeline requirements.',
    'Prepared and transformed data using ETL and engineering workflows.',
    'Built structured pipelines for scalable analytics processing.',
    'Validated transformed data outputs for reporting and downstream analysis.',
    'Documented engineering workflows and project insights in a professional format.'
  ];
  }

  if (category === 'cloud') {
  return [
    'Reviewed cloud project requirements and data workflow objectives.',
    'Prepared cloud-based resources or datasets for analytics processing.',
    'Built or configured cloud workflows to support reporting and automation.',
    'Validated outputs for scalability, reliability, and business usability.',
    'Documented cloud analytics results in a professional portfolio format.'
  ];
  }

  if (category === 'machine_learning') {
  return [
    'Reviewed datasets and defined machine learning objectives.',
    'Prepared and transformed data for model development workflows.',
    'Built machine learning or forecasting models to analyze predictive patterns.',
    'Evaluated model outputs and reporting insights for business interpretation.',
    'Documented AI and machine learning findings in a professional portfolio format.'
  ];
}

  // Default Fallback
  return [
    'Reviewed project requirements and available data sources.',
    'Prepared and structured the data for analysis.',
    'Built analytics visuals and reporting outputs.',
    'Identified business patterns, trends, and insights.',
    'Documented the project as a professional portfolio case study.'
  ];
}

function normalizeAIProjectContent(content) {
  const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return [];
  };

  return {
    category: content.category || '',
    industry: content.industry || '',
    portfolioSummary: content.portfolioSummary || '',
    summary:
     content.summary &&
     !/\buser safety\b|\bsafe\b/i.test(content.summary)
      ? content.summary
      : '',
    businessProblem: content.businessProblem || '',
    objectives: toArray(content.objectives),
    tools: toArray(content.tools),
    skills: toArray(content.skills),
    workflow: toArray(content.workflow),
    keyInsights: toArray(content.keyInsights),
    businessImpact: toArray(content.businessImpact)
  };
}

async function generateAIProjectContent(project) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log('OPENROUTER_API_KEY missing. Using fallback content.');
    return null;
  }

  const safeProjectData = {
    title: project.title,
    description: project.description,
    tags: project.tags,
    stepByStepContent: (project.stepByStepContent || '').slice(0, 6000),
    steps: (project.allStepDetails || []).slice(0, 8).map(step => ({
      stepNumber: step.stepNumber,
      content: (step.content || '').slice(0, 1200)
    }))
  };

  const prompt = `
You are generating a professional GitHub portfolio project page from scraped Colaberry project data.

Use ONLY the provided project data. Do not invent metrics, results, tools, or outcomes that are not supported by the data.

Return strict JSON only with this exact shape:
{
  "category": "Specific project category, such as Retail Analytics, Healthcare Analytics, Telecom Analytics, Business Intelligence, SQL Analytics, Machine Learning, or Data Engineering",
  "industry": "Relevant industry or domain, such as Retail, Healthcare, Telecom, Finance, Public Safety, Aviation, or General Business",
  "portfolioSummary": "Exactly 1 recruiter-friendly sentence, maximum 25 words",
  "summary": "2-3 sentence professional project summary",
  "businessProblem": "2-3 sentence business problem",
  "objectives": ["3 concise bullets"],
  "tools": ["5-8 relevant tools/technologies"],
  "skills": ["5-8 professional skills demonstrated by this project"],
  "workflow": ["5 concise professional workflow steps"],
  "keyInsights": ["4 realistic insights based on the project data"],
  "businessImpact": ["3 concise business impact bullets"]
}

Project data:
${JSON.stringify(safeProjectData, null, 2)}
`;
let rawContent = '';
  try {
    const response = await openai.chat.completions.create({
     model: 'gpt-4.1-mini',
     messages: [
       {
         role: 'user',
         content: prompt
       }
     ],
     temperature: 0.3
   });

   rawContent = response?.choices?.[0]?.message?.content;

   if (!rawContent || typeof rawContent !== 'string') {
     throw new Error('AI response content was empty or invalid.');
   }

   const cleanedContent = rawContent.trim();

   const jsonStart = cleanedContent.indexOf('{');
   let braceCount = 0;
   let jsonEnd = -1;

for (let i = jsonStart; i < cleanedContent.length; i++) {
  if (cleanedContent[i] === '{') braceCount++;
  if (cleanedContent[i] === '}') braceCount--;

  if (braceCount === 0) {
    jsonEnd = i;
    break;
  }
}

if (jsonStart === -1 || jsonEnd === -1) {
  throw new Error('AI response did not contain valid JSON.');
}

const jsonText = cleanedContent.slice(jsonStart, jsonEnd + 1);

const aiContent = normalizeAIProjectContent(JSON.parse(jsonText));

if (
  !aiContent ||
  !aiContent.summary ||
  /\buser safety\b|\bsafe\b/i.test(aiContent.summary) ||
  !aiContent.businessProblem ||
  !Array.isArray(aiContent.objectives) ||
  aiContent.objectives.length === 0
) {
  throw new Error('AI returned incomplete or invalid portfolio content.');
}

return aiContent;
  } catch (error) {
    console.log('AI content generation failed. Using fallback content.');
    console.log(error.message);
    console.log('AI RAW RESPONSE:', typeof rawContent !== 'undefined' ? rawContent : 'No raw response available');
    return null;
  }
}

async function buildProjectPortfolioContent(project) {
  const aiContent = await generateAIProjectContent(project);

  if (aiContent && aiContent.summary) {
    return {
      title: project.title,
      category: aiContent.category || detectProjectCategory(project),
      industry: aiContent.industry || '',
      generationSource: 'ai',
      portfolioSummary: aiContent.portfolioSummary || aiContent.summary,
      summary: aiContent.summary,
      businessProblem: aiContent.businessProblem,
      objectives: aiContent.objectives,
      tools: aiContent.tools,
      skills: aiContent.skills,
      workflow: aiContent.workflow,
      keyInsights: aiContent.keyInsights,
      businessImpact: aiContent.businessImpact,
      imageUrl: project.imageUrl
    };
  }

  return {
    title: project.title,
    category: detectProjectCategory(project),
    industry: '',
    generationSource: 'fallback',
    portfolioSummary: generateProjectSummaryText(project),
    summary: generateProjectSummaryText(project),
    businessProblem: generateBusinessProblem(project),
    objectives: generateProjectObjectives(project),
    tools: generateProfessionalTools(project),
    skills: generateProfessionalTools(project),
    workflow: generateProjectWorkflow(project),
    keyInsights: generateProfessionalInsights(project),
    businessImpact: generateBusinessImpact(project),
    imageUrl: project.imageUrl
  };
}

  const portfolioContent = await buildProjectPortfolioContent(projectData);
  projectData.portfolioContent = portfolioContent;

  const readmeContent = `
# ${projectData.title}

## Project Overview

${portfolioContent.summary}

---

## Business Problem

${portfolioContent.businessProblem}

---

## Objective

${portfolioContent.objectives.map(objective => `- ${objective}`).join('\n')}

---

## Tools & Technologies

${portfolioContent.tools.map(tool => `- ${tool}`).join('\n')}

---

## Project Workflow

${portfolioContent.workflow.map(step => `- ${step}`).join('\n')}

---

## Key Insights

${portfolioContent.keyInsights.map(insight => `- ${insight}`).join('\n')}

---

## Final Dashboard / Project Preview

${projectData.imageUrl ? `![Final Dashboard](${projectData.imageUrl})` : 'No project preview image available.'}

---

## Business Impact

${portfolioContent.businessImpact.map(item => `- ${item}`).join('\n')}

---

## Portfolio Navigation

[← Back to Portfolio Home](../README.md)
`;

  fs.mkdirSync(outputFolder, { recursive: true });
  fs.mkdirSync(`${outputFolder}/screenshots`, { recursive: true });
  fs.mkdirSync(`${outputFolder}/files`, { recursive: true });

  const localPreviewPath = `${outputFolder}/screenshots/preview.png`;
  let readmeImagePath = projectData.imageUrl;

if (projectData.imageUrl && projectData.imageUrl.startsWith('http')) {
  const savedPreviewImage = await downloadImage(projectData.imageUrl, localPreviewPath);
  readmeImagePath = savedPreviewImage ? './screenshots/preview.png' : projectData.imageUrl;
}

  const finalReadmeContent = readmeContent.replaceAll(projectData.imageUrl, readmeImagePath);

  fs.writeFileSync(`${outputFolder}/README.md`, finalReadmeContent);
  fs.writeFileSync(`${outputFolder}/project-data.json`, JSON.stringify(projectData, null, 2));

  console.log(`README saved to ${outputFolder}/README.md`);
  console.log(`Project data saved to ${outputFolder}/project-data.json`);
  
}
run();
