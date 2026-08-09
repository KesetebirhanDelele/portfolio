'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// intelligenceAgents.js
//
// Deterministic repository intelligence synthesizer for the v2 deep-analysis
// pipeline. Implements Phase 5 (Intelligence Agents) of runDeepAnalysisPipeline.
//
// Receives semantic chunks (Phase 4) and code intelligence signals (Phase 2)
// and produces eight specialized analytical lenses over the repository using
// only deterministic, structural inference — no AI/LLM calls.
//
// Design constraints:
//   - Zero external dependencies (no require() of any npm package)
//   - No AI/LLM calls — all outputs are derived deterministically from inputs
//   - Fault-tolerant — a failing agent never aborts the phase
//   - Signals computed once (buildSignals) and shared across all agents
//   - Fully deterministic — same input always produces identical output
// ─────────────────────────────────────────────────────────────────────────────

// ── Analysis version ───────────────────────────────────────────────────────────
// Bumped when the intelligence schema changes in a backwards-incompatible way.

const ANALYSIS_VERSION = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Lookup tables — compiled once at module load
// ─────────────────────────────────────────────────────────────────────────────

// ── Human-readable technology names ──────────────────────────────────────────

const TECH_LABELS = {
  'nextjs':          'Next.js',
  'react':           'React',
  'vue':             'Vue',
  'angular':         'Angular',
  'svelte':          'Svelte',
  'tailwind':        'Tailwind CSS',
  'redux':           'Redux',
  'zustand':         'Zustand',
  'jotai':           'Jotai',
  'express':         'Express',
  'fastify':         'Fastify',
  'nestjs':          'NestJS',
  'graphql':         'GraphQL',
  'trpc':            'tRPC',
  'koa':             'Koa',
  'hono':            'Hono',
  'prisma':          'Prisma',
  'drizzle':         'Drizzle ORM',
  'mongoose':        'Mongoose',
  'sequelize':       'Sequelize',
  'typeorm':         'TypeORM',
  'knex':            'Knex',
  'postgresql':      'PostgreSQL',
  'mysql':           'MySQL',
  'mongodb':         'MongoDB',
  'redis':           'Redis',
  'elasticsearch':   'Elasticsearch',
  'dynamodb':        'DynamoDB',
  'openai':          'OpenAI',
  'anthropic':       'Anthropic',
  'langchain':       'LangChain',
  'llamaindex':      'LlamaIndex',
  'vercel-ai-sdk':   'Vercel AI SDK',
  'pinecone':        'Pinecone',
  'weaviate':        'Weaviate',
  'chromadb':        'ChromaDB',
  'embeddings':      'Embeddings',
  'mistral':         'Mistral',
  'cohere':          'Cohere',
  'groq':            'Groq',
  'jwt':             'JWT',
  'passport':        'Passport.js',
  'next-auth':       'NextAuth',
  'clerk':           'Clerk',
  'firebase-auth':   'Firebase Auth',
  'better-auth':     'Better Auth',
  'lucia':           'Lucia',
  'docker':          'Docker',
  'kubernetes':      'Kubernetes',
  'github-actions':  'GitHub Actions',
  'terraform':       'Terraform',
  'stripe':          'Stripe',
};

// ── Technology category sets ───────────────────────────────────────────────────

const FRONTEND_TECHS     = new Set(['react', 'nextjs', 'vue', 'angular', 'svelte',
                                     'tailwind', 'redux', 'zustand', 'jotai']);
const BACKEND_TECHS      = new Set(['express', 'fastify', 'nestjs', 'graphql',
                                     'trpc', 'koa', 'hono']);
const DATABASE_TECHS     = new Set(['prisma', 'drizzle', 'mongoose', 'sequelize',
                                     'typeorm', 'knex', 'postgresql', 'mysql',
                                     'mongodb', 'redis', 'elasticsearch', 'dynamodb']);
const AI_TECHS           = new Set(['openai', 'anthropic', 'langchain', 'llamaindex',
                                     'vercel-ai-sdk', 'pinecone', 'weaviate', 'chromadb',
                                     'embeddings', 'mistral', 'cohere', 'groq']);
const VECTOR_DB_TECHS    = new Set(['pinecone', 'weaviate', 'chromadb']);
const AUTH_TECHS         = new Set(['jwt', 'passport', 'next-auth', 'clerk',
                                     'firebase-auth', 'better-auth', 'lucia']);
const INFRA_TECHS        = new Set(['docker', 'kubernetes', 'github-actions', 'terraform']);
const AI_ORCHESTRATORS   = new Set(['langchain', 'llamaindex', 'vercel-ai-sdk']);

// ── Architecture pattern → human-readable labels ──────────────────────────────

const ARCH_PATTERN_LABELS = {
  'rest_api':                'RESTful API',
  'stateless_auth':          'Stateless JWT Authentication',
  'strategy_based_auth':     'Strategy-Based Authentication',
  'provider_based_auth':     'OAuth Provider Authentication',
  'hosted_auth_provider':    'Hosted Authentication Provider',
  'orm':                     'ORM Data Access',
  'query_builder':           'Query Builder Data Access',
  'document_database_odm':   'Document ODM',
  'llm_integration':         'LLM Integration',
  'llm_orchestration':       'LLM Orchestration',
  'rag_framework':           'Retrieval-Augmented Generation (RAG)',
  'vector_database':         'Vector Database',
  'vector_embeddings':       'Vector Embeddings',
  'component_ui':            'Component-Based UI',
  'ssr_framework':           'Server-Side Rendering (SSR)',
  'global_state_management': 'Global State Management',
  'containerization':        'Docker Containerization',
  'cicd_pipeline':           'CI/CD Pipeline',
  'infrastructure_as_code':  'Infrastructure as Code',
  'payment_processing':      'Payment Processing',
  'enterprise_rest_api':     'Enterprise REST API (NestJS)',
  'graphql_api':             'GraphQL API',
  'type_safe_api':           'Type-Safe API (tRPC)',
  'relational_database':     'Relational Database',
  'cache_store':             'Caching Layer',
  'search_database':         'Full-Text Search',
  'utility_css_framework':   'Utility-First CSS',
};

// ── Semantic group → feature description ─────────────────────────────────────

const SEMANTIC_GROUP_FEATURES = {
  'api_surface':       'RESTful API endpoints',
  'data_layer':        'database persistence layer',
  'auth_flow':         'user authentication and session management',
  'ui_components':     'reusable UI component library',
  'ui_pages':          'full-page application routing',
  'ai_pipeline':       'AI/ML integration pipeline',
  'infra_config':      'production infrastructure configuration',
  'test_suite':        'automated test coverage',
  'shared_utilities':  'shared utility functions',
  'state_management':  'client-side state management',
  'app_configuration': 'environment and application configuration',
  'type_definitions':  'TypeScript type system',
  'application_core':  'core application services',
  'documentation':     'project documentation',
};

// ── Semantic group → architectural layer name ─────────────────────────────────

const SEMANTIC_GROUP_LAYER_MAP = {
  'ui_pages':          'Presentation Layer',
  'ui_components':     'Presentation Layer',
  'state_management':  'Presentation Layer',
  'api_surface':       'API Layer',
  'application_core':  'Business Logic Layer',
  'auth_flow':         'Security Layer',
  'data_layer':        'Data Layer',
  'ai_pipeline':       'AI Integration Layer',
  'infra_config':      'Infrastructure Layer',
  'app_configuration': 'Configuration Layer',
  'shared_utilities':  'Shared Utilities',
  'test_suite':        'Test Coverage',
  'type_definitions':  'Type System',
  'documentation':     'Documentation',
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deduplicates an array, filtering all falsy values.
 *
 * @param {any[]} arr
 * @returns {any[]}
 */
function unique(arr) {
  return [...new Set((Array.isArray(arr) ? arr : []).filter(Boolean))];
}

/**
 * Formats an array into a natural-language list.
 * ['A','B','C'] → 'A, B, and C'
 *
 * @param {string[]} arr
 * @param {number}   max  — maximum items to include before truncating
 * @returns {string}
 */
function formatList(arr, max = 5) {
  const items = unique(arr).slice(0, max);
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/**
 * Returns a human-readable display name for a technology key.
 * Falls back to the raw key when no label is registered.
 *
 * @param {string} key
 * @returns {string}
 */
function techLabel(key) {
  return TECH_LABELS[key] ?? key;
}

/**
 * Infers the project type from chunk-domain and semantic-group presence.
 * Priority resolves in order: AI > full-stack > frontend-only > API > data.
 *
 * @param {string[]} chunkDomains    — unique domain values from Phase 4 chunks
 * @param {string[]} semanticGroups  — unique semantic group names from Phase 4 chunks
 * @returns {string}  project type key
 */
function inferProjectType(chunkDomains, semanticGroups) {
  const hasUi  = semanticGroups.some(g => g === 'ui_pages' || g === 'ui_components');
  const hasApi = semanticGroups.includes('api_surface');
  const hasAi  = semanticGroups.includes('ai_pipeline') || chunkDomains.includes('ai_system');
  const hasFE  = chunkDomains.includes('frontend');
  const hasBE  = chunkDomains.includes('backend');
  const hasDB  = chunkDomains.includes('database') || semanticGroups.includes('data_layer');

  if (hasAi && hasApi && hasUi) return 'ai_fullstack_application';
  if (hasAi && hasApi)          return 'ai_powered_api';
  if (hasAi && hasFE)           return 'ai_application';
  if (hasAi)                    return 'ai_project';
  if (hasFE && hasBE && hasDB)  return 'fullstack_application';
  if (hasFE && hasBE)           return 'fullstack_application';
  if (hasFE && !hasBE)          return 'frontend_application';
  if (hasApi && hasDB)          return 'api_service';
  if (hasApi)                   return 'api_service';
  if (hasDB)                    return 'data_application';
  return 'software_project';
}

/**
 * Returns a human-readable display label for a project type key.
 *
 * @param {string} projectType
 * @returns {string}
 */
function projectTypeLabel(projectType) {
  const LABELS = {
    'ai_fullstack_application': 'AI-powered full-stack application',
    'ai_powered_api':           'AI-powered API service',
    'ai_application':           'AI-integrated web application',
    'ai_project':               'AI/ML project',
    'fullstack_application':    'full-stack web application',
    'frontend_application':     'frontend web application',
    'api_service':              'backend API service',
    'data_application':         'data-driven application',
    'software_project':         'software project',
  };
  return LABELS[projectType] ?? 'software project';
}

/**
 * Estimates developer seniority from multiple complexity signals.
 * Returns 'junior' | 'mid' | 'senior'.
 *
 * Scoring:
 *   technology breadth (1–3) + architectural complexity (1–2) +
 *   relationship density (1–2) + feature signals (1–2 each) +
 *   domain breadth (1–2) → junior < 6, mid 6–11, senior ≥ 12
 *
 * @param {object} opts
 * @returns {'junior'|'mid'|'senior'}
 */
function inferSeniority({
  techCount, chunkCount, relationshipCount,
  hasInfra, hasAi, hasTesting, domainCount, hasAuthSystem, hasOrchestration,
}) {
  let score = 0;

  // Technology breadth
  if (techCount >= 8)          score += 3;
  else if (techCount >= 5)     score += 2;
  else if (techCount >= 3)     score += 1;

  // Architectural complexity (chunk count)
  if (chunkCount >= 8)         score += 2;
  else if (chunkCount >= 4)    score += 1;

  // Relationship graph density
  if (relationshipCount >= 10) score += 2;
  else if (relationshipCount >= 5) score += 1;

  // Feature-level signals
  if (hasInfra)                score += 2;
  if (hasAi)                   score += 2;
  if (hasOrchestration)        score += 2;
  if (hasTesting)              score += 1;
  if (hasAuthSystem)           score += 1;

  // Domain breadth
  if (domainCount >= 5)        score += 2;
  else if (domainCount >= 3)   score += 1;

  if (score >= 12) return 'senior';
  if (score >= 6)  return 'mid';
  return 'junior';
}

/**
 * Joins non-empty string parts into a single space-separated narrative string.
 *
 * @param {Array<string|null|undefined>} parts
 * @returns {string}
 */
function buildNarrative(parts) {
  return (Array.isArray(parts) ? parts : [])
    .filter(p => typeof p === 'string' && p.trim().length > 0)
    .join(' ');
}

/**
 * Returns the correct indefinite article ('a' or 'an') for a word.
 * Checks the first character of the word — vowel-initial words use 'an'.
 *
 * @param {string} word
 * @returns {'a'|'an'}
 */
function article(word) {
  return /^[aeiouAEIOU]/.test(typeof word === 'string' ? word : '') ? 'an' : 'a';
}

// ─────────────────────────────────────────────────────────────────────────────
// buildSignals — shared signal extraction computed once per orchestrator call
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts and normalises all structural signals from Phase 4 (chunkingData)
 * and Phase 2 (repoMeta) outputs into a single flat signals object.
 *
 * Computing signals once and sharing them across all agents avoids redundant
 * iteration and guarantees that every agent operates on identical input data.
 *
 * @param {object} chunkingData  — Phase 4 data (already safe-normalised by caller)
 * @param {object} repoMeta      — Phase 2 data (already safe-normalised by caller)
 * @returns {object}  Flat signals object consumed by all agent functions
 */
function buildSignals(chunkingData, repoMeta) {
  // ── Chunks ────────────────────────────────────────────────────────────────
  const chunks = Array.isArray(chunkingData.chunks) ? chunkingData.chunks : [];

  // ── Technologies: Phase 4 chunks + Phase 2 meta (merged, deduped) ─────────
  const techFromChunks    = chunks.flatMap(c => Array.isArray(c.technologies) ? c.technologies : []);
  const techFromMeta      = Array.isArray(repoMeta.technologies) ? repoMeta.technologies : [];
  const technologies      = unique([...techFromChunks, ...techFromMeta]);

  // ── Frameworks: Phase 2 meta ───────────────────────────────────────────────
  const frameworks = unique(Array.isArray(repoMeta.frameworks) ? repoMeta.frameworks : []);

  // ── Architecture patterns: Phase 4 chunks + Phase 2 meta ──────────────────
  const patternsFromChunks = chunks.flatMap(c => Array.isArray(c.architecturePatterns) ? c.architecturePatterns : []);
  const patternsFromMeta   = Array.isArray(repoMeta.architecturePatterns) ? repoMeta.architecturePatterns : [];
  const archPatterns       = unique([...patternsFromChunks, ...patternsFromMeta]);

  // ── Semantic groups and chunk domains from Phase 4 classification ──────────
  const semanticGroups = unique(chunks.map(c => c.semanticGroup).filter(Boolean));
  const chunkDomains   = unique(chunks.map(c => c.domain).filter(Boolean));

  // ── Phase 2 code-intelligence domains (separate namespace) ────────────────
  const ci2Domains = unique(Array.isArray(repoMeta.detectedDomains) ? repoMeta.detectedDomains : []);

  // ── Dominant stack and structural summary ─────────────────────────────────
  const dominantStack      = (typeof repoMeta.dominantStack === 'string' && repoMeta.dominantStack !== 'unknown') ? repoMeta.dominantStack : null;
  const chunkRelationships = Array.isArray(chunkingData.chunkRelationships) ? chunkingData.chunkRelationships : [];
  const retrievalIndex     = (chunkingData.retrievalIndex && typeof chunkingData.retrievalIndex === 'object')
    ? chunkingData.retrievalIndex : {};
  const phaseSummary       = (chunkingData.summary && typeof chunkingData.summary === 'object')
    ? chunkingData.summary : {};

  // ── Repository metadata (nested inside Phase 2 output) ────────────────────
  const repoTopics      = Array.isArray(repoMeta.repoMeta?.topics) ? repoMeta.repoMeta.topics : [];
  const primaryLanguage = typeof repoMeta.repoMeta?.primaryLanguage === 'string'
    ? repoMeta.repoMeta.primaryLanguage : null;
  const complexityTier  = typeof repoMeta.complexity?.tier === 'string'
    ? repoMeta.complexity.tier : null;

  // ── Derived boolean convenience flags ─────────────────────────────────────
  const hasAi          = chunkDomains.includes('ai_system')
                       || semanticGroups.includes('ai_pipeline')
                       || technologies.some(t => AI_TECHS.has(t));
  const hasInfra       = semanticGroups.includes('infra_config')
                       || chunkDomains.includes('infrastructure');
  const hasTesting     = semanticGroups.includes('test_suite');
  const hasAuthSystem  = chunkDomains.includes('auth_system')
                       || semanticGroups.includes('auth_flow');
  const hasOrchestration = technologies.some(t => AI_ORCHESTRATORS.has(t));
  const hasFrontend    = chunkDomains.includes('frontend');
  const hasBackend     = chunkDomains.includes('backend');

  const techCount         = technologies.length;
  const chunkCount        = chunks.length;
  const relationshipCount = chunkRelationships.length;
  const domainCount       = chunkDomains.length;

  const projectType = inferProjectType(chunkDomains, semanticGroups);
  const seniority   = inferSeniority({
    techCount, chunkCount, relationshipCount,
    hasInfra, hasAi, hasTesting, domainCount, hasAuthSystem, hasOrchestration,
  });

  return {
    // Raw data
    chunks, technologies, frameworks, archPatterns,
    semanticGroups, chunkDomains, ci2Domains,
    chunkRelationships, retrievalIndex, phaseSummary,
    repoTopics, primaryLanguage, complexityTier,
    // Derived strings
    dominantStack, projectType, seniority,
    // Derived counts
    techCount, chunkCount, relationshipCount, domainCount,
    // Derived booleans
    hasAi, hasInfra, hasTesting, hasAuthSystem, hasOrchestration,
    hasFrontend, hasBackend,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent functions
//
// Each agent receives (chunkingData, repoMeta, signals) where `signals` is the
// pre-computed output of buildSignals(). All signal access goes through
// `signals`; the raw inputs are retained in the signature for forward
// compatibility when AI prompts are introduced.
//
// Every function is async to support a future AI-powered drop-in replacement
// without signature changes. All current outputs are deterministic — no I/O.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Executive Summary Agent.
 * Synthesises a headline, project type, narrative overview, and key highlights
 * from dominant stack, technologies, semantic groups, and detected domains.
 *
 * @param {object} chunkingData
 * @param {object} repoMeta
 * @param {object} signals  — pre-computed buildSignals() output
 * @returns {Promise<object>}
 */
async function runExecutiveSummaryAgent(chunkingData, repoMeta, signals) {
  const {
    technologies, dominantStack, projectType,
    semanticGroups, hasAi, hasInfra, hasTesting, hasAuthSystem, chunkCount,
  } = signals;

  const typeLabel = projectTypeLabel(projectType);

  // Headline: dominant stack + project type label
  const headline = dominantStack
    ? `${dominantStack} ${typeLabel}`
    : typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);

  // Features detected in semantic groups (used in overview and highlights)
  const detectedFeatures = semanticGroups
    .map(g => SEMANTIC_GROUP_FEATURES[g])
    .filter(Boolean);

  // Overview: up to three sentences built from structural facts
  const techList    = formatList(technologies.slice(0, 4).map(techLabel), 4);
  const featureList = formatList(detectedFeatures.slice(0, 3), 3);

  const layerWord = chunkCount === 1 ? 'layer' : 'layers';
  const s1 = `This ${typeLabel} is built with ${dominantStack ?? techList} and structured across ${chunkCount} architectural ${layerWord}.`;

  const s2 = featureList ? `The codebase implements ${featureList}.` : null;

  const s3 = hasAi
    ? 'AI/ML capabilities are deeply integrated into the architecture.'
    : hasInfra
    ? 'The project includes production-ready infrastructure configuration.'
    : hasTesting
    ? 'Automated testing is present to validate core functionality.'
    : null;

  const overview = buildNarrative([s1, s2, s3]) || `A ${typeLabel} repository.`;

  // Key highlights: specific, factual, portfolio-grade bullets
  const highlights = [];
  if (dominantStack)   highlights.push(`Built with ${dominantStack}`);
  if (hasAi)           highlights.push('AI/ML capabilities integrated');
  if (hasInfra)        highlights.push('Production-ready infrastructure');
  if (hasTesting)      highlights.push('Automated test coverage');
  if (hasAuthSystem)   highlights.push('Authentication system');
  if (semanticGroups.includes('data_layer'))  highlights.push('Persistent data layer');
  if (semanticGroups.includes('api_surface')) highlights.push('RESTful API surface');

  // Pad with top technologies when highlights are sparse
  for (const t of technologies) {
    if (highlights.length >= 5) break;
    const label = techLabel(t);
    if (!highlights.some(h => h.includes(label))) highlights.push(label);
  }

  return {
    headline,
    projectType,
    overview,
    keyHighlights: unique(highlights).slice(0, 5),
  };
}

/**
 * Architecture Agent.
 * Infers architecture layers from semantic groups, maps patterns to readable
 * labels, identifies architectural strengths, and determines system shape.
 *
 * @param {object} chunkingData
 * @param {object} repoMeta
 * @param {object} signals
 * @returns {Promise<object>}
 */
async function runArchitectureAgent(chunkingData, repoMeta, signals) {
  const {
    archPatterns, semanticGroups, chunkDomains, technologies,
    chunkRelationships, hasAi, hasInfra, hasTesting, hasAuthSystem,
    chunkCount, relationshipCount,
  } = signals;

  // Architectural layers from semantic group → layer mapping (deduplicated)
  const layers = unique(semanticGroups.map(g => SEMANTIC_GROUP_LAYER_MAP[g]).filter(Boolean));

  // Architecture patterns with human-readable labels
  const patterns = unique(archPatterns.map(p => ARCH_PATTERN_LABELS[p] ?? p));

  // Architectural strengths derived from structural signals
  const architecturalStrengths = [];

  if (layers.length >= 4)
    architecturalStrengths.push('Clear separation of concerns across multiple architectural layers');
  if (relationshipCount >= 8)
    architecturalStrengths.push('Well-connected service graph with explicit inter-layer dependencies');
  if (hasAuthSystem && semanticGroups.includes('api_surface'))
    architecturalStrengths.push('API surface is protected by a dedicated security layer');
  if (semanticGroups.includes('shared_utilities'))
    architecturalStrengths.push('Shared utility layer reduces duplication across the codebase');
  if (hasAi && semanticGroups.includes('data_layer'))
    architecturalStrengths.push('AI pipeline integrated with persistent data layer');
  if (hasInfra)
    architecturalStrengths.push('Infrastructure-as-code enables reproducible, automated deployments');
  if (hasTesting)
    architecturalStrengths.push('Test layer validates critical business logic');
  if (semanticGroups.includes('type_definitions'))
    architecturalStrengths.push('Typed interfaces enforce correctness across service boundaries');

  // System shape: inferred from domain combination and technology signals
  let systemShape = 'backend_service';
  const hasFE  = chunkDomains.includes('frontend');
  const hasBE  = chunkDomains.includes('backend');

  if (hasFE && hasBE)                              systemShape = 'full_stack';
  else if (hasFE && !hasBE)                        systemShape = 'frontend_spa';
  else if (hasBE && layers.length >= 4)            systemShape = 'layered_backend_service';

  if (technologies.includes('kubernetes') || technologies.includes('terraform'))
    systemShape = 'cloud_native_service';

  return {
    layers,
    patterns,
    architecturalStrengths,
    systemShape,
    layerCount:        layers.length,
    relationshipCount,
  };
}

/**
 * Skills Agent.
 * Classifies detected technologies into primary and secondary skill categories,
 * derives engineering capabilities from patterns, and infers specializations
 * from the combination of domains present.
 *
 * @param {object} chunkingData
 * @param {object} repoMeta
 * @param {object} signals
 * @returns {Promise<object>}
 */
async function runSkillsAgent(chunkingData, repoMeta, signals) {
  const {
    technologies, archPatterns, semanticGroups, chunkDomains,
    hasAi, hasFrontend, hasBackend,
  } = signals;

  // Primary skills: user-facing frameworks and core database technologies
  const primarySkills = unique([
    ...technologies.filter(t => FRONTEND_TECHS.has(t)),
    ...technologies.filter(t => BACKEND_TECHS.has(t)),
    ...technologies.filter(t => DATABASE_TECHS.has(t)),
  ]).map(techLabel);

  // Secondary skills: auth, infrastructure, and AI tooling
  const secondarySkills = unique([
    ...technologies.filter(t => AUTH_TECHS.has(t)),
    ...technologies.filter(t => INFRA_TECHS.has(t)),
    ...technologies.filter(t => AI_TECHS.has(t)),
  ]).map(techLabel);

  // Engineering capabilities derived from architecture patterns + semantic groups
  const engineeringCapabilities = [];

  if (semanticGroups.includes('api_surface'))              engineeringCapabilities.push('REST API design and implementation');
  if (archPatterns.includes('graphql_api'))                engineeringCapabilities.push('GraphQL schema design');
  if (archPatterns.includes('type_safe_api'))              engineeringCapabilities.push('Type-safe API development (tRPC)');
  if (semanticGroups.includes('data_layer'))               engineeringCapabilities.push('Database modeling and query optimization');
  if (archPatterns.includes('orm'))                        engineeringCapabilities.push('ORM-based data access patterns');
  if (semanticGroups.includes('auth_flow'))                engineeringCapabilities.push('Authentication and authorization system design');
  if (hasFrontend)                                         engineeringCapabilities.push('Frontend component architecture');
  if (archPatterns.includes('ssr_framework'))              engineeringCapabilities.push('Server-side rendering (SSR/SSG)');
  if (archPatterns.includes('global_state_management'))    engineeringCapabilities.push('Client-side state management');
  if (hasAi)                                               engineeringCapabilities.push('AI/LLM integration and orchestration');
  if (archPatterns.includes('rag_framework'))              engineeringCapabilities.push('Retrieval-Augmented Generation (RAG)');
  if (archPatterns.includes('vector_database'))            engineeringCapabilities.push('Vector database and semantic search');
  if (archPatterns.includes('containerization'))           engineeringCapabilities.push('Docker containerization');
  if (archPatterns.includes('cicd_pipeline'))              engineeringCapabilities.push('CI/CD pipeline configuration');
  if (archPatterns.includes('infrastructure_as_code'))     engineeringCapabilities.push('Infrastructure as Code (IaC)');
  if (semanticGroups.includes('test_suite'))               engineeringCapabilities.push('Automated testing practices');

  // Inferred specializations from domain combination
  const inferredSpecializations = [];
  const hasDB = chunkDomains.includes('database') || semanticGroups.includes('data_layer');

  if (hasFrontend && hasBackend && hasDB)    inferredSpecializations.push('Full-Stack Development');
  else if (hasFrontend && hasBackend)        inferredSpecializations.push('Full-Stack Development');
  else if (hasFrontend)                      inferredSpecializations.push('Frontend Development');
  else if (hasBackend && hasDB)              inferredSpecializations.push('Backend Engineering');
  else if (hasBackend)                       inferredSpecializations.push('Backend Engineering');

  if (hasAi)                                inferredSpecializations.push('AI/ML Engineering');
  if (chunkDomains.includes('infrastructure'))inferredSpecializations.push('DevOps / Infrastructure');
  if (chunkDomains.includes('auth_system'))  inferredSpecializations.push('Security Engineering');

  return {
    primarySkills,
    secondarySkills,
    engineeringCapabilities: unique(engineeringCapabilities),
    inferredSpecializations: unique(inferredSpecializations),
  };
}

/**
 * Resume Agent.
 * Generates recruiter-ready bullet points, a suggested engineering title,
 * a seniority level, and high-level impact statements from structural signals.
 *
 * @param {object} chunkingData
 * @param {object} repoMeta
 * @param {object} signals
 * @returns {Promise<object>}
 */
async function runResumeAgent(chunkingData, repoMeta, signals) {
  const {
    technologies, dominantStack, projectType, seniority,
    semanticGroups, chunkDomains, archPatterns,
    hasAi, hasInfra, hasTesting, hasFrontend, hasBackend,
    chunkCount, techCount,
  } = signals;

  const typeLabel = projectTypeLabel(projectType);
  const bullets   = [];

  // Core architecture bullet
  if (dominantStack && chunkCount > 0) {
    bullets.push(
      `Architected a ${typeLabel} using ${dominantStack}, organized across ${chunkCount} distinct service layers`,
    );
  }

  // API / data bullet
  if (semanticGroups.includes('api_surface')) {
    const dbTech  = technologies.find(t => DATABASE_TECHS.has(t));
    const dbPart  = dbTech ? ` backed by ${techLabel(dbTech)}` : '';
    bullets.push(`Designed and implemented RESTful API endpoints${dbPart} for structured data access`);
  }

  // Authentication bullet
  if (semanticGroups.includes('auth_flow')) {
    const authTech = technologies.find(t => AUTH_TECHS.has(t));
    const prefix   = authTech ? `${techLabel(authTech)}-based` : 'Secure';
    bullets.push(`Implemented ${prefix} authentication protecting application data and user sessions`);
  }

  // AI integration bullet
  if (hasAi) {
    const aiTech = technologies.find(t => AI_TECHS.has(t) && !VECTOR_DB_TECHS.has(t));
    const label  = aiTech ? techLabel(aiTech) : 'AI';
    if (archPatterns.includes('rag_framework'))
      bullets.push(`Integrated ${label} with a Retrieval-Augmented Generation (RAG) pipeline for context-aware AI responses`);
    else if (archPatterns.includes('llm_orchestration'))
      bullets.push(`Built multi-step LLM orchestration pipeline using ${label} for complex AI reasoning`);
    else
      bullets.push(`Integrated ${label} API to deliver AI-powered features within the application`);
  }

  // Infrastructure bullet
  if (hasInfra) {
    const infraLabels = technologies.filter(t => INFRA_TECHS.has(t)).map(techLabel);
    if (infraLabels.length > 0)
      bullets.push(`Configured production deployment infrastructure using ${formatList(infraLabels, 3)}`);
  }

  // Testing bullet
  if (hasTesting)
    bullets.push('Maintained automated test coverage across critical application paths');

  // Full-stack ownership bullet (if space and applicable)
  if (hasFrontend && hasBackend && bullets.length < 4)
    bullets.push('Delivered end-to-end full-stack ownership from database schema to user interface');

  // Suggested title from seniority + primary domain
  let baseTitle = 'Software Engineer';
  if (hasFrontend && hasBackend)  baseTitle = 'Full-Stack Engineer';
  else if (hasFrontend)           baseTitle = 'Frontend Engineer';
  else if (hasBackend)            baseTitle = 'Backend Engineer';
  if (hasAi)                      baseTitle = `AI ${baseTitle}`;

  const SENIORITY_PREFIX = { junior: 'Junior ', mid: '', senior: 'Senior ' };
  const suggestedTitle   = (SENIORITY_PREFIX[seniority] ?? '') + baseTitle;

  // Impact statements
  const impactStatements = [];
  if (chunkCount >= 6)
    impactStatements.push(`Managed architectural complexity across ${chunkCount} interconnected system components`);
  if (hasAi)
    impactStatements.push('Demonstrated practical AI engineering in a production-grade codebase');
  if (hasInfra && hasTesting)
    impactStatements.push('Applied engineering best practices including CI/CD automation and automated testing');
  if (techCount >= 6)
    impactStatements.push(`Operated across a ${techCount}-technology stack spanning the full application lifecycle`);

  return {
    bulletPoints:    bullets,
    suggestedTitle,
    seniorityLevel:  seniority,
    impactStatements,
  };
}

/**
 * Business Value Agent.
 * Infers probable business domain, user value proposition, monetization style,
 * and operational capabilities from architectural and topic signals.
 *
 * @param {object} chunkingData
 * @param {object} repoMeta
 * @param {object} signals
 * @returns {Promise<object>}
 */
async function runBusinessValueAgent(chunkingData, repoMeta, signals) {
  const {
    technologies, archPatterns, semanticGroups, chunkDomains,
    hasAi, hasFrontend, repoTopics,
  } = signals;

  const hasStripe = technologies.includes('stripe');
  const hasAuth   = semanticGroups.includes('auth_flow');
  const hasData   = semanticGroups.includes('data_layer');

  // Probable business domain — ordered from most to least specific
  let probableDomain = 'software product';
  if (hasStripe && hasAuth && hasData)               probableDomain = 'SaaS subscription platform';
  else if (hasStripe)                                probableDomain = 'commercial / e-commerce platform';
  else if (hasAi && hasAuth && hasData && hasFrontend) probableDomain = 'AI-powered user-facing product';
  else if (hasAi && semanticGroups.includes('api_surface')) probableDomain = 'AI-powered developer tool or API service';
  else if (hasAi)                                    probableDomain = 'AI/ML application';
  else if (hasFrontend && hasAuth && hasData)        probableDomain = 'user-facing web application';
  else if (hasAuth && hasData)                       probableDomain = 'data-driven web application';
  else if (hasFrontend)                              probableDomain = 'consumer web product';
  else if (semanticGroups.includes('api_surface'))   probableDomain = 'developer API service';

  // User value derived from detected capabilities
  const valueSignals = [];
  if (hasAuth)                                     valueSignals.push('secure user accounts');
  if (hasData)                                     valueSignals.push('persistent data management');
  if (hasAi)                                       valueSignals.push('AI-powered capabilities');
  if (semanticGroups.includes('ui_pages'))         valueSignals.push('intuitive web interface');
  if (hasStripe)                                   valueSignals.push('integrated payment processing');
  if (archPatterns.includes('cicd_pipeline'))      valueSignals.push('reliable automated delivery');
  if (archPatterns.includes('cache_store'))        valueSignals.push('high-performance caching');

  const userValue = valueSignals.length > 0
    ? `Delivers ${formatList(valueSignals, 4)} to end users`
    : 'Provides core software functionality to its target audience';

  // Monetization style
  let monetizationStyle = 'unknown';
  if (hasStripe)                                          monetizationStyle = 'direct_payment';
  else if (hasAuth && hasData && hasFrontend)             monetizationStyle = 'saas_subscription';
  else if (!hasFrontend && semanticGroups.includes('api_surface')) monetizationStyle = 'api_service';

  // Operational capabilities derived from architecture signals
  const operationalCapabilities = [];
  if (hasAuth)                                    operationalCapabilities.push('User authentication and session management');
  if (hasData)                                    operationalCapabilities.push('Persistent data storage and retrieval');
  if (hasAi)                                      operationalCapabilities.push('AI-powered inference and generation');
  if (archPatterns.includes('containerization'))  operationalCapabilities.push('Containerized deployment');
  if (archPatterns.includes('cicd_pipeline'))     operationalCapabilities.push('Automated build and deployment pipeline');
  if (archPatterns.includes('cache_store'))       operationalCapabilities.push('High-performance caching layer');
  if (hasStripe)                                  operationalCapabilities.push('Payment processing and billing');
  if (archPatterns.includes('search_database'))   operationalCapabilities.push('Full-text search capability');

  return {
    probableDomain,
    userValue,
    monetizationStyle,
    operationalCapabilities,
    topicHints: repoTopics.slice(0, 5),
  };
}

/**
 * Strengths Agent.
 * Evaluates engineering strengths, scalability indicators, maintainability
 * indicators, and deployment maturity from structural complexity signals.
 *
 * @param {object} chunkingData
 * @param {object} repoMeta
 * @param {object} signals
 * @returns {Promise<object>}
 */
async function runStrengthsAgent(chunkingData, repoMeta, signals) {
  const {
    technologies, archPatterns, semanticGroups, chunkDomains,
    hasInfra, hasTesting, hasAi, hasAuthSystem,
    techCount, chunkCount, relationshipCount,
  } = signals;

  // Engineering strengths
  const strengths = [];

  if (techCount >= 8)
    strengths.push(`Broad technology stack (${techCount} technologies) demonstrating cross-domain versatility`);
  else if (techCount >= 5)
    strengths.push('Well-rounded technology choices covering multiple architectural concerns');
  else if (techCount >= 3)
    strengths.push('Focused, pragmatic technology selection appropriate to the project scope');

  if (relationshipCount >= 8)
    strengths.push('Rich architectural dependency graph with explicit, well-defined service boundaries');
  else if (relationshipCount >= 4)
    strengths.push('Clearly defined inter-layer dependencies with traceable component relationships');

  if (semanticGroups.length >= 6)
    strengths.push('High architectural decomposition across specialized, single-responsibility layers');

  if (semanticGroups.includes('shared_utilities'))
    strengths.push('Shared utility layer promotes DRY principles and consistent cross-cutting logic');
  if (semanticGroups.includes('type_definitions'))
    strengths.push('TypeScript type definitions provide compile-time correctness across service contracts');
  if (hasTesting)
    strengths.push('Automated test suite reduces regression risk and supports confident refactoring');
  if (hasInfra)
    strengths.push('Infrastructure code enables repeatable, automated production deployments');
  if (hasAi)
    strengths.push('AI/ML integration demonstrates modern engineering capability');
  if (hasAuthSystem && semanticGroups.includes('api_surface'))
    strengths.push('API surface secured by a dedicated authentication and authorization layer');

  // Scalability indicators
  const scalabilityIndicators = [];
  if (archPatterns.includes('cache_store'))        scalabilityIndicators.push('Caching layer reduces database load and supports high read throughput');
  if (archPatterns.includes('containerization'))   scalabilityIndicators.push('Container-based deployment enables horizontal scaling');
  if (archPatterns.includes('stateless_auth'))     scalabilityIndicators.push('Stateless JWT authentication supports distributed multi-instance deployments');
  if (technologies.includes('redis'))              scalabilityIndicators.push('Redis integration supports session, cache, and queue scalability');
  if (technologies.includes('elasticsearch'))      scalabilityIndicators.push('Elasticsearch enables scalable full-text search at volume');
  if (relationshipCount >= 5)                      scalabilityIndicators.push('Modular architecture allows components to be scaled or replaced independently');

  // Maintainability indicators
  const maintainabilityIndicators = [];
  if (semanticGroups.includes('type_definitions'))  maintainabilityIndicators.push('Type-safe interfaces reduce runtime errors and improve IDE tooling');
  if (hasTesting)                                   maintainabilityIndicators.push('Test coverage enables safe refactoring as requirements evolve');
  if (semanticGroups.includes('shared_utilities'))  maintainabilityIndicators.push('Centralized shared logic simplifies future updates');
  if (semanticGroups.length >= 5)                   maintainabilityIndicators.push('Clear separation of concerns reduces cognitive overhead and onboarding cost');
  if (archPatterns.includes('orm'))                 maintainabilityIndicators.push('ORM abstraction decouples business logic from database schema details');

  // Deployment maturity
  let deploymentMaturity = 'none';
  const hasDocker  = archPatterns.includes('containerization');
  const hasCI      = archPatterns.includes('cicd_pipeline');
  const hasIaC     = archPatterns.includes('infrastructure_as_code');

  if ((hasDocker || hasIaC) && hasCI) deploymentMaturity = 'production_ready';
  else if (hasDocker || hasIaC)       deploymentMaturity = 'containerized';
  else if (hasCI)                     deploymentMaturity = 'automated_delivery';
  else if (hasInfra)                  deploymentMaturity = 'basic_infrastructure';

  return {
    strengths:               unique(strengths),
    scalabilityIndicators,
    maintainabilityIndicators,
    deploymentMaturity,
    testingPresent:          hasTesting,
  };
}

/**
 * AI Capabilities Agent.
 * Detects AI/ML maturity, specific model integrations, vector/embedding usage,
 * and architectural AI patterns from technology and architecture signals.
 *
 * @param {object} chunkingData
 * @param {object} repoMeta
 * @param {object} signals
 * @returns {Promise<object>}
 */
async function runAICapabilitiesAgent(chunkingData, repoMeta, signals) {
  const { technologies, archPatterns, semanticGroups, chunkDomains, hasAi } = signals;

  // Model integrations: AI SDKs that are not vector databases
  const modelIntegrations = technologies
    .filter(t => AI_TECHS.has(t) && !VECTOR_DB_TECHS.has(t) && t !== 'embeddings')
    .map(techLabel);

  // Vector stores
  const vectorStoreKeys = technologies.filter(t => VECTOR_DB_TECHS.has(t));
  const hasEmbeddings   = technologies.includes('embeddings') || vectorStoreKeys.length > 0;

  // AI maturity level — ordered from most to least sophisticated
  let aiMaturityLevel = 'none';
  if (hasAi) {
    if (archPatterns.includes('rag_framework') || (hasEmbeddings && modelIntegrations.length > 0))
      aiMaturityLevel = 'production_ai';
    else if (technologies.some(t => AI_ORCHESTRATORS.has(t)))
      aiMaturityLevel = 'orchestrated_ai';
    else if (modelIntegrations.length > 0)
      aiMaturityLevel = 'basic_integration';
  }

  // Specific AI features
  const aiFeatures = [];
  if (archPatterns.includes('llm_integration'))   aiFeatures.push('LLM text generation and completion');
  if (archPatterns.includes('llm_orchestration')) aiFeatures.push('Multi-step LLM orchestration');
  if (archPatterns.includes('rag_framework'))     aiFeatures.push('Retrieval-Augmented Generation (RAG)');
  if (archPatterns.includes('vector_database'))   aiFeatures.push('Vector similarity search');
  if (archPatterns.includes('vector_embeddings')) aiFeatures.push('Text embedding generation');

  // AI architecture patterns
  const aiArchitecturePatterns = [];
  if (archPatterns.includes('rag_framework'))     aiArchitecturePatterns.push('RAG pipeline');
  if (archPatterns.includes('llm_orchestration')) aiArchitecturePatterns.push('LLM agent orchestration');
  if (archPatterns.includes('vector_embeddings')) aiArchitecturePatterns.push('Semantic embedding search');
  if (archPatterns.includes('vector_database'))   aiArchitecturePatterns.push('Vector store retrieval');
  if (modelIntegrations.length > 1)              aiArchitecturePatterns.push('Multi-model LLM strategy');

  return {
    hasAiFeatures:          hasAi,
    aiMaturityLevel,
    aiFeatures:             unique(aiFeatures),
    modelIntegrations,
    vectorStoreUsage:       vectorStoreKeys.length > 0
      ? vectorStoreKeys.map(techLabel).join(', ')
      : null,
    embeddingUsage:         hasEmbeddings,
    aiArchitecturePatterns: unique(aiArchitecturePatterns),
  };
}

/**
 * Portfolio Narrative Agent.
 * Produces a polished, recruiter-facing hook sentence, multi-sentence story,
 * project impact statement, and technical differentiation list from all
 * aggregated structural signals.
 *
 * @param {object} chunkingData
 * @param {object} repoMeta
 * @param {object} signals
 * @returns {Promise<object>}
 */
async function runPortfolioNarrativeAgent(chunkingData, repoMeta, signals) {
  const {
    technologies, archPatterns, semanticGroups,
    dominantStack, projectType, seniority,
    hasAi, hasInfra, hasTesting, hasFrontend, hasBackend,
    chunkCount, relationshipCount, techCount,
  } = signals;

  const typeLabel    = projectTypeLabel(projectType);
  const seniorAdj    = seniority === 'senior' ? 'senior-level' : seniority === 'mid' ? 'professional-grade' : 'solid';

  // Hook sentence: single, specific, attention-grabbing opener
  const hookParts = [
    `A ${dominantStack ? `${dominantStack}-powered` : 'well-engineered'} ${typeLabel}`,
    semanticGroups.length > 3 ? `spanning ${semanticGroups.length} architectural layers` : null,
    hasAi && hasInfra ? 'with integrated AI capabilities and production infrastructure'
      : hasAi         ? 'with integrated AI capabilities'
      : hasInfra      ? 'with production-ready infrastructure'
      : null,
  ];
  const hookSentence = hookParts.filter(Boolean).join(' ') + '.';

  // Story: 2–3 substantive sentences
  const stackStr = dominantStack ?? formatList(technologies.slice(0, 3).map(techLabel), 3);
  const s1 = `This project demonstrates ${seniorAdj} engineering through ${article(typeLabel)} ${typeLabel} built with ${stackStr}.`;

  const storyFeatures = [];
  if (semanticGroups.includes('api_surface') && semanticGroups.includes('data_layer'))
    storyFeatures.push('a complete API-to-database data flow');
  if (semanticGroups.includes('auth_flow'))   storyFeatures.push('secure user authentication');
  if (hasAi)                                  storyFeatures.push('AI/ML integration');
  if (hasTesting)                             storyFeatures.push('automated testing');
  if (hasInfra)                               storyFeatures.push('containerized deployment');

  const s2 = storyFeatures.length > 0
    ? `The codebase delivers ${formatList(storyFeatures, 4)}, reflecting hands-on experience with production engineering concerns.`
    : null;

  const s3 = relationshipCount >= 5
    ? `The architecture is organized into ${chunkCount} interconnected components with ${relationshipCount} defined inter-layer relationships, reflecting deliberate structural thinking.`
    : chunkCount >= 4
    ? `The architecture is decomposed into ${chunkCount} distinct layers with a clear separation of concerns.`
    : null;

  const story = buildNarrative([s1, s2, s3]) || `A ${typeLabel} built with ${dominantStack ?? 'modern technologies'}.`;

  // Project impact: the single most compelling outcome statement
  let projectImpact = `Demonstrates full-project ownership of a ${typeLabel}`;
  if (hasAi && hasFrontend && hasBackend)
    projectImpact = 'Demonstrates end-to-end AI product engineering, from data layer to AI-powered user interface';
  else if (hasAi)
    projectImpact = 'Demonstrates practical ability to ship AI-integrated, production-grade software';
  else if (hasFrontend && hasBackend)
    projectImpact = 'Shows end-to-end full-stack ownership from database schema to user interface';
  else if (hasInfra && hasTesting)
    projectImpact = 'Reflects production engineering discipline with automated testing and infrastructure-as-code';

  // Technical differentiation: specific, concrete differentiators
  const differentiation = [];
  if (hasAi && archPatterns.includes('rag_framework'))
    differentiation.push('RAG pipeline shows advanced AI engineering beyond simple LLM API integration');
  if (hasAi)
    differentiation.push(`AI/ML integration using ${formatList(technologies.filter(t => AI_TECHS.has(t) && !VECTOR_DB_TECHS.has(t)).map(techLabel), 2)}`);
  if (archPatterns.includes('type_safe_api'))
    differentiation.push('End-to-end type safety via tRPC eliminates API contract drift between frontend and backend');
  if (archPatterns.includes('ssr_framework'))
    differentiation.push('Server-side rendering optimizes initial load performance and search engine visibility');
  if (hasInfra)
    differentiation.push('Production infrastructure is defined as code for reproducible, automated deployments');
  if (techCount >= 7)
    differentiation.push(`Polyglot stack spanning ${techCount} technologies across the full application lifecycle`);

  // Tone inference
  let toneSignal = 'technical';
  if (hasAi && hasFrontend)                    toneSignal = 'product';
  else if (technologies.includes('stripe'))    toneSignal = 'startup';
  else if (technologies.includes('kubernetes') || technologies.includes('terraform'))
                                               toneSignal = 'enterprise';

  return {
    hookSentence,
    story,
    projectImpact,
    technicalDifferentiation: unique(differentiation).slice(0, 3),
    toneSignal,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// runIntelligenceAgents — Phase 5 entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phase 5 — Intelligence Agents.
 *
 * Computes shared structural signals from Phase 4 (chunkingData) and Phase 2
 * (repoMeta) outputs, then orchestrates eight specialized intelligence agents
 * that each produce a distinct analytical lens over the repository.
 *
 * Each agent runs sequentially inside safeRunAgent(), which catches any
 * exception and records the failure in meta.failedAgents without aborting the
 * phase. A failing agent returns null; all others succeed independently.
 *
 * Pipeline contract: returns { data, meta, dbUpdate } as expected by
 * runPhaseIsolated() in deepAnalysisPipeline.js.
 *
 *   data     — aggregated intelligence object; passed to Phase 6 (Inference Engine)
 *   meta     — observability data stored in phase_metrics_json
 *   dbUpdate — { intelligence_json: … } — persisted immediately after completion
 *
 * @param {object} chunkingData       — Phase 4 scResult.data
 *   @param {object[]} chunkingData.chunks            — semantic chunk records
 *   @param {object[]} chunkingData.chunkRelationships
 *   @param {object}   chunkingData.chunkSummaries
 *   @param {object}   chunkingData.retrievalIndex
 *   @param {object}   chunkingData.summary
 *   @param {object}   chunkingData.fileContents      — raw file content passthrough
 *
 * @param {object} [repoMeta={}]  — Phase 2 ciResult.data (code intelligence output),
 *                                   or null / {} when Phase 2 failed or was not run
 *
 * @returns {Promise<{ data: object, meta: object, dbUpdate: object }>}
 */
async function runIntelligenceAgents(chunkingData, repoMeta = {}) {
  // ── Defensive normalisation ───────────────────────────────────────────────
  const safeChunkingData = (chunkingData && typeof chunkingData === 'object') ? chunkingData : {};
  const safeRepoMeta     = (repoMeta     && typeof repoMeta     === 'object') ? repoMeta     : {};

  const generatedAt  = new Date().toISOString();
  const failedAgents = [];   // populated by safeRunAgent on any agent failure

  // ── Shared signal extraction ──────────────────────────────────────────────
  // Computed once so every agent operates on identical, pre-processed data.
  // A failure here is intentionally allowed to propagate — if signals cannot
  // be built, the entire phase fails (caught by runPhaseIsolated).
  const signals = buildSignals(safeChunkingData, safeRepoMeta);

  // ── Internal fault-isolated runner ────────────────────────────────────────
  // Closure captures `failedAgents` without a module-level variable, keeping
  // the public signature exactly (name, fn) as required.

  /**
   * Runs an agent function in fault isolation.
   * A thrown exception is recorded in failedAgents; it never reaches the caller.
   *
   * @param {string}   name  — agent name used for attribution in failedAgents
   * @param {Function} fn    — async zero-arg factory returning the agent result
   * @returns {Promise<any|null>}  Agent result, or null on failure.
   */
  async function safeRunAgent(name, fn) {
    try {
      return await fn();
    } catch (err) {
      failedAgents.push({
        name,
        error: (err && typeof err.message === 'string') ? err.message : String(err),
      });
      return null;
    }
  }

  // ── Sequential agent execution ────────────────────────────────────────────
  // Agents run one at a time so that completed results can (in future
  // AI-powered iterations) be injected as context into downstream agents.
  // Sequential ordering also provides deterministic error attribution.

  const executiveSummary = await safeRunAgent(
    'executiveSummary',
    () => runExecutiveSummaryAgent(safeChunkingData, safeRepoMeta, signals),
  );

  const architecture = await safeRunAgent(
    'architecture',
    () => runArchitectureAgent(safeChunkingData, safeRepoMeta, signals),
  );

  const skills = await safeRunAgent(
    'skills',
    () => runSkillsAgent(safeChunkingData, safeRepoMeta, signals),
  );

  const resume = await safeRunAgent(
    'resume',
    () => runResumeAgent(safeChunkingData, safeRepoMeta, signals),
  );

  const businessValue = await safeRunAgent(
    'businessValue',
    () => runBusinessValueAgent(safeChunkingData, safeRepoMeta, signals),
  );

  const strengths = await safeRunAgent(
    'strengths',
    () => runStrengthsAgent(safeChunkingData, safeRepoMeta, signals),
  );

  const aiCapabilities = await safeRunAgent(
    'aiCapabilities',
    () => runAICapabilitiesAgent(safeChunkingData, safeRepoMeta, signals),
  );

  const portfolioNarrative = await safeRunAgent(
    'portfolioNarrative',
    () => runPortfolioNarrativeAgent(safeChunkingData, safeRepoMeta, signals),
  );

  // ── Aggregate intelligence object ─────────────────────────────────────────
  const intelligence = {
    executiveSummary,
    architecture,
    skills,
    resume,
    businessValue,
    strengths,
    aiCapabilities,
    portfolioNarrative,

    // Pipeline provenance
    analysisVersion: ANALYSIS_VERSION,
    generatedAt,
  };

  // ── Phase result envelope ─────────────────────────────────────────────────
  const AGENT_COUNT     = 8;
  const agentsFailed    = failedAgents.length;
  const agentsSucceeded = AGENT_COUNT - agentsFailed;

  const meta = {
    agentsRun:        AGENT_COUNT,
    agentsSucceeded,
    agentsFailed,
    failedAgents,     // [] when all agents succeeded
    generatedAt,
  };

  return {
    data:     intelligence,
    meta,
    // Persisted immediately by persistCheckpoint() in deepAnalysisPipeline.js
    dbUpdate: { intelligence_json: intelligence },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  runIntelligenceAgents,  // Phase 5 entry point
  // Utility helpers exported for unit testing
  unique,
  formatList,
  inferProjectType,
  inferSeniority,
  buildNarrative,
};
