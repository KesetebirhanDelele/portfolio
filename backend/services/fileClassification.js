'use strict';

console.log('[fileClassification] module loaded');

// ─────────────────────────────────────────────────────────────────────────────
// fileClassification.js
//
// Deterministic file classification engine for the v2 deep-analysis pipeline.
// Implements Phase 3 (File Classification) of runDeepAnalysisPipeline.
//
// Transforms enriched file data into per-file semantic classifications that
// power semantic chunking (Phase 4) and AI retrieval (Phase 5).
//
// Design constraints:
//   - Zero external dependencies (no require() of any npm package)
//   - No AI/LLM calls — pure deterministic path + signal analysis
//   - Fault-tolerant — a bad file or throwing rule never crashes the phase
//   - All regex patterns and Sets compiled once at module load
//   - Fully deterministic — same input always produces identical output
// ─────────────────────────────────────────────────────────────────────────────

// ── File domain labels ────────────────────────────────────────────────────────
// Architectural capability bucket for each file.
// One domain per file (unlike codeIntelligence which is multi-domain).

const FILE_DOMAINS = {
  BACKEND:       'backend',
  FRONTEND:      'frontend',
  DATABASE:      'database',
  INFRASTRUCTURE:'infrastructure',
  AI_SYSTEM:     'ai_system',
  AUTH_SYSTEM:   'auth_system',
  TESTING:       'testing',
  DOCUMENTATION: 'documentation',
  CONFIGURATION: 'configuration',
  SHARED:        'shared',
};

// ── Role labels ───────────────────────────────────────────────────────────────
// Per-file functional role within its domain.

const ROLES = {
  ENTRY_POINT:   'entry_point',
  ROUTE_HANDLER: 'route_handler',
  SERVICE:       'service',
  MODEL:         'model',
  MIGRATION:     'migration',
  MIDDLEWARE:    'middleware',
  COMPONENT:     'component',
  PAGE:          'page',
  HOOK:          'hook',
  UTILITY:       'utility',
  CONFIG:        'config',
  TEST:          'test',
  WORKFLOW:      'workflow',
  CONTAINER:     'container',
  IAC:           'iac',
  DOCUMENTATION: 'documentation',
  SCHEMA:        'schema',
  SEED:          'seed',
  TYPE:          'type',
  UNKNOWN:       'unknown',
};

// ── Semantic group labels ─────────────────────────────────────────────────────
// Cross-cutting groupings that drive semantic chunking and AI retrieval.

const SEMANTIC_GROUPS = {
  API_SURFACE:       'api_surface',
  DATA_LAYER:        'data_layer',
  AUTH_FLOW:         'auth_flow',
  UI_COMPONENTS:     'ui_components',
  UI_PAGES:          'ui_pages',
  AI_PIPELINE:       'ai_pipeline',
  INFRA_CONFIG:      'infra_config',
  APP_CONFIGURATION: 'app_configuration',
  TEST_SUITE:        'test_suite',
  APPLICATION_CORE:  'application_core',
  SHARED_UTILITIES:  'shared_utilities',
  DOCUMENTATION:     'documentation',
  STATE_MANAGEMENT:  'state_management',
  TYPE_DEFINITIONS:  'type_definitions',
};

// ── Content types to skip entirely ───────────────────────────────────────────
// Style and unknown files carry no semantic value for retrieval or chunking.

const SKIP_CONTENT_TYPES = new Set(['style', 'unknown']);

// ── Code Intelligence domain → File domain mapping ────────────────────────────
// codeIntelligence.js emits these domain strings; map them to FILE_DOMAINS.

const CI_DOMAIN_MAP = {
  'authentication': FILE_DOMAINS.AUTH_SYSTEM,
  'api_layer':      FILE_DOMAINS.BACKEND,
  'database':       FILE_DOMAINS.DATABASE,
  'ai_tooling':     FILE_DOMAINS.AI_SYSTEM,
  'frontend':       FILE_DOMAINS.FRONTEND,
  'infrastructure': FILE_DOMAINS.INFRASTRUCTURE,
};

// ── CI domain resolution priority ────────────────────────────────────────────
// When a file belongs to multiple CI domains, the first entry in this list wins.
// AI tooling is rarest and most specific → deserves highest priority.

const CI_DOMAIN_PRIORITY = [
  'ai_tooling',
  'authentication',
  'database',
  'frontend',
  'api_layer',
  'infrastructure',
];

// ─────────────────────────────────────────────────────────────────────────────
// Precompiled patterns
// All Sets and RegExps compiled once at module load — never inside a function.
// ─────────────────────────────────────────────────────────────────────────────

// ── Entry point filenames ─────────────────────────────────────────────────────
// Filenames (lowercase) that are unambiguously application bootstrap files.

const ENTRY_POINT_NAMES = new Set([
  'server.js', 'server.ts', 'server.mjs',
  'app.js',    'app.ts',    'app.mjs',
  'main.js',   'main.ts',   'main.mjs',
  'main.py',   'main.go',   'main.rs',   'main.rb',
  'index.js',  'index.ts',
  'wsgi.py',   'asgi.py',
  '_app.tsx',  '_app.jsx',
  'program.cs',
]);

// ── Directory-to-role rules ───────────────────────────────────────────────────
// Each entry maps a Set of lowercase directory names to a role.
// Rules are evaluated in order; first directory match wins.

const DIR_ROLE_RULES = [
  {
    dirs: new Set(['routes', 'route', 'controllers', 'controller',
                   'handlers', 'handler', 'api']),
    role: ROLES.ROUTE_HANDLER,
  },
  {
    dirs: new Set(['services', 'service']),
    role: ROLES.SERVICE,
  },
  {
    dirs: new Set(['models', 'model', 'entities', 'entity']),
    role: ROLES.MODEL,
  },
  {
    dirs: new Set(['migrations', 'migration', 'migrate']),
    role: ROLES.MIGRATION,
  },
  {
    dirs: new Set(['middleware', 'middlewares']),
    role: ROLES.MIDDLEWARE,
  },
  {
    dirs: new Set(['components', 'component']),
    role: ROLES.COMPONENT,
  },
  {
    dirs: new Set(['pages', 'page', 'views', 'view', 'screens', 'screen']),
    role: ROLES.PAGE,
  },
  {
    dirs: new Set(['hooks', 'hook']),
    role: ROLES.HOOK,
  },
  {
    dirs: new Set(['utils', 'util', 'utilities', 'helpers', 'helper',
                   'lib', 'libs', 'shared']),
    role: ROLES.UTILITY,
  },
  {
    dirs: new Set(['types', 'type', 'interfaces', 'interface', 'dtos', 'dto']),
    role: ROLES.TYPE,
  },
  {
    dirs: new Set(['seeds', 'seed', 'seeders', 'seeder', 'fixtures']),
    role: ROLES.SEED,
  },
];

// ── Domain-detection directory Sets ──────────────────────────────────────────

const AI_DIRS = new Set([
  'ai', 'llm', 'ml', 'agents', 'agent', 'chains', 'chain',
  'embeddings', 'embedding', 'vectors', 'vector', 'rag',
  'prompts', 'prompt',
]);

const AUTH_DIRS = new Set([
  'auth', 'authentication', 'authorization', 'authz', 'authn',
  'identity', 'session', 'sessions', 'passport',
]);

const DB_DIRS = new Set([
  'models', 'model', 'entities', 'entity',
  'migrations', 'migration',
  'schemas', 'schema',
  'db', 'database',
  'prisma',
  'seeds', 'seed', 'seeders', 'seeder',
  'repositories', 'repository',
]);

const FRONTEND_DIRS = new Set([
  'components', 'component',
  'pages', 'page',
  'views', 'view',
  'screens', 'screen',
  'layouts', 'layout',
  'hooks', 'hook',
  'public', 'static', 'assets',
  'styles', 'themes', 'theme',
  'ui',
]);

const BACKEND_DIRS = new Set([
  'routes', 'route',
  'controllers', 'controller',
  'handlers', 'handler',
  'services', 'service',
  'middleware', 'middlewares',
  'api',
]);

// ── Frontend file extensions ──────────────────────────────────────────────────

const FRONTEND_EXTENSIONS = new Set(['.jsx', '.tsx', '.vue', '.svelte', '.astro']);

// ── Precompiled RegExps ───────────────────────────────────────────────────────

// Infrastructure sub-type detection (applied to full file path or lowercase filename)
const RE_DOCKERFILE    = /^dockerfile/i;
const RE_COMPOSE       = /^docker-compose/i;
const RE_WORKFLOW_PATH = /\.github[/\\]workflows[/\\]/i;
const RE_IaC_EXT       = /\.(tf|hcl)$/i;
const RE_K8S_PATH      = /[/\\](k8s|kubernetes|helm)[/\\]/i;

// Auth filename keywords (tests lowercase filename).
// Trailing \b intentionally omitted so prefix-compounded names like
// "jwtHelper.js" or "authMiddleware.js" are correctly detected.
const RE_AUTH_FILENAME = /\b(auth|authenticate|authorization|jwt|token|session|oauth|passport|login|logout|signup|register|identity)/i;

// AI/ML filename keywords (tests lowercase filename)
const RE_AI_FILENAME = /\b(llm|openai|anthropic|claude|gpt|gemini|mistral|groq|cohere|embed|vector|rag|chain|agent|prompt)\b/i;

// React hook convention: filename starts with "use" followed by a capital letter
// Tested against the ORIGINAL-CASE stem (not lowercased) to respect naming convention.
const RE_HOOK_FILENAME = /^use[A-Z]/;

// Type/interface/DTO filename suffix (tests lowercase filename)
const RE_TYPE_FILENAME = /\.(types?|interfaces?|d)\.[jt]sx?$/i;

// ─────────────────────────────────────────────────────────────────────────────
// Module-level architecture signal lookup tables
// Pre-built here so buildArchSignals() is a pure O(1) lookup, no allocation.
// ─────────────────────────────────────────────────────────────────────────────

const DOMAIN_ARCH_SIGNALS = {
  [FILE_DOMAINS.BACKEND]:       'server_side',
  [FILE_DOMAINS.FRONTEND]:      'client_side',
  [FILE_DOMAINS.DATABASE]:      'data_persistence',
  [FILE_DOMAINS.INFRASTRUCTURE]:'deployment',
  [FILE_DOMAINS.AI_SYSTEM]:     'ai_integration',
  [FILE_DOMAINS.AUTH_SYSTEM]:   'authentication',
  [FILE_DOMAINS.TESTING]:       'test_coverage',
  [FILE_DOMAINS.CONFIGURATION]: 'configuration',
  [FILE_DOMAINS.DOCUMENTATION]: 'documentation',
  [FILE_DOMAINS.SHARED]:        'shared_code',
};

const ROLE_ARCH_SIGNALS = {
  [ROLES.ENTRY_POINT]:   'application_bootstrap',
  [ROLES.ROUTE_HANDLER]: 'api_endpoint',
  [ROLES.SERVICE]:       'business_logic',
  [ROLES.MODEL]:         'data_model',
  [ROLES.MIGRATION]:     'schema_evolution',
  [ROLES.MIDDLEWARE]:    'request_pipeline',
  [ROLES.COMPONENT]:     'ui_component',
  [ROLES.PAGE]:          'ui_page',
  [ROLES.WORKFLOW]:      'ci_cd',
  [ROLES.CONTAINER]:     'containerization',
  [ROLES.IAC]:           'infrastructure_as_code',
  [ROLES.SCHEMA]:        'data_schema',
  [ROLES.HOOK]:          'state_hook',
  [ROLES.TYPE]:          'type_definition',
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal path helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns lowercase filename (last segment) from a repo-relative path.
 * e.g. "src/auth/JwtService.ts" → "jwtservice.ts"
 */
function getFilename(filePath) {
  const parts = (typeof filePath === 'string' ? filePath : '').split('/');
  return (parts[parts.length - 1] ?? '').toLowerCase();
}

/**
 * Returns lowercase + original-case filename parts.
 * originalStem preserves case for patterns like React hook detection (use[A-Z]).
 *
 * @param {string} filePath
 * @returns {{ filename: string, originalStem: string, stem: string, ext: string }}
 */
function getFilenameParts(filePath) {
  const parts    = (typeof filePath === 'string' ? filePath : '').split('/');
  const original = parts[parts.length - 1] ?? '';
  const lower    = original.toLowerCase();
  const dotIdx   = lower.lastIndexOf('.');

  return {
    filename:     lower,
    originalStem: dotIdx !== -1 ? original.slice(0, dotIdx) : original,
    stem:         dotIdx !== -1 ? lower.slice(0, dotIdx)    : lower,
    ext:          dotIdx !== -1 ? lower.slice(dotIdx)       : '',
  };
}

/**
 * Returns an array of lowercase directory segments (excluding the filename).
 * e.g. "src/auth/middleware/jwt.ts" → ["src", "auth", "middleware"]
 */
function getDirs(filePath) {
  const parts = (typeof filePath === 'string' ? filePath : '').split('/');
  return parts.slice(0, -1).map(s => s.toLowerCase());
}

/**
 * Returns true if any element of dirs is present in targetSet.
 */
function dirsHaveAny(dirs, targetSet) {
  return dirs.some(d => targetSet.has(d));
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines the file domain from contentType, path heuristics, and optional
 * Phase 2 (codeIntelligence) signals.
 *
 * Priority:
 *   1. contentType shortcut (infrastructure / test / doc / config / manifest)
 *   2. CI signals (Phase 2 codeIntelligence file-level domains)
 *   3. Path heuristics: AI → auth → DB → frontend → backend → default
 *
 * @param {string}   contentType
 * @param {string}   filePath
 * @param {string}   ext          — lowercase extension e.g. ".tsx"
 * @param {string[]} dirs         — lowercase directory segments
 * @param {string[]} ciDomains    — domains from codeIntelligence for this file
 * @returns {string}  one of FILE_DOMAINS.*
 */
function resolveDomain(contentType, filePath, ext, dirs, ciDomains) {
  // Content-type based shortcut — these are unambiguous
  switch (contentType) {
    case 'infrastructure': return FILE_DOMAINS.INFRASTRUCTURE;
    case 'test':           return FILE_DOMAINS.TESTING;
    case 'documentation':  return FILE_DOMAINS.DOCUMENTATION;
    case 'manifest':       return FILE_DOMAINS.CONFIGURATION;
    case 'config':         return FILE_DOMAINS.CONFIGURATION;
    // source_code / data fall through to signal-based resolution
  }

  // CI signal resolution (Phase 2 output — highest fidelity for source_code)
  if (Array.isArray(ciDomains) && ciDomains.length > 0) {
    for (const ciDomain of CI_DOMAIN_PRIORITY) {
      if (ciDomains.includes(ciDomain)) {
        const mapped = CI_DOMAIN_MAP[ciDomain];
        if (mapped) return mapped;
      }
    }
  }

  // Path-based fallback (ordered from most-specific to least-specific)

  if (dirsHaveAny(dirs, AI_DIRS) || RE_AI_FILENAME.test(getFilename(filePath))) {
    return FILE_DOMAINS.AI_SYSTEM;
  }

  if (dirsHaveAny(dirs, AUTH_DIRS) || RE_AUTH_FILENAME.test(getFilename(filePath))) {
    return FILE_DOMAINS.AUTH_SYSTEM;
  }

  if (dirsHaveAny(dirs, DB_DIRS)) {
    return FILE_DOMAINS.DATABASE;
  }

  if (FRONTEND_EXTENSIONS.has(ext) || dirsHaveAny(dirs, FRONTEND_DIRS)) {
    return FILE_DOMAINS.FRONTEND;
  }

  if (dirsHaveAny(dirs, BACKEND_DIRS)) {
    return FILE_DOMAINS.BACKEND;
  }

  // Default: source_code with no specific signals is assumed backend
  return FILE_DOMAINS.BACKEND;
}

// ─────────────────────────────────────────────────────────────────────────────
// Role resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines the functional role of a file within its domain.
 *
 * Priority:
 *   1. contentType (test / documentation / config / manifest / infrastructure)
 *   2. Exact entry-point filename match
 *   3. Type/DTO file pattern (filename suffix)
 *   4. React hook pattern (originalStem starts with use[A-Z])
 *   5. Directory-based rules (DIR_ROLE_RULES, first match wins)
 *   6. Extension-based fallback (frontend extensions → component)
 *   7. Domain-based default
 *
 * @param {string}   contentType
 * @param {string}   filePath
 * @param {string}   filename       — lowercase filename
 * @param {string}   originalStem   — original-case stem for hook detection
 * @param {string}   ext            — lowercase extension
 * @param {string[]} dirs           — lowercase directory segments
 * @param {string}   domain         — resolved file domain
 * @returns {string}  one of ROLES.*
 */
function resolveRole(contentType, filePath, filename, originalStem, ext, dirs, domain) {
  // Content-type based roles — unambiguous
  if (contentType === 'test')          return ROLES.TEST;
  if (contentType === 'documentation') return ROLES.DOCUMENTATION;
  if (contentType === 'manifest')      return ROLES.CONFIG;
  if (contentType === 'config')        return ROLES.CONFIG;

  // Infrastructure sub-roles (from contentType === 'infrastructure')
  if (contentType === 'infrastructure') {
    if (RE_DOCKERFILE.test(filename) || RE_COMPOSE.test(filename)) return ROLES.CONTAINER;
    if (RE_WORKFLOW_PATH.test(filePath))                           return ROLES.WORKFLOW;
    if (RE_IaC_EXT.test(filePath) || RE_K8S_PATH.test(filePath)) return ROLES.IAC;
    // .github/ files not caught above (e.g. CODEOWNERS)
    if (/\.github/i.test(filePath))                               return ROLES.CONFIG;
    return ROLES.WORKFLOW; // default for other infrastructure files
  }

  // Source code roles

  // 1. Entry point: exact filename match
  if (ENTRY_POINT_NAMES.has(filename)) return ROLES.ENTRY_POINT;

  // 2. Type/interface/DTO file (suffix pattern on lowercase filename)
  if (RE_TYPE_FILENAME.test(filename)) return ROLES.TYPE;

  // 3. React hook: use[A-Z]... — test ORIGINAL case (must be uppercase after 'use')
  if (RE_HOOK_FILENAME.test(originalStem)) return ROLES.HOOK;

  // 4. Directory-based role assignment (first match wins)
  for (const rule of DIR_ROLE_RULES) {
    if (dirsHaveAny(dirs, rule.dirs)) return rule.role;
  }

  // 5. Extension-based fallback: framework-specific component files
  if (FRONTEND_EXTENSIONS.has(ext)) return ROLES.COMPONENT;

  // 6. Domain-based default
  switch (domain) {
    case FILE_DOMAINS.AUTH_SYSTEM:   return ROLES.MIDDLEWARE;
    case FILE_DOMAINS.DATABASE:      return ROLES.SCHEMA;
    case FILE_DOMAINS.AI_SYSTEM:     return ROLES.SERVICE;
    case FILE_DOMAINS.FRONTEND:      return ROLES.COMPONENT;
    case FILE_DOMAINS.BACKEND:       return ROLES.SERVICE;
    case FILE_DOMAINS.CONFIGURATION: return ROLES.CONFIG;
    default:                         return ROLES.UNKNOWN;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Semantic group resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assigns a semantic retrieval group from domain + role combination.
 * One group per file — the most specific grouping that applies.
 *
 * @param {string} domain
 * @param {string} role
 * @returns {string}  one of SEMANTIC_GROUPS.*
 */
function resolveSemanticGroup(domain, role) {
  switch (domain) {
    case FILE_DOMAINS.TESTING:       return SEMANTIC_GROUPS.TEST_SUITE;
    case FILE_DOMAINS.DOCUMENTATION: return SEMANTIC_GROUPS.DOCUMENTATION;
    case FILE_DOMAINS.INFRASTRUCTURE:return SEMANTIC_GROUPS.INFRA_CONFIG;
    case FILE_DOMAINS.CONFIGURATION: return SEMANTIC_GROUPS.APP_CONFIGURATION;
    case FILE_DOMAINS.AI_SYSTEM:     return SEMANTIC_GROUPS.AI_PIPELINE;
    case FILE_DOMAINS.AUTH_SYSTEM:   return SEMANTIC_GROUPS.AUTH_FLOW;
    case FILE_DOMAINS.DATABASE:      return SEMANTIC_GROUPS.DATA_LAYER;

    case FILE_DOMAINS.FRONTEND:
      if (role === ROLES.PAGE)    return SEMANTIC_GROUPS.UI_PAGES;
      if (role === ROLES.HOOK)    return SEMANTIC_GROUPS.STATE_MANAGEMENT;
      if (role === ROLES.TYPE)    return SEMANTIC_GROUPS.TYPE_DEFINITIONS;
      return SEMANTIC_GROUPS.UI_COMPONENTS;

    case FILE_DOMAINS.BACKEND:
      if (role === ROLES.ROUTE_HANDLER) return SEMANTIC_GROUPS.API_SURFACE;
      if (role === ROLES.MIDDLEWARE)    return SEMANTIC_GROUPS.API_SURFACE;
      if (role === ROLES.UTILITY)       return SEMANTIC_GROUPS.SHARED_UTILITIES;
      if (role === ROLES.TYPE)          return SEMANTIC_GROUPS.TYPE_DEFINITIONS;
      return SEMANTIC_GROUPS.APPLICATION_CORE;  // entry_point, service, model, unknown

    case FILE_DOMAINS.SHARED:
      if (role === ROLES.TYPE) return SEMANTIC_GROUPS.TYPE_DEFINITIONS;
      return SEMANTIC_GROUPS.SHARED_UTILITIES;

    default:
      return SEMANTIC_GROUPS.APPLICATION_CORE;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Architecture signal builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds architecture signals from domain + role when CI signals are unavailable.
 * Uses pre-compiled lookup tables — no allocation of new objects at call time.
 *
 * @param {string} domain
 * @param {string} role
 * @returns {string[]}
 */
function buildArchSignals(domain, role) {
  const signals = [];
  const ds      = DOMAIN_ARCH_SIGNALS[domain];
  const rs      = ROLE_ARCH_SIGNALS[role];
  if (ds) signals.push(ds);
  if (rs) signals.push(rs);
  return signals;
}

// ─────────────────────────────────────────────────────────────────────────────
// Framework context resolver
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the framework context for a file.
 * Uses Phase 2 CI signals when available; falls back to extension inference.
 *
 * @param {string}   ext
 * @param {string[]} ciFrameworks  — frameworks from codeIntelligence for this file
 * @param {string}   domain
 * @returns {string[]}
 */
function resolveFrameworkContext(ext, ciFrameworks, domain) {
  if (Array.isArray(ciFrameworks) && ciFrameworks.length > 0) {
    return ciFrameworks.slice(); // return a copy, not the original array
  }

  // Extension-based fallback
  if (ext === '.vue')    return ['vue'];
  if (ext === '.svelte') return ['svelte'];
  if (ext === '.astro')  return ['astro'];
  if ((ext === '.jsx' || ext === '.tsx') && domain === FILE_DOMAINS.FRONTEND) return ['react'];

  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// CI signal map builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts codeIntelligence output into a path-keyed lookup for O(1) access.
 * Returns an empty object if codeIntelligenceData is absent or malformed.
 *
 * @param {object|null} codeIntelligenceData  — Phase 2 output data object
 * @returns {Object<string, { domains: string[], frameworks: string[], architectureSignals: string[] }>}
 */
function buildCISignalMap(codeIntelligenceData) {
  if (!codeIntelligenceData || typeof codeIntelligenceData !== 'object') return {};

  const fileSignals = codeIntelligenceData.fileSignals;
  if (!Array.isArray(fileSignals)) return {};

  const map = {};

  for (const signal of fileSignals) {
    // Per-entry fault isolation
    if (!signal || typeof signal.path !== 'string') continue;

    map[signal.path] = {
      domains:             Array.isArray(signal.domains)             ? signal.domains             : [],
      frameworks:          Array.isArray(signal.frameworks)          ? signal.frameworks          : [],
      architectureSignals: Array.isArray(signal.architectureSignals) ? signal.architectureSignals : [],
    };
  }

  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// classifyFile — per-file classification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classifies a single enriched file into domain, role, semantic group,
 * importance tier, framework context, and architecture signals.
 *
 * Returns null if the file should be skipped (style, unknown, empty path).
 * Guaranteed not to throw — all exceptions are caught and null is returned.
 *
 * @param {string}      filePath
 * @param {object}      fileData       — enrichment file record
 * @param {object|null} ciFileSignals  — Phase 2 signals for this file (may be null)
 * @returns {object|null}  Classified file record, or null if skipped
 */
function classifyFile(filePath, fileData, ciFileSignals) {
  const contentType = typeof fileData.contentType === 'string'
    ? fileData.contentType
    : 'unknown';

  // Skip files with no semantic classification value
  if (SKIP_CONTENT_TYPES.has(contentType)) return null;

  // Skip files with no usable path
  if (!filePath || typeof filePath !== 'string') return null;

  const { filename, originalStem, ext } = getFilenameParts(filePath);
  const dirs                            = getDirs(filePath);

  // CI signals for this file (from Phase 2 — optional, may be null)
  const ciDomains    = ciFileSignals?.domains             ?? [];
  const ciFrameworks = ciFileSignals?.frameworks          ?? [];
  const ciArchSigs   = ciFileSignals?.architectureSignals ?? [];

  const domain        = resolveDomain(contentType, filePath, ext, dirs, ciDomains);
  const role          = resolveRole(contentType, filePath, filename, originalStem, ext, dirs, domain);
  const semanticGroup = resolveSemanticGroup(domain, role);
  const frameworkCtx  = resolveFrameworkContext(ext, ciFrameworks, domain);

  // Architecture signals: prefer CI-detected (higher fidelity); fall back to derived
  const archSignals = ciArchSigs.length > 0
    ? ciArchSigs.slice()
    : buildArchSignals(domain, role);

  const importanceScore = typeof fileData.score === 'number' ? fileData.score : 0;
  const importanceTier  = typeof fileData.tier  === 'string' ? fileData.tier  : 'minimal';

  return {
    path:                filePath,
    contentType,
    domain,
    role,
    semanticGroup,
    importanceScore,
    importanceTier,
    frameworkContext:    frameworkCtx,
    architectureSignals: archSignals,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a { key: count } breakdown from an array of classified file records.
 * @param {object[]} classifiedFiles
 * @param {string}   field  — 'domain' | 'role' | 'semanticGroup'
 * @returns {Object<string, number>}
 */
function buildBreakdown(classifiedFiles, field) {
  const out = {};
  for (const f of classifiedFiles) {
    const val  = f[field];
    if (typeof val === 'string') {
      out[val] = (out[val] ?? 0) + 1;
    }
  }
  return out;
}

/**
 * Builds a { groupName: [paths] } map for semantic retrieval grouping.
 * @param {object[]} classifiedFiles
 * @returns {Object<string, string[]>}
 */
function buildSemanticGroupMap(classifiedFiles) {
  const groups = {};
  for (const f of classifiedFiles) {
    const g = f.semanticGroup;
    if (!groups[g]) groups[g] = [];
    groups[g].push(f.path);
  }
  return groups;
}

/**
 * Returns the top important files (critical + high tiers), sorted by score desc.
 * @param {object[]} classifiedFiles
 * @returns {object[]}  Lightweight records with path, role, domain, score, tier
 */
function buildImportantFiles(classifiedFiles) {
  return classifiedFiles
    .filter(f => f.importanceTier === 'critical' || f.importanceTier === 'high')
    .sort((a, b) => b.importanceScore - a.importanceScore)
    .map(f => ({
      path:           f.path,
      role:           f.role,
      domain:         f.domain,
      semanticGroup:  f.semanticGroup,
      importanceScore: f.importanceScore,
      importanceTier:  f.importanceTier,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// classifyRepositoryFiles  — Phase 3 entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phase 3 — File Classification.
 *
 * Transforms enriched file data (Phase 1 output) into structured semantic
 * classifications. Uses Phase 2 (codeIntelligence) signals when available
 * to improve domain accuracy for source_code files.
 *
 * Pipeline contract: returns { data, meta, dbUpdate } as expected by
 * runPhaseIsolated() in deepAnalysisPipeline.js.
 *
 *   data     — passed to Phase 4 (semanticChunking); includes fileContents passthrough
 *   meta     — stored in phase_metrics_json by persistCheckpoint()
 *   dbUpdate — { file_manifest_json: … } — persisted immediately after phase completes
 *
 * @param {object}      enrichmentData        — Phase 1 enrichResult.data
 *   @param {object}   enrichmentData.fileContents  — { path → enriched file object }
 *   @param {object}   enrichmentData.repoMeta      — normalised repo metadata
 *   @param {object}   enrichmentData.complexity    — complexity estimate
 *   @param {object}   enrichmentData.summary       — enrichment summary stats
 *
 * @param {object|null} codeIntelligenceData  — Phase 2 ciResult.data (optional)
 *   @param {object[]} codeIntelligenceData.fileSignals — per-file signal objects
 *
 * @returns {{ data: object, meta: object, dbUpdate: object }}
 */
function classifyRepositoryFiles(enrichmentData, codeIntelligenceData) {
  console.log('[fileClassification] classifyRepositoryFiles invoked');
  // Defensive normalisation
  const safe         = (enrichmentData && typeof enrichmentData === 'object') ? enrichmentData : {};
  const fileContents = (safe.fileContents && typeof safe.fileContents === 'object')
    ? safe.fileContents
    : {};

  // Build O(1) CI signal lookup (empty map if Phase 2 was skipped / failed)
  const ciSignalMap = buildCISignalMap(codeIntelligenceData ?? null);

  // ── Per-file classification ───────────────────────────────────────────────
  const classifiedFiles = [];
  let   skippedFiles    = 0;

  for (const [filePath, fileData] of Object.entries(fileContents)) {
    try {
      const ciSignals = ciSignalMap[filePath] ?? null;
      const result    = classifyFile(filePath, fileData, ciSignals);

      if (result === null) {
        skippedFiles++;
      } else {
        classifiedFiles.push(result);
      }
    } catch {
      // Per-file fault isolation: a broken file object never aborts the phase
      skippedFiles++;
    }
  }

  // ── Aggregation ───────────────────────────────────────────────────────────
  const domainBreakdown  = buildBreakdown(classifiedFiles, 'domain');
  const roleBreakdown    = buildBreakdown(classifiedFiles, 'role');
  const semanticGroups   = buildSemanticGroupMap(classifiedFiles);
  const importantFiles   = buildImportantFiles(classifiedFiles);

  const domainsDetected  = Object.keys(domainBreakdown);
  const groupsDetected   = Object.keys(semanticGroups);

  const summary = {
    totalInputFiles:        Object.keys(fileContents).length,
    filesClassified:        classifiedFiles.length,
    filesSkipped:           skippedFiles,
    domainsDetected,
    semanticGroupsDetected: groupsDetected,
    importantFilesCount:    importantFiles.length,
  };

  // ── Phase 3 output (passed to Phase 4 semanticChunking) ──────────────────
  // fileContents is passed through so Phase 4 can access raw content for chunking.
  // It is NOT stored in dbUpdate to avoid redundancy with github_enrichment_json.
  const data = {
    classifiedFiles,
    domainBreakdown,
    roleBreakdown,
    semanticGroups,
    importantFiles,
    summary,
    fileContents,      // passthrough for Phase 4 — not stored in DB
    analysisVersion:   2,
    classifiedAt:      new Date().toISOString(),
  };

  // ── Phase metrics (stored in phase_metrics_json) ──────────────────────────
  // Shape matches phaseTracker.js documentation for fileClassification phase.
  const meta = {
    filesClassified:        classifiedFiles.length,
    domainsDetected:        domainsDetected.length,
    domainBreakdown,
    roleCounts:             roleBreakdown,
    semanticGroupsDetected: groupsDetected.length,
    importantFilesCount:    importantFiles.length,
  };

  // ── DB update — stored in file_manifest_json ──────────────────────────────
  // Excludes fileContents (already in github_enrichment_json) to avoid bloat.
  const dbPayload = {
    classifiedFiles,
    domainBreakdown,
    roleBreakdown,
    semanticGroups,
    importantFiles,
    summary,
    analysisVersion:   2,
    classifiedAt:      data.classifiedAt,
  };

  return {
    data,
    meta,
    dbUpdate: { file_manifest_json: dbPayload },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  classifyRepositoryFiles,   // Phase 3 entry point
  classifyFile,              // exported for unit testing
  buildCISignalMap,          // exported for unit testing
  FILE_DOMAINS,
  ROLES,
  SEMANTIC_GROUPS,
};
