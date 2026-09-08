// Converts the raw HTML stored per-step in dbo.ADF_CCS_ProjectQuestions into
// the same kind of plain text colaberryProjectScraper.js used to get for
// free from Playwright's page.innerText() (a browser already strips tags
// when reading rendered DOM text). There's no browser in the SQL-only path
// (see PROGRESS.md M101), so this does that conversion by hand. The source
// HTML is author-pasted (sometimes straight from Word or a YouTube page),
// so it's stripped rather than rendered — no need to preserve styling, only
// readable text and links.
function htmlFragmentToText(html) {
  if (!html) return '';
  return html
    // Keep link text and the URL; drop the tag itself.
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
      const label = inner.replace(/<[^>]+>/g, '').trim();
      return label ? `${label} (${href})` : href;
    })
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|h[1-6]|li|ol|ul)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// steps: the array returned by colaberrySqlClient.getProjectStepsById.
// Mirrors the old buildReadmeContent(project)'s shape (one combined text
// blob, capped at 100k chars) so it drops into repositories.readme_content
// and the AI narrative pipeline (queueAnalysis) unchanged.
function buildStepByStepReadme(steps) {
  const sections = steps.map(step => {
    const instructions = htmlFragmentToText(step.instructionsHtml);
    const insight = htmlFragmentToText(step.insightHtml);
    const parts = [`## Step ${step.stepNumber}: ${step.title}`.trim()];
    if (instructions) parts.push(instructions);
    if (insight) parts.push(insight);
    return parts.join('\n\n');
  });
  return sections.join('\n\n').slice(0, 100000);
}

module.exports = { htmlFragmentToText, buildStepByStepReadme };
