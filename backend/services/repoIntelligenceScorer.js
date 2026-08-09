'use strict';

const { shouldSkipPath, LIMITS } = require('./repoLimits');

// ── Priority tiers ────────────────────────────────────────────────────────────

const TIERS = {
  CRITICAL: 'critical',   // 0.85 – 1.00  — always read first
  HIGH:     'high',       // 0.65 – 0.84  — read before medium
  MEDIUM:   'medium',     // 0.45 – 0.64  — read if budget allows
  LOW:      'low',        // 0.25 – 0.44  — only if slots remain
  MINIMAL:  'minimal',    // 0.00 – 0.24  — skip unless nothing better
};

function tierFromScore(score) {
  if (score >= 0.85) return TIERS.CRITICAL;
  if (score >= 0.65) return TIERS.HIGH;
  if (score >= 0.45) return TIERS.MEDIUM;
  if (score >= 0.25) return TIERS.LOW;
  return TIERS.MINIMAL;
}

// ── Exact filename bonuses ────────────────────────────────────────────────────
// Key: lowercase filename. Value: bonus added to the base score (0.30).
// These represent files with guaranteed high intelligence density.

const FILENAME_BONUSES = new Map([
  // Dependency manifests — tell us everything about the tech stack
  ['package.json',          0.70],
  ['requirements.txt',      0.68],
  ['pyproject.toml',        0.68],
  ['setup.py',              0.65],
  ['go.mod',                0.68],
  ['cargo.toml',            0.68],
  ['pom.xml',               0.65],
  ['build.gradle',          0.65],
  ['build.gradle.kts',      0.65],
  ['gemfile',               0.65],
  ['composer.json',         0.65],
  ['pubspec.yaml',          0.65],
  ['mix.exs',               0.65],

  // Database schema definitions
  ['schema.prisma',         0.68],

  // Deployment + infrastructure
  ['dockerfile',            0.62],
  ['docker-compose.yml',    0.65],
  ['docker-compose.yaml',   0.65],
  ['docker-compose.prod.yml', 0.63],

  // Application entry points
  ['server.js',             0.57],
  ['server.ts',             0.57],
  ['app.js',                0.55],
  ['app.ts',                0.55],
  ['main.py',               0.55],
  ['main.go',               0.55],
  ['main.rs',               0.55],
  ['index.js',              0.50],
  ['index.ts',              0.50],
  // React / frontend entry components
  ['app.jsx',               0.22],
  ['app.tsx',               0.22],
  ['main.jsx',              0.22],
  ['main.tsx',              0.22],
  ['_app.tsx',              0.22],   // Next.js
  ['_app.jsx',              0.22],
  ['wsgi.py',               0.52],
  ['asgi.py',               0.52],

  // Build / compiler configs (reveal framework choices)
  ['tsconfig.json',         0.52],
  ['vite.config.ts',        0.50],
  ['vite.config.js',        0.50],
  ['webpack.config.js',     0.48],
  ['next.config.js',        0.52],
  ['next.config.ts',        0.52],
  ['nuxt.config.ts',        0.50],
  ['svelte.config.js',      0.48],
  ['angular.json',          0.52],
  ['.babelrc',              0.40],
  ['babel.config.js',       0.40],

  // CI/CD workflow files
  ['ci.yml',                0.55],
  ['cd.yml',                0.55],
  ['deploy.yml',            0.58],
  ['build.yml',             0.52],
  ['test.yml',              0.50],
  ['release.yml',           0.55],

  // Project docs — useful for purpose inference but lower priority than code
  ['readme.md',             0.18],
  ['architecture.md',       0.20],
  ['design.md',             0.20],
  ['contributing.md',       0.10],

  // Environment shape (reveals expected config surface)
  ['.env.example',          0.45],
  ['.env.sample',           0.45],
]);

// ── Directory context bonuses ─────────────────────────────────────────────────
// Applied based on the directory segments in the path.
// Multiple matching segments: only the highest bonus applies.

const DIR_BONUSES = [
  // Routes / API surface — highest value: tells us the full API shape
  { segments: new Set(['routes', 'route']),                     bonus: 0.55 },
  { segments: new Set(['controllers', 'controller']),           bonus: 0.55 },
  { segments: new Set(['handlers', 'handler']),                 bonus: 0.53 },
  { segments: new Set(['api']),                                 bonus: 0.48 },
  { segments: new Set(['resolvers', 'resolver']),               bonus: 0.50 }, // GraphQL

  // Auth / middleware — reveals security architecture
  { segments: new Set(['middleware', 'middlewares']),            bonus: 0.55 },
  { segments: new Set(['auth', 'authentication']),              bonus: 0.52 },
  { segments: new Set(['guards', 'guard']),                     bonus: 0.50 }, // NestJS

  // Service / business logic layer
  { segments: new Set(['services', 'service']),                 bonus: 0.52 },
  { segments: new Set(['usecases', 'use-cases', 'use_cases']),  bonus: 0.50 },
  { segments: new Set(['domain']),                              bonus: 0.48 },

  // Data / persistence layer
  { segments: new Set(['models', 'model']),                     bonus: 0.50 },
  { segments: new Set(['entities', 'entity']),                  bonus: 0.50 },
  { segments: new Set(['repositories', 'repository']),          bonus: 0.48 },
  { segments: new Set(['migrations', 'migration']),             bonus: 0.48 },
  { segments: new Set(['schemas', 'schema']),                   bonus: 0.48 },
  { segments: new Set(['prisma']),                              bonus: 0.55 },

  // Infrastructure / deployment
  { segments: new Set(['workflows']),                           bonus: 0.55 }, // .github/workflows
  { segments: new Set(['k8s', 'kubernetes']),                   bonus: 0.52 },
  { segments: new Set(['terraform', 'infra', 'infrastructure']),bonus: 0.50 },
  { segments: new Set(['helm']),                                bonus: 0.48 },
  { segments: new Set(['docker']),                              bonus: 0.45 },
  { segments: new Set(['deploy', 'deployment']),                bonus: 0.45 },

  // AI / ML — high value: reveals intelligence capabilities
  { segments: new Set(['ai', 'ml', 'llm']),                    bonus: 0.55 },
  { segments: new Set(['agents', 'agent']),                     bonus: 0.50 },
  { segments: new Set(['embeddings', 'embedding']),             bonus: 0.52 },
  { segments: new Set(['prompts', 'prompt']),                   bonus: 0.52 },

  // State management (frontend architecture signal)
  { segments: new Set(['store', 'stores']),                     bonus: 0.40 },
  { segments: new Set(['redux']),                               bonus: 0.40 },
  { segments: new Set(['context']),                             bonus: 0.38 },
  { segments: new Set(['hooks', 'hook']),                       bonus: 0.38 },

  // Config
  { segments: new Set(['config', 'configs', 'configuration']),  bonus: 0.38 },
  { segments: new Set(['settings']),                            bonus: 0.35 },
  { segments: new Set(['constants', 'constant']),               bonus: 0.30 },

  // UI / pages — lower value for intelligence (structure readable from imports)
  { segments: new Set(['pages', 'page']),                       bonus: 0.35 },
  { segments: new Set(['views', 'view']),                       bonus: 0.33 },
  { segments: new Set(['components', 'component']),             bonus: 0.32 },
  { segments: new Set(['screens', 'screen']),                   bonus: 0.30 },

  // Shared utilities
  { segments: new Set(['utils', 'util', 'utilities']),          bonus: 0.28 },
  { segments: new Set(['helpers', 'helper']),                   bonus: 0.28 },
  { segments: new Set(['lib', 'libs']),                         bonus: 0.32 },
  { segments: new Set(['shared', 'common']),                    bonus: 0.30 },

  // Tests — useful for maturity scoring
  { segments: new Set(['__tests__', 'test', 'tests', 'spec', 'specs']), bonus: 0.30 },

  // Docs — low intel density but useful for purpose inference
  { segments: new Set(['docs', 'documentation']),               bonus: 0.12 },
];

// ── Name-pattern bonuses ──────────────────────────────────────────────────────
// Applied to the filename (without extension). Multiple can stack.

const NAME_PATTERN_BONUSES = [
  // AI / ML integration — very high value
  { pattern: /openai|anthropic|langchain|llamaindex|huggingface|cohere|mistral/i, bonus: 0.30, signal: 'ai_provider' },
  { pattern: /embedding|embeddings|vector|semantic|pinecone|weaviate|chroma/i,   bonus: 0.28, signal: 'ai_vector' },
  { pattern: /\bllm\b|gpt|claude|gemini|llama/i,                                 bonus: 0.25, signal: 'ai_model' },
  { pattern: /recommendation|recommender/i,                                       bonus: 0.22, signal: 'ai_recommendation' },

  // Auth signals
  { pattern: /\bauth\b|authentication|authorize|authorization/i,                  bonus: 0.22, signal: 'auth' },
  { pattern: /\bjwt\b|\boauth\b|session|passport|token/i,                        bonus: 0.20, signal: 'auth_mechanism' },

  // Payment / billing
  { pattern: /stripe|payment|billing|subscription|invoice|checkout/i,            bonus: 0.20, signal: 'payment' },

  // Database / persistence
  { pattern: /\bdb\b|database|postgres|mysql|mongo|redis|elasticsearch|prisma/i, bonus: 0.18, signal: 'database' },
  { pattern: /migration|seed|schema/i,                                            bonus: 0.18, signal: 'db_schema' },

  // Workflow / event patterns
  { pattern: /queue|worker|job|task|cron|schedule/i,                             bonus: 0.18, signal: 'async_workflow' },
  { pattern: /event|emit|listener|pubsub|webhook/i,                              bonus: 0.15, signal: 'event_driven' },

  // Testing (useful for maturity signal)
  { pattern: /\.(test|spec)$/i,                                                   bonus: 0.12, signal: 'test_file' },

  // NestJS / typed framework patterns
  { pattern: /\.(controller|service|module|guard|interceptor|pipe|decorator)$/i,  bonus: 0.20, signal: 'nestjs_pattern' },
];

// ── Depth penalty ─────────────────────────────────────────────────────────────
// Deeply nested files are less likely to be architecturally significant.
// Applied per directory level beyond depth 3. Capped at 0.20.

const DEPTH_PENALTY_PER_LEVEL = 0.04;
const DEPTH_PENALTY_FREE_LEVELS = 3;
const DEPTH_PENALTY_CAP = 0.20;

// ── scoreFile ─────────────────────────────────────────────────────────────────

/**
 * Scores a single file path for intelligence value.
 * Higher score = more valuable to fetch and analyze.
 *
 * @param {string} filePath  — relative path from repo root
 * @returns {{ score: number, tier: string, signals: string[] }}
 */
function scoreFile(filePath) {
  const segments = filePath.split('/');
  const filename  = segments[segments.length - 1];
  const filenameLower = filename.toLowerCase();
  // Strip extension for pattern matching
  const dotIndex  = filenameLower.lastIndexOf('.');
  const stem      = dotIndex !== -1 ? filenameLower.slice(0, dotIndex) : filenameLower;
  const depth     = segments.length - 1; // directory levels above the file

  const signals = [];
  let score = 0.30; // base — every file that passed shouldSkipPath starts here

  // ── 1. Exact filename bonus ─────────────────────────────────────────────────
  const filenameBonus = FILENAME_BONUSES.get(filenameLower);
  if (filenameBonus !== undefined) {
    score += filenameBonus;
    signals.push(`filename:${filename}`);
  }

  // ── 2. Directory context bonus (highest matching dir wins) ──────────────────
  let bestDirBonus = 0;
  let bestDirSignal = null;

  for (const rule of DIR_BONUSES) {
    for (let i = 0; i < segments.length - 1; i++) {
      if (rule.segments.has(segments[i].toLowerCase())) {
        if (rule.bonus > bestDirBonus) {
          bestDirBonus = rule.bonus;
          bestDirSignal = `dir:${segments[i]}`;
        }
        break;
      }
    }
  }

  if (bestDirBonus > 0) {
    score += bestDirBonus;
    signals.push(bestDirSignal);
  }

  // ── 3. Name pattern bonuses (additive — multiple can stack) ─────────────────
  for (const rule of NAME_PATTERN_BONUSES) {
    if (rule.pattern.test(stem) || rule.pattern.test(filename)) {
      score += rule.bonus;
      signals.push(`pattern:${rule.signal}`);
    }
  }

  // ── 4. Depth penalty ────────────────────────────────────────────────────────
  if (depth > DEPTH_PENALTY_FREE_LEVELS) {
    const penalty = Math.min(
      DEPTH_PENALTY_CAP,
      (depth - DEPTH_PENALTY_FREE_LEVELS) * DEPTH_PENALTY_PER_LEVEL,
    );
    score -= penalty;
    if (penalty > 0) signals.push(`depth_penalty:${depth}`);
  }

  // ── 5. Cap and tier ─────────────────────────────────────────────────────────
  score = parseFloat(Math.min(1.0, Math.max(0.0, score)).toFixed(3));
  return { score, tier: tierFromScore(score), signals };
}

// ── rankFiles ─────────────────────────────────────────────────────────────────

/**
 * Takes a raw GitHub tree and returns a filtered, scored, and sorted file list
 * ready for the enricher to consume in priority order.
 *
 * @param {Array<{ path: string, size: number, type: string }>} treeEntries
 * @returns {Array<{ path: string, size: number, score: number, tier: string, signals: string[] }>}
 */
function rankFiles(treeEntries) {
  const ranked = [];

  for (const entry of treeEntries) {
    if (entry.type !== 'blob') continue; // skip directory entries

    const { skip } = shouldSkipPath(entry.path);
    if (skip) continue;

    const { score, tier, signals } = scoreFile(entry.path);
    ranked.push({ path: entry.path, size: entry.size ?? 0, score, tier, signals });
  }

  // Sort by score descending; within same score, shallower paths first
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aDepth = a.path.split('/').length;
    const bDepth = b.path.split('/').length;
    return aDepth - bDepth;
  });

  return ranked;
}

// ── estimateComplexity ────────────────────────────────────────────────────────

// Domain signals detected from file paths — used for chunk count estimation
const DOMAIN_DETECTORS = [
  { name: 'authentication',    test: p => /\/(auth|session|oauth|jwt|passport)/i.test(p) },
  { name: 'api_layer',         test: p => /\/(routes?|controllers?|handlers?|resolvers?|api)\//i.test(p) },
  { name: 'service_layer',     test: p => /\/services?\//i.test(p) },
  { name: 'database',          test: p => /\/(models?|entities|migrations?|prisma)\//i.test(p) || p.endsWith('schema.prisma') },
  { name: 'frontend',          test: p => /\.(jsx|tsx|vue|svelte)$/.test(p) || /\/(components?|pages?|views?|screens?)\//i.test(p) },
  { name: 'ai_services',       test: p => /openai|langchain|llm|embedding|anthropic|claude|gemini/i.test(p) },
  { name: 'deployment',        test: p => /dockerfile|docker-compose|\.github\/workflows/i.test(p) || /\/(k8s|kubernetes|terraform|helm)\//i.test(p) },
  { name: 'testing',           test: p => /\.(test|spec)\.(js|ts|py|go|rb)$/i.test(p) || p.includes('__tests__') },
  { name: 'state_management',  test: p => /\/(redux|store|context|zustand)\//i.test(p) },
  { name: 'background_jobs',   test: p => /\/(workers?|jobs?|queues?|tasks?)\//i.test(p) },
  { name: 'configuration',     test: p => /\/(config|configs|settings)\//i.test(p) || /\.(config|env\.example)$/.test(p) },
  { name: 'documentation',     test: p => /\/(docs?|documentation)\//i.test(p) },
];

// Token cost ranges per complexity tier (input + output tokens, across all agents)
const TOKEN_COST_ESTIMATES = {
  low:        { typical: 40_000,  max:  80_000 },
  medium:     { typical: 110_000, max: 180_000 },
  high:       { typical: 200_000, max: 280_000 },
  enterprise: { typical: 300_000, max: 400_000 },
};

/**
 * Estimates repository complexity, token cost, chunk count, and enrichment
 * difficulty from the file tree alone — no AI calls needed.
 *
 * @param {Array<{ path: string, size: number, type: string }>} treeEntries
 * @param {{ primaryLanguage?: string, sizeKb?: number, openIssues?: number }} repoMeta
 * @returns {ComplexityEstimate}
 */
function estimateComplexity(treeEntries, repoMeta = {}) {
  const blobs = treeEntries.filter(e => e.type === 'blob');
  const paths  = blobs.map(e => e.path);

  // ── Raw signals ─────────────────────────────────────────────────────────────
  const totalFiles = blobs.length;

  // Estimate LOC from file sizes — rough average: 1 line ≈ 40 bytes for source code
  const codeFiles = blobs.filter(e => !shouldSkipPath(e.path).skip);
  const estimatedLoc = codeFiles.reduce((sum, e) => sum + Math.round((e.size ?? 0) / 40), 0);

  // Unique directory depth
  const maxDepth = paths.reduce((max, p) => Math.max(max, p.split('/').length - 1), 0);

  // Language diversity — rough approximation from file extensions
  const extensions = new Set(
    paths
      .map(p => { const d = p.lastIndexOf('.'); return d !== -1 ? p.slice(d + 1).toLowerCase() : null; })
      .filter(Boolean)
      .filter(ext => ['js','ts','jsx','tsx','py','go','rs','java','rb','php','cs','cpp','c','swift','kt'].includes(ext)),
  );
  const languageCount = extensions.size;

  // Infrastructure / capability presence (boolean signals)
  const hasDocker          = paths.some(p => /dockerfile|docker-compose/i.test(p));
  const hasCICD            = paths.some(p => /\.github\/workflows/i.test(p));
  const hasTests           = paths.some(p => /\.(test|spec)\.(js|ts|py|go|rb)$/i.test(p) || p.includes('__tests__'));
  const hasAI              = paths.some(p => /openai|langchain|llm|embedding|anthropic/i.test(p));
  const hasInfraAsCode     = paths.some(p => /\/(terraform|k8s|kubernetes|helm)\//i.test(p) || /\.tf$/.test(p));
  const hasMultipleServices = paths.filter(p => /\/services?\//i.test(p)).length > 3;
  const hasGraphQL         = paths.some(p => /graphql|\.gql$|\.graphql$/i.test(p));
  const hasMicroservices   = paths.some(p => /\/(apps|packages|services)\//i.test(p) && p.split('/').length > 4);

  // ── Complexity score (0.0–1.0) ──────────────────────────────────────────────
  let complexityScore = 0;

  // File count (0–0.28)
  if      (totalFiles < 20)  complexityScore += 0.05;
  else if (totalFiles < 100) complexityScore += 0.12;
  else if (totalFiles < 300) complexityScore += 0.22;
  else                       complexityScore += 0.28;

  // Estimated LOC (0–0.24)
  if      (estimatedLoc < 1_000)  complexityScore += 0.04;
  else if (estimatedLoc < 5_000)  complexityScore += 0.10;
  else if (estimatedLoc < 25_000) complexityScore += 0.18;
  else                            complexityScore += 0.24;

  // Infrastructure bonuses
  if (hasDocker)           complexityScore += 0.05;
  if (hasCICD)             complexityScore += 0.04;
  if (hasTests)            complexityScore += 0.04;
  if (hasAI)               complexityScore += 0.07;
  if (hasInfraAsCode)      complexityScore += 0.06;
  if (hasMultipleServices) complexityScore += 0.05;
  if (hasGraphQL)          complexityScore += 0.04;
  if (hasMicroservices)    complexityScore += 0.06;
  if (languageCount > 2)   complexityScore += 0.04;
  if (maxDepth > 5)        complexityScore += 0.03;

  complexityScore = parseFloat(Math.min(1.0, complexityScore).toFixed(3));

  // ── Complexity tier ─────────────────────────────────────────────────────────
  let complexity;
  if      (complexityScore >= 0.75) complexity = 'enterprise';
  else if (complexityScore >= 0.50) complexity = 'high';
  else if (complexityScore >= 0.25) complexity = 'medium';
  else                              complexity = 'low';

  // ── Enrichment difficulty ───────────────────────────────────────────────────
  let difficulty;
  if      (complexityScore >= 0.75) difficulty = 'very_complex';
  else if (complexityScore >= 0.50) difficulty = 'complex';
  else if (complexityScore >= 0.25) difficulty = 'moderate';
  else                              difficulty = 'straightforward';

  // ── Domain / chunk estimation ───────────────────────────────────────────────
  const detectedDomains = DOMAIN_DETECTORS.filter(d => paths.some(d.test)).map(d => d.name);
  const estimatedChunkCount = Math.max(1, detectedDomains.length);

  // ── Token cost estimation ───────────────────────────────────────────────────
  // Based on how many files we'll actually scan, their estimated content, and
  // the per-agent overhead for 6 agents × prompts + responses.
  const filesToScan       = Math.min(codeFiles.length, LIMITS.MAX_FILES_SCANNED);
  const contentTokens     = filesToScan * LIMITS.MAX_LINES_PER_FILE * 15; // ~15 tokens/line
  const agentOverhead     = 6 * 4_000;                                    // system + response per agent
  const estimatedTokens   = contentTokens + agentOverhead;

  // Use tier-based ranges as a sanity floor/ceiling
  const tierEstimate      = TOKEN_COST_ESTIMATES[complexity];
  const expectedTokenCost = Math.min(tierEstimate.max, Math.max(tierEstimate.typical, estimatedTokens));

  // ── Result ──────────────────────────────────────────────────────────────────
  return {
    complexity,
    complexityScore,
    difficulty,
    signals: {
      totalFiles,
      codeFiles:        codeFiles.length,
      estimatedLoc,
      maxDepth,
      languageCount,
      hasDocker,
      hasCICD,
      hasTests,
      hasAI,
      hasInfraAsCode,
      hasMultipleServices,
      hasGraphQL,
      hasMicroservices,
    },
    enrichment: {
      filesToScan,
      estimatedChunkCount,
      detectedDomains,
      expectedTokenCost,
      estimatedDurationMs: filesToScan * 300 + estimatedChunkCount * 8_000, // rough: 300ms/file fetch + 8s/agent
    },
  };
}

module.exports = { scoreFile, rankFiles, estimateComplexity, TIERS, tierFromScore };
