'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// codeIntelligencePython.js
//
// Python-side detection rules for the same deterministic code-intelligence
// engine as codeIntelligence.js (JS/TS). Extracted into its own module rather
// than growing codeIntelligence.js further (already well past this repo's
// file-size ceiling — see CLAUDE.md's Modular Composition Rule) and to avoid
// a circular require() between the two (both need CONFIDENCE/DOMAINS, pulled
// from codeIntelligenceConstants.js instead of one requiring the other).
//
// Added because Python backends (FastAPI, Flask, Django, etc.) had zero
// detection here before — every rule in codeIntelligence.js ran unguarded
// against every file regardless of language, so a Python file's
// `@app.get("/path")` decorator textually matched the Express content
// heuristic (`app\.(get|post|...)\(`), misidentifying Python APIs as
// Express. See PROGRESS.md M63.
// ─────────────────────────────────────────────────────────────────────────────

const { CONFIDENCE, DOMAINS } = require('./codeIntelligenceConstants');

function getFilename(filePath) {
  const parts = (typeof filePath === 'string' ? filePath : '').split('/');
  return (parts[parts.length - 1] ?? '').toLowerCase();
}

function getExtension(filePath) {
  const fn  = getFilename(filePath);
  const idx = fn.lastIndexOf('.');
  return idx !== -1 ? fn.slice(idx) : '';
}

function isPyFile(filePath) {
  return getExtension(filePath) === '.py';
}

/**
 * Builds a RegExp matching Python's `import pkg` / `from pkg import X` /
 * `from pkg.sub import X` — no quotes, unlike JS import/require syntax.
 */
function importPatternPy(pkg) {
  const esc = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n)\\s*(?:import\\s+${esc}\\b|from\\s+${esc}(?:\\.[\\w.]+)?\\s+import\\b)`);
}

const IMPORT_PY = {
  fastapi:    importPatternPy('fastapi'),
  flask:      importPatternPy('flask'),
  django:     importPatternPy('django'),
  sqlalchemy: importPatternPy('sqlalchemy'),
  celery:     importPatternPy('celery'),
  rq:         importPatternPy('rq'),
  redis:      importPatternPy('redis'),
  pydantic:   importPatternPy('pydantic'),
  psycopg2:   importPatternPy('psycopg2'),
  asyncpg:    importPatternPy('asyncpg'),
  pytest:     importPatternPy('pytest'),
  boto3:      importPatternPy('boto3'),
  openai:     importPatternPy('openai'),
  requests:   importPatternPy('requests'),
  httpx:      importPatternPy('httpx'),
};

const MANIFEST_FILENAME_RE = /^(pyproject\.toml|requirements.*\.txt|pipfile)$/i;
function isPyManifestFile(filePath) {
  return MANIFEST_FILENAME_RE.test(getFilename(filePath));
}

// Manifest files (pyproject.toml / requirements*.txt / Pipfile) are always
// included in what deep-analysis fetches and are a far more reliable single-
// file signal than hoping a specific importing .py file made it into the
// (size/count-capped) set of files actually scanned. A dependency simply
// being declared there is CONFIG-level confidence, same tier as an explicit
// package.json entry on the JS side.
function manifestDeclares(pkgName, { technology, domain, framework = null, architectureSignal = null }) {
  const pkgRe = new RegExp(pkgName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return {
    domain, technology, framework, architectureSignal,
    confidence: CONFIDENCE.CONFIG, matchType: 'config',
    test: f => isPyManifestFile(f.path) && pkgRe.test(f.content),
  };
}

const MANIFEST_RULES = [
  manifestDeclares('fastapi',           { technology: 'fastapi',    domain: DOMAINS.API_LAYER,      framework: 'fastapi', architectureSignal: 'rest_api' }),
  manifestDeclares('flask',             { technology: 'flask',      domain: DOMAINS.API_LAYER,      framework: 'flask',   architectureSignal: 'rest_api' }),
  manifestDeclares('django',            { technology: 'django',     domain: DOMAINS.API_LAYER,      framework: 'django',  architectureSignal: 'mvc_web_framework' }),
  manifestDeclares('sqlalchemy',        { technology: 'sqlalchemy', domain: DOMAINS.DATABASE,       architectureSignal: 'orm' }),
  manifestDeclares('psycopg2',          { technology: 'postgresql', domain: DOMAINS.DATABASE,       architectureSignal: 'relational_database' }),
  manifestDeclares('asyncpg',           { technology: 'postgresql', domain: DOMAINS.DATABASE,       architectureSignal: 'relational_database' }),
  manifestDeclares('celery',            { technology: 'celery',     domain: DOMAINS.INFRASTRUCTURE, framework: 'celery',  architectureSignal: 'task_queue' }),
  manifestDeclares('\\brq\\b',          { technology: 'rq',         domain: DOMAINS.INFRASTRUCTURE, framework: 'rq',      architectureSignal: 'task_queue' }),
  manifestDeclares('redis',             { technology: 'redis',      domain: DOMAINS.DATABASE,       architectureSignal: 'cache_store' }),
  manifestDeclares('pydantic',          { technology: 'pydantic',   domain: DOMAINS.API_LAYER,      architectureSignal: 'schema_validation' }),
  manifestDeclares('uvicorn',           { technology: 'uvicorn',    domain: DOMAINS.INFRASTRUCTURE, architectureSignal: 'asgi_server' }),
  manifestDeclares('gunicorn',          { technology: 'gunicorn',   domain: DOMAINS.INFRASTRUCTURE, architectureSignal: 'wsgi_server' }),
  manifestDeclares('pytest',            { technology: 'pytest',     domain: DOMAINS.INFRASTRUCTURE, architectureSignal: 'automated_testing' }),
  manifestDeclares('boto3',             { technology: 'aws-sdk',    domain: DOMAINS.INFRASTRUCTURE, architectureSignal: 'cloud_integration' }),
  manifestDeclares('openai',            { technology: 'openai',     domain: DOMAINS.AI_TOOLING,     architectureSignal: 'llm_integration' }),
];

const PYTHON_RULES = [
  // ── FastAPI ─────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.API_LAYER, technology: 'fastapi', framework: 'fastapi',
    architectureSignal: 'rest_api',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => isPyFile(f.path) && IMPORT_PY.fastapi.test(f.content),
  },
  {
    domain: DOMAINS.API_LAYER, technology: 'fastapi', framework: 'fastapi',
    architectureSignal: 'rest_api',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    // route decorators (@app.get/@router.post/etc.) + FastAPI() app construction
    test: f => isPyFile(f.path) &&
               (/FastAPI\s*\(/.test(f.content) ||
                /@(app|router)\.(get|post|put|delete|patch)\s*\(/.test(f.content)),
  },

  // ── Uvicorn / Gunicorn (ASGI/WSGI servers — how a FastAPI/Flask app actually runs) ──
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'uvicorn', framework: null,
    architectureSignal: 'asgi_server',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /uvicorn[\s.]+run\s*\(|uvicorn\s+[\w.]+:app|uvicorn\.workers/i.test(f.content),
  },
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'gunicorn', framework: null,
    architectureSignal: 'wsgi_server',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /gunicorn\b.*(-k|--worker-class)|gunicorn\.conf/i.test(f.content),
  },

  // ── Flask ───────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.API_LAYER, technology: 'flask', framework: 'flask',
    architectureSignal: 'rest_api',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => isPyFile(f.path) && IMPORT_PY.flask.test(f.content),
  },
  {
    domain: DOMAINS.API_LAYER, technology: 'flask', framework: 'flask',
    architectureSignal: 'rest_api',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => isPyFile(f.path) &&
               (/Flask\s*\(\s*__name__/.test(f.content) || /@(app|bp|blueprint)\.route\s*\(/.test(f.content)),
  },

  // ── Django ──────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.API_LAYER, technology: 'django', framework: 'django',
    architectureSignal: 'mvc_web_framework',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => isPyFile(f.path) && IMPORT_PY.django.test(f.content),
  },
  {
    domain: DOMAINS.API_LAYER, technology: 'django', framework: 'django',
    architectureSignal: 'mvc_web_framework',
    confidence: CONFIDENCE.CONFIG, matchType: 'config',
    test: f => /^manage\.py$/i.test(getFilename(f.path)) && /django/i.test(f.content),
  },
  {
    domain: DOMAINS.API_LAYER, technology: 'django-rest-framework', framework: 'django-rest-framework',
    architectureSignal: 'rest_api',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => isPyFile(f.path) && importPatternPy('rest_framework').test(f.content),
  },

  // ── SQLAlchemy (ORM / DB access layer) ───────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'sqlalchemy', framework: null,
    architectureSignal: 'orm',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => isPyFile(f.path) && IMPORT_PY.sqlalchemy.test(f.content),
  },

  // ── psycopg2 / asyncpg (direct PostgreSQL drivers) ───────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'postgresql', framework: null,
    architectureSignal: 'relational_database',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => isPyFile(f.path) && (IMPORT_PY.psycopg2.test(f.content) || IMPORT_PY.asyncpg.test(f.content)),
  },

  // ── Celery / RQ (Python async task/worker queues) ────────────────────────────
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'celery', framework: 'celery',
    architectureSignal: 'task_queue',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => isPyFile(f.path) && IMPORT_PY.celery.test(f.content),
  },
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'rq', framework: 'rq',
    architectureSignal: 'task_queue',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => isPyFile(f.path) && IMPORT_PY.rq.test(f.content),
  },

  // ── Redis (Python client) ────────────────────────────────────────────────────
  {
    domain: DOMAINS.DATABASE, technology: 'redis', framework: null,
    architectureSignal: 'cache_store',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => isPyFile(f.path) && IMPORT_PY.redis.test(f.content),
  },

  // ── PgBouncer (connection pooler — config/infra signal, not a Python import) ─
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'pgbouncer', framework: null,
    architectureSignal: 'connection_pooling',
    confidence: CONFIDENCE.CONTENT, matchType: 'content',
    test: f => /pgbouncer/i.test(f.content),
  },

  // ── Pydantic (validation/schema layer used heavily by FastAPI) ──────────────
  {
    domain: DOMAINS.API_LAYER, technology: 'pydantic', framework: null,
    architectureSignal: 'schema_validation',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => isPyFile(f.path) && IMPORT_PY.pydantic.test(f.content),
  },

  // ── pytest ────────────────────────────────────────────────────────────────
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'pytest', framework: null,
    architectureSignal: 'automated_testing',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => isPyFile(f.path) && IMPORT_PY.pytest.test(f.content),
  },

  // ── boto3 (AWS SDK) ───────────────────────────────────────────────────────
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'aws-sdk', framework: null,
    architectureSignal: 'cloud_integration',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => isPyFile(f.path) && IMPORT_PY.boto3.test(f.content),
  },

  // ── OpenAI Python SDK ─────────────────────────────────────────────────────
  {
    domain: DOMAINS.AI_TOOLING, technology: 'openai', framework: null,
    architectureSignal: 'llm_integration',
    confidence: CONFIDENCE.IMPORT, matchType: 'import',
    test: f => isPyFile(f.path) && IMPORT_PY.openai.test(f.content),
  },

  // ── Python itself, as a language signal — config-level, always present when
  // a real Python project manifest exists (mirrors how other languages get a
  // baseline "this is a Python codebase" signal even with no framework detected) ──
  {
    domain: DOMAINS.INFRASTRUCTURE, technology: 'python', framework: null,
    architectureSignal: null,
    confidence: CONFIDENCE.CONFIG, matchType: 'config',
    test: f => /^(pyproject\.toml|requirements.*\.txt|pipfile|setup\.py)$/i.test(getFilename(f.path)),
  },
].concat(MANIFEST_RULES);

module.exports = { PYTHON_RULES };
