// Finds the first usable demo image/gif in a GitHub repo's raw README markdown
// and resolves it to a real, absolute URL — the auto-capture equivalent, for
// GitHub repos, of what colaberrySqlClient.js's ProjectVisual already gives
// Colaberry projects for free. Feeds repositories.image_url, the same
// fallback-tier field every consumer already reads beneath manually-set
// media (see PublicPortfolio.jsx / pdfGenerator.js / githubPortfolioPublisher.js:
// "Manually-pasted media wins when set; otherwise fall back to the image
// auto-captured at import time"). See PROGRESS.md M105.

// Deliberately extension-only, not a badge-hostname blocklist: badges
// (build status, license, npm version, coverage, etc.) are almost
// universally SVG, while a real screenshot or demo recording never is —
// this one rule does the filtering work a hostname blocklist would need
// constant upkeep to approximate. Mirrors frontend/src/utils/mediaUrl.js's
// SUPPORTED_EXTENSIONS.
const SUPPORTED_EXTENSIONS = ['.gif', '.png', '.jpg', '.jpeg', '.webp'];

const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HTML_IMG_RE = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

function hasSupportedExtension(url) {
  const withoutQuery = url.split('?')[0].split('#')[0].toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => withoutQuery.endsWith(ext));
}

// Same github.com/.../blob/... -> raw.githubusercontent.com/... rewrite
// utils/mediaUrl.js's githubToRaw() does client-side, for a manually-pasted
// URL that happens to be a GitHub blob view link.
function githubBlobToRaw(url) {
  if (url.includes('github.com') && url.includes('/blob/')) {
    return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }
  return url;
}

// Resolves a URL found in README markdown against the repo it came from.
// Absolute URLs pass through (after the blob->raw rewrite above); anything
// else is treated as a path relative to the repo root on its default
// branch — the common case for README images ("docs/demo.gif",
// "./assets/screenshot.png"), which render fine on github.com because
// GitHub resolves them against the repo, but are meaningless outside it.
function resolveImageUrl(rawUrl, { owner, repo, defaultBranch }) {
  if (/^https?:\/\//i.test(rawUrl)) {
    return githubBlobToRaw(rawUrl);
  }
  const relativePath = rawUrl.replace(/^\.?\//, '');
  return `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${relativePath}`;
}

// readmeContent: raw markdown text (already UTF-8 decoded, as fetchReadme()
// in repos.js returns it). Returns the first supported-extension image URL
// found in document order, resolved to an absolute URL, or null if the
// README has none — same graceful "no image" behavior as today, not a new
// failure mode.
function extractReadmeImage(readmeContent, { owner, repo, defaultBranch }) {
  if (!readmeContent || !owner || !repo || !defaultBranch) return null;

  const candidates = [];
  for (const re of [MARKDOWN_IMAGE_RE, HTML_IMG_RE]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(readmeContent)) !== null) {
      candidates.push({ index: match.index, url: match[1] });
    }
  }
  candidates.sort((a, b) => a.index - b.index);

  for (const { url } of candidates) {
    if (hasSupportedExtension(url)) {
      return resolveImageUrl(url, { owner, repo, defaultBranch });
    }
  }
  return null;
}

module.exports = { extractReadmeImage };
