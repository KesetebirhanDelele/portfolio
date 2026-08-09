// Headless scraper for individual Colaberry project pages. Ported from
// legacy/portfolioforge-automation/src/index.js's processSingleProject() +
// getBestDashboardImage() — the DOM-extraction half only.
//
// NOT ported: Portfolioforge's ~500-line hardcoded industry-pattern insight
// generator (Vodafone->telecom bullets, Walmart->retail bullets, etc.). That
// logic is superseded by R2R's own AI narrative pipeline (services/openai.js,
// intelligenceAgents.js) — this module's job ends at raw extracted content;
// R2R's existing deep-analysis/narrative generation does the interpretation.
// See PROGRESS.md M47.3 for the design decision this follows.
//
// Runs fully headless — no human interaction, no Xvfb/VNC container needed.
// Consumes a storageState captured by the live-login flow (colaberryLiveLoginSessionManager).
const { chromium } = require('playwright');

const NAV_TIMEOUT_MS = 60000;
const STEP_CLICK_TIMEOUT_MS = 15000;

function cleanStepText(raw) {
  return raw
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
}

async function extractDeploymentLink(page) {
  let href = await page.locator('a:has-text("Deployment")').first().getAttribute('href').catch(() => null);
  if (!href) {
    href = await page.locator('a:has-text("Launch Demo")').first().getAttribute('href').catch(() => null);
  }
  if (!href) return '';
  return href.startsWith('#/') ? `https://app.colaberry.com/app/network${href.substring(1)}` : href;
}

async function extractProjectImage(page, projectUrl) {
  try {
    await page.goto(projectUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    await page.waitForTimeout(2000);
    return (await page.locator('div.col-sm-6.hidden-xs img').first().getAttribute('src').catch(() => null)) || '';
  } catch (err) {
    console.error('[colaberry-scraper] image extraction failed:', err.message);
    return '';
  }
}

async function scrapeSteps(page, stepUrl) {
  await page.goto(stepUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  await page.locator('text=Step Name:').first().waitFor({ timeout: NAV_TIMEOUT_MS }).catch(() => {});

  const stepButtons = page.locator('button[ng-click^="GetSteps"]');
  const detectedSteps = [...new Set(
    (await stepButtons.allTextContents())
      .map(text => text.trim())
      .filter(text => /^\d+$/.test(text))
      .map(Number)
  )].sort((a, b) => a - b);

  const allStepDetails = [];
  for (const stepNumber of detectedSteps) {
    try {
      const stepButton = page
        .locator('button[ng-click^="GetSteps"]')
        .filter({ hasText: String(stepNumber) })
        .locator('visible=true')
        .first();
      await stepButton.click({ timeout: STEP_CLICK_TIMEOUT_MS });
      await page.waitForTimeout(2000);
      const rawText = await page.locator('body').innerText();
      allStepDetails.push({ stepNumber, content: cleanStepText(rawText) });
    } catch (err) {
      console.error(`[colaberry-scraper] step ${stepNumber} failed:`, err.message);
      // one bad step shouldn't abort the whole project — keep going
    }
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

  return { stepByStepContent, allStepDetails };
}

async function scrapeSingleProject(page, projectUrl) {
  await page.goto(projectUrl, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });

  const title = ((await page.locator('h1.ng-binding').first().textContent().catch(() => null)) || 'Untitled Project').trim();
  const description = ((await page.locator('p.ng-binding').first().textContent().catch(() => null)) || '').trim();
  const tags = (await page.locator('a.tagstyle.ng-binding').allTextContents())
    .map(t => t.trim())
    .filter(Boolean);

  const stepByStepLink = (await page.locator('a:has-text("Step By Step")').first().getAttribute('href').catch(() => null)) || '';
  const deploymentLink = await extractDeploymentLink(page);
  const imageUrl = await extractProjectImage(page, projectUrl);

  const stepUrl = projectUrl.replace('projectinstructions', 'projectsteps');
  const { stepByStepContent, allStepDetails } = await scrapeSteps(page, stepUrl);

  return {
    sourceUrl: projectUrl,
    title, description, tags,
    imageUrl, stepByStepLink, deploymentLink,
    stepByStepContent, allStepDetails,
  };
}

// storageState: the decrypted object from colaberryLiveLoginSessionManager.decryptStorageState.
// projectUrls: array of CAP_Launch_UploadLink values from colaberrySqlClient.getProjectLinksForUser.
// Returns { succeeded: [...], failed: [{ url, error }] } — one bad project link
// never aborts the rest of the batch (Failure-First Design).
async function scrapeColaberryProjects(storageState, projectUrls) {
  const browser = await chromium.launch({ headless: true });
  const succeeded = [];
  const failed = [];
  try {
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    for (const url of projectUrls) {
      try {
        succeeded.push(await scrapeSingleProject(page, url));
      } catch (err) {
        console.error(`[colaberry-scraper] project failed (${url}):`, err.message);
        failed.push({ url, error: err.message });
      }
    }
  } finally {
    await browser.close();
  }
  return { succeeded, failed };
}

module.exports = { scrapeColaberryProjects };
