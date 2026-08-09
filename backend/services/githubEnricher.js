'use strict';

const axios = require('axios');
const {
  shouldSkipFile,
  truncateToLineLimit,
  createPayloadTracker,
  withEnrichmentTimeout,
  LIMITS,
} = require('./repoLimits');
const { rankFiles, estimateComplexity } = require('./repoIntelligenceScorer');

const GITHUB_API           = 'https://api.github.com';
const TREE_TIMEOUT_MS      = 15_000;  // git tree fetch; large repos can be slow
const FILE_TIMEOUT_MS      =  8_000;  // per-file content fetch
const SOFT_DEADLINE_BUFFER =  3_000;  // stop queuing fetches this many ms before the hard wall
const FETCH_CONCURRENCY    =      5;  // max simultaneous file content requests

// ── Language map ──────────────────────────────────────────────────────────────
// Extension → canonical language name used in languageHint.

const LANG_MAP = {
  '.js':      'JavaScript',   '.jsx':     'JavaScript',
  '.mjs':     'JavaScript',   '.cjs':     'JavaScript',
  '.ts':      'TypeScript',   '.tsx':     'TypeScript',
  '.py':      'Python',       '.pyw':     'Python',
  '.go':      'Go',
  '.rs':      'Rust',
  '.java':    'Java',
  '.rb':      'Ruby',
  '.php':     'PHP',
  '.cs':      'C#',
  '.cpp':     'C++',          '.cc':      'C++',          '.cxx': 'C++',
  '.c':       'C',
  '.h':       'C/C++',        '.hpp':     'C++',
  '.swift':   'Swift',
  '.kt':      'Kotlin',       '.kts':     'Kotlin',
  '.sh':      'Shell',        '.bash':    'Shell',        '.zsh': 'Shell', '.fish': 'Shell',
  '.ps1':     'PowerShell',
  '.ex':      'Elixir',       '.exs':     'Elixir',
  '.erl':     'Erlang',
  '.clj':     'Clojure',      '.cljs':    'ClojureScript',
  '.scala':   'Scala',
  '.hs':      'Haskell',
  '.elm':     'Elm',
  '.dart':    'Dart',
  '.lua':     'Lua',
  '.r':       'R',
  '.jl':      'Julia',
  '.ml':      'OCaml',
  '.vue':     'Vue',
  '.svelte':  'Svelte',
  '.yaml':    'YAML',         '.yml':     'YAML',
  '.json':    'JSON',
  '.toml':    'TOML',
  '.md':      'Markdown',     '.mdx':     'Markdown',
  '.rst':     'reStructuredText',
  '.sql':     'SQL',
  '.graphql': 'GraphQL',      '.gql':     'GraphQL',
  '.tf':      'HCL',          '.hcl':     'HCL',
  '.css':     'CSS',
  '.scss':    'SCSS',         '.sass':    'Sass',
  '.less':    'Less',
};

// ── Content type classifier ───────────────────────────────────────────────────
// Pure function — uses only the file path, no I/O.
// Priority order:  manifest → infrastructure → test → documentation
//                  → style → config → data → source_code → unknown

const MANIFEST_NAMES = new Set([
  'package.json', 'requirements.txt', 'pyproject.toml', 'setup.py', 'setup.cfg',
  'go.mod', 'go.sum', 'cargo.toml', 'cargo.lock', 'pom.xml',
  'build.gradle', 'build.gradle.kts', 'settings.gradle',
  'gemfile', 'gemfile.lock', 'composer.json', 'composer.lock',
  'pubspec.yaml', 'mix.exs', 'mix.lock', 'project.clj',
  'pipfile', 'pipfile.lock', 'poetry.lock',
]);

const INFRA_EXACT = new Set([
  'schema.prisma', 'docker-compose.yml', 'docker-compose.yaml',
  'docker-compose.prod.yml', 'docker-compose.override.yml',
  'nginx.conf', 'nginx.conf.example',
]);

const INFRA_DIRS = new Set([
  'k8s', 'kubernetes', 'terraform', 'helm', 'infra', 'infrastructure',
  'workflows', 'deploy', 'deployment', 'charts',
]);

const TEST_DIRS = new Set([
  '__tests__', '__mocks__', 'test', 'tests', 'spec', 'specs',
  'e2e', 'integration', 'unit', 'fixtures',
]);

const DOC_EXT   = new Set(['.md', '.mdx', '.rst', '.adoc', '.asciidoc']);
const DOC_STEMS = ['readme', 'changelog', 'changes', 'contributing', 'license',
                   'licence', 'authors', 'history', 'notice', 'patents', 'security', 'code_of_conduct'];
const DOC_DIRS  = new Set(['docs', 'documentation', 'doc', 'wiki', 'pages']);

const STYLE_EXT = new Set(['.css', '.scss', '.sass', '.less', '.styl', '.postcss']);

const CONFIG_EXT   = new Set(['.yaml', '.yml', '.toml', '.ini', '.conf', '.cfg', '.env', '.properties', '.lock']);
const CONFIG_EXACT = new Set([
  'tsconfig.json', '.babelrc', '.eslintrc', '.eslintignore',
  '.prettierrc', '.prettierignore', '.editorconfig',
  '.env.example', '.env.sample', '.env.test',
  '.nvmrc', '.npmrc', '.yarnrc', '.node-version',
  '.gitignore', '.gitattributes', '.dockerignore', '.gcloudignore',
  'jest.config.js', 'jest.config.ts', 'jest.config.mjs',
  'vitest.config.ts', 'vitest.config.js',
  'vite.config.ts', 'vite.config.js',
  'webpack.config.js', 'webpack.config.ts',
  'next.config.js', 'next.config.ts',
  'nuxt.config.ts', 'svelte.config.js',
  'angular.json', 'babel.config.js', 'babel.config.json',
  'rollup.config.js', 'esbuild.config.js',
  'tailwind.config.js', 'tailwind.config.ts',
  'postcss.config.js', 'stylelint.config.js',
  '.mocharc.js', '.mocharc.yml', 'playwright.config.ts',
]);

const DATA_EXT = new Set(['.csv', '.xml', '.sql', '.graphql', '.gql', '.ndjson', '.geojson', '.jsonl']);

const SOURCE_EXT = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx',
  '.py', '.pyw', '.go', '.rs', '.java', '.rb', '.php',
  '.cs', '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp',
  '.swift', '.kt', '.kts', '.sh', '.bash', '.zsh', '.fish', '.ps1',
  '.ex', '.exs', '.erl', '.clj', '.cljs',
  '.scala', '.hs', '.elm', '.dart', '.lua', '.r', '.jl', '.ml',
  '.vue', '.svelte',
]);

/**
 * Classifies a file into a semantic content type using path rules only.
 * No I/O, no AI, no AST parsing.
 *
 * @param {string} filePath  Relative path from repo root
 * @returns {{ contentType: string, extension: string, languageHint: string|null }}
 */
function classifyContent(filePath) {
  const segments    = filePath.split('/');
  const filename    = segments[segments.length - 1];
  const lower       = filename.toLowerCase();
  const dirs        = segments.slice(0, -1).map(s => s.toLowerCase());
  const dotIdx      = lower.lastIndexOf('.');
  const ext         = dotIdx !== -1 ? lower.slice(dotIdx) : '';
  const stem        = dotIdx !== -1 ? lower.slice(0, dotIdx) : lower;
  const langHint    = LANG_MAP[ext] ?? null;

  // 1. Manifest — dependency/project definition files
  if (MANIFEST_NAMES.has(lower)) return { contentType: 'manifest', extension: ext, languageHint: langHint };

  // 2. Infrastructure — containers, IaC, CI/CD, DB schema
  if (
    INFRA_EXACT.has(lower) ||
    lower.startsWith('dockerfile') ||               // Dockerfile, Dockerfile.prod, etc.
    ext === '.tf' || ext === '.hcl' ||
    dirs.some(d => INFRA_DIRS.has(d)) ||
    (dirs.includes('.github') && dirs.includes('workflows'))
  ) return { contentType: 'infrastructure', extension: ext, languageHint: langHint };

  // 3. Test — test files and test directories
  if (
    /\.(test|spec)\.[a-z]+$/i.test(filename) ||
    stem.endsWith('.test') || stem.endsWith('.spec') ||
    dirs.some(d => TEST_DIRS.has(d))
  ) return { contentType: 'test', extension: ext, languageHint: langHint };

  // 4. Documentation — markdown, rst, doc directories
  if (
    DOC_EXT.has(ext) ||
    DOC_STEMS.some(p => stem === p || stem.startsWith(p + '-') || stem.startsWith(p + '_')) ||
    dirs.some(d => DOC_DIRS.has(d))
  ) return { contentType: 'documentation', extension: ext, languageHint: langHint };

  // 5. Style — CSS, preprocessors
  if (STYLE_EXT.has(ext)) return { contentType: 'style', extension: ext, languageHint: langHint };

  // 6. Config — tool configs, environment files, dotfiles
  if (
    CONFIG_EXACT.has(lower) ||
    lower.startsWith('.env')       ||               // .env, .env.local, .env.production
    stem.startsWith('tsconfig')    ||               // tsconfig.base.json, tsconfig.paths.json
    /\.(config|rc)\.(js|ts|mjs|cjs|json|yaml|yml)$/i.test(filename) ||
    CONFIG_EXT.has(ext)
  ) return { contentType: 'config', extension: ext, languageHint: langHint };

  // 7. Data — structured data files (JSON catches anything not already classified above)
  if (DATA_EXT.has(ext) || ext === '.json') return { contentType: 'data', extension: ext, languageHint: langHint };

  // 7b. Jupyter notebooks — treated as analyzable source (contains code cells)
  if (ext === '.ipynb') return { contentType: 'notebook', extension: ext, languageHint: 'Python' };

  // 8. Source code — known programming language extensions
  if (SOURCE_EXT.has(ext)) return { contentType: 'source_code', extension: ext, languageHint: langHint };

  return { contentType: 'unknown', extension: ext, languageHint: null };
}

// ── Concurrency limiter ───────────────────────────────────────────────────────

/**
 * Runs an array of async task functions with bounded concurrency.
 * Order of results matches order of tasks.
 * Failed tasks produce { ok: false, error } rather than throwing.
 *
 * @param {Array<() => Promise<any>>} tasks
 * @param {number} limit  Max number of tasks running simultaneously
 * @returns {Promise<Array<{ ok: boolean, value?: any, error?: Error }>>}
 */
async function runWithConcurrencyLimit(tasks, limit) {
  if (tasks.length === 0) return [];

  const results = new Array(tasks.length);
  let nextIdx   = 0;

  // Each worker grabs the next available task index until exhausted.
  // Because JS is single-threaded, the `const idx = nextIdx++` assignment
  // is atomic — no race condition between concurrent workers.
  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      try {
        results[idx] = { ok: true, value: await tasks[idx]() };
      } catch (err) {
        results[idx] = { ok: false, error: err };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, () => worker()),
  );

  return results;
}

// ── GitHub helpers ────────────────────────────────────────────────────────────

function githubHeaders() {
  return {
    'User-Agent': 'Repo2Reputation/1.0',
    'Accept':     'application/vnd.github.v3+json',
    ...(process.env.GITHUB_TOKEN && { Authorization: `token ${process.env.GITHUB_TOKEN}` }),
  };
}

/**
 * Resolves the default branch when the DB field is null.
 * Falls back to 'main' on any API error.
 */
async function resolveDefaultBranch(owner, repo) {
  try {
    const { data } = await axios.get(
      `${GITHUB_API}/repos/${owner}/${repo}`,
      { headers: githubHeaders(), timeout: FILE_TIMEOUT_MS },
    );
    return data.default_branch ?? 'main';
  } catch {
    return 'main';
  }
}

/**
 * Fetches the recursive git tree for a branch.
 * Falls back to a shallow (top-level) tree when the repo is too large.
 *
 * @returns {{ entries: object[], shallow: boolean }}
 */
async function fetchTree(owner, repo, branch) {
  let data;
  try {
    ({ data } = await axios.get(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}`,
      { headers: githubHeaders(), timeout: TREE_TIMEOUT_MS, params: { recursive: '1' } },
    ));
  } catch (err) {
    if (err.response?.status === 404) {
      throw Object.assign(
        new Error(`Branch '${branch}' not found in ${owner}/${repo}`),
        { code: 'BRANCH_NOT_FOUND' },
      );
    }
    throw err;
  }

  if (data.truncated || data.tree.length > LIMITS.MAX_TREE_ENTRIES) {
    const { data: shallow } = await axios.get(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}`,
      { headers: githubHeaders(), timeout: TREE_TIMEOUT_MS },
    );
    return { entries: shallow.tree, shallow: true };
  }

  return { entries: data.tree, shallow: false };
}

/**
 * Fetches and decodes a single file's content from GitHub.
 * Truncates to MAX_LINES_PER_FILE.
 *
 * @returns {{ content: string, truncated: boolean, originalLines: number }}
 * @throws When the file is unavailable or has unexpected encoding
 */
async function fetchFileContent(owner, repo, filePath, branch) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');

  const { data } = await axios.get(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodedPath}`,
    { headers: githubHeaders(), timeout: FILE_TIMEOUT_MS, params: { ref: branch } },
  );

  // GitHub returns content: "" for files >1 MB (they require a separate blob fetch)
  if (!data.content) {
    throw new Error(`No inline content for ${filePath} (file likely >1 MB)`);
  }

  if (data.encoding !== 'base64') {
    throw new Error(`Unexpected encoding '${data.encoding}' for ${filePath}`);
  }

  const raw = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
  return truncateToLineLimit(raw);
}

// ── Core enrichment logic ─────────────────────────────────────────────────────

async function _doEnrichment(repoData) {
  const [owner, repo] = repoData.full_name.split('/');
  const branch        = repoData.default_branch ?? await resolveDefaultBranch(owner, repo);

  const softDeadline  = Date.now() + LIMITS.ENRICHMENT_TIMEOUT_MS - SOFT_DEADLINE_BUFFER;

  const skipReasons    = {};
  const payloadTracker = createPayloadTracker();
  let timedOut  = false;

  // ── 1. File tree ──────────────────────────────────────────────────────────────
  const { entries, shallow } = await fetchTree(owner, repo, branch);
  const blobEntries = entries.filter(e => e.type === 'blob');

  // ── 2. Score and rank ─────────────────────────────────────────────────────────
  const complexity  = estimateComplexity(entries, { primaryLanguage: repoData.primary_language });
  const rankedFiles = rankFiles(entries);

  // ── 3. Pre-filter: sequential, no I/O ────────────────────────────────────────
  // Apply static path/size checks to produce an ordered candidate list.
  // The actual HTTP fetches are deferred to the concurrent step below.
  const candidates = [];
  let filesSkipped = 0;

  for (const file of rankedFiles) {
    if (candidates.length >= LIMITS.MAX_FILES_SCANNED) break;

    const { skip, reason } = shouldSkipFile({ filePath: file.path, sizeBytes: file.size ?? 0 });
    if (skip) {
      skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
      filesSkipped++;
      continue;
    }

    candidates.push(file);
  }

  // ── 4. Concurrent fetch ───────────────────────────────────────────────────────
  // Check soft deadline once before committing to the batch.
  // If we're already close to the hard wall (e.g. tree was slow), bail out cleanly.
  const fileContents = {};
  let filesScanned = 0;

  if (Date.now() > softDeadline) {
    timedOut = true;
    skipReasons['soft_timeout'] = (skipReasons['soft_timeout'] ?? 0) + candidates.length;
    filesSkipped += candidates.length;
  } else {
    // Run up to FETCH_CONCURRENCY file fetches simultaneously.
    // Each task is a closure that captures its own file reference.
    const fetchResults = await runWithConcurrencyLimit(
      candidates.map(file => () => fetchFileContent(owner, repo, file.path, branch)),
      FETCH_CONCURRENCY,
    );

    // ── 5. Post-process in priority order ────────────────────────────────────────
    // Apply payload limit and classify each successfully fetched file.
    for (let i = 0; i < candidates.length; i++) {
      const file   = candidates[i];
      const result = fetchResults[i];

      if (!result.ok) {
        skipReasons['fetch_error'] = (skipReasons['fetch_error'] ?? 0) + 1;
        filesSkipped++;
        continue;
      }

      if (payloadTracker.isExceeded()) {
        skipReasons['payload_limit'] = (skipReasons['payload_limit'] ?? 0) + 1;
        filesSkipped++;
        continue;
      }

      const { content, truncated, originalLines } = result.value;
      const contentBytes = Buffer.byteLength(content, 'utf-8');
      payloadTracker.add(contentBytes);

      const { contentType, extension, languageHint } = classifyContent(file.path);

      fileContents[file.path] = {
        content,
        truncated,
        originalLines,
        sizeBytes:    file.size ?? 0,
        score:        file.score,
        tier:         file.tier,
        signals:      file.signals,
        contentType,
        extension,
        languageHint,
      };
      filesScanned++;
    }
  }

  // ── 6. Aggregate stats ────────────────────────────────────────────────────────
  const contentTypeBreakdown = {};
  for (const fc of Object.values(fileContents)) {
    contentTypeBreakdown[fc.contentType] = (contentTypeBreakdown[fc.contentType] ?? 0) + 1;
  }

  const summary = {
    filesInTree:          blobEntries.length,
    filesScanned,
    filesSkipped,
    payloadBytes:         payloadTracker.bytes,
    timedOut,
    shallow,
    skipReasons,
    contentTypeBreakdown,
  };

  const data = {
    repoMeta: {
      name:            repoData.name,
      fullName:        repoData.full_name,
      description:     repoData.description     ?? null,
      primaryLanguage: repoData.primary_language ?? null,
      topics:          repoData.topics           ?? [],
      starsCount:      repoData.stars_count      ?? 0,
      forksCount:      repoData.forks_count      ?? 0,
      defaultBranch:   branch,
    },
    complexity,
    rankedFiles,
    fileContents,
    readmeContent: repoData.readme_content ?? null,
    summary,
  };

  return {
    data,
    meta:     summary,
    dbUpdate: { github_enrichment_json: data },
  };
}

// ── Exported phase function ───────────────────────────────────────────────────

/**
 * Phase 1 — GitHub Enrichment.
 *
 * Fetches the repository's recursive file tree, ranks every file by
 * intelligence value, then fetches content for up to MAX_FILES_SCANNED
 * top-ranked files using bounded concurrency (max FETCH_CONCURRENCY = 5).
 *
 * Wrapped in a hard 30-second timeout (retryable). Individual file errors
 * are isolated — a failed fetch increments skipReasons.fetch_error and
 * the loop continues.
 *
 * Output contract (consumed by Phases 2 + 3):
 *   data.repoMeta              — normalised repo metadata
 *   data.complexity            — complexity estimate from tree analysis
 *   data.rankedFiles           — all tree blobs scored and sorted
 *   data.fileContents          — { path → { content, truncated, originalLines,
 *                                           sizeBytes, score, tier, signals,
 *                                           contentType, extension, languageHint } }
 *   data.readmeContent         — readme text from DB (may be null)
 *   data.summary               — { filesInTree, filesScanned, filesSkipped,
 *                                  payloadBytes, timedOut, shallow, skipReasons,
 *                                  contentTypeBreakdown }
 *
 * @param {object} repoData  Repository row from DB (needs at minimum: full_name)
 * @returns {{ data, meta, dbUpdate }}
 */
async function enrichRepository(repoData) {
  try {
    return await withEnrichmentTimeout(_doEnrichment(repoData));
  } catch (err) {
    console.error('[deep-analysis][enrichRepository] Failed:', {
      repoFullName: repoData?.full_name,
      message:      err.message,
      code:         err.code,
      stack:        err.stack,
    });
    throw err;
  }
}

module.exports = { enrichRepository, classifyContent, runWithConcurrencyLimit };
