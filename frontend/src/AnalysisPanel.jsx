import { useState, useEffect, useRef } from 'react'
import { authFetch, BASE_URL } from './api'

const POLL_INTERVAL_MS = 3000

// ── Helpers ───────────────────────────────────────────────────────────────────

const LANG_COLORS = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5',
  Ruby: '#701516', Go: '#00ADD8', Java: '#b07219', Rust: '#dea584',
  'C++': '#f34b7d', Shell: '#89e051', HTML: '#e34c26', CSS: '#563d7c',
}

function langColor(lang) { return LANG_COLORS[lang] || '#8b949e' }

function statusBadge(status) {
  const map = {
    queued:    { bg: '#fef9c3', color: '#854d0e', border: '#fde047', label: 'Queued' },
    running:   { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', label: 'Analyzing…' },
    completed: { bg: '#dcfce7', color: '#166534', border: '#86efac', label: '✓ Analyzed' },
    partial:   { bg: '#fff7ed', color: '#9a3412', border: '#fed7aa', label: '⚠ Partial' },
    failed:    { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', label: '✗ Failed' },
  }
  const s = map[status] || map.failed
  return (
    <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  )
}

const TECH_CATEGORY_COLORS = {
  Frontend: { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  Backend:  { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  Database: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  DevOps:   { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  Mobile:   { bg: '#fce7f3', color: '#9d174d', border: '#f9a8d4' },
  AI:       { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' },
  Testing:  { bg: '#ecfdf5', color: '#065f46', border: '#6ee7b7' },
  Other:    { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
}

function techChipStyle(category) { return TECH_CATEGORY_COLORS[category] || TECH_CATEGORY_COLORS.Other }

function confidenceColor(label) {
  if (label === 'High')   return '#16a34a'
  if (label === 'Medium') return '#92400e'
  return '#991b1b'
}

function formatAnalyzedDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${date} • ${time}`
}

// ── SectionCard ───────────────────────────────────────────────────────────────

function SectionCard({ icon, title, children }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', backgroundColor: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <span style={{ color: '#6366f1', fontSize: '16px' }}>{icon}</span>
        <p style={{ margin: 0, fontWeight: 'bold', fontSize: '15px', color: '#111827' }}>{title}</p>
      </div>
      {children}
    </div>
  )
}

// ── V2 pipeline constants ─────────────────────────────────────────────────────

const PHASE_LABELS = {
  enrichment:          'GitHub Enrichment',
  codeIntelligence:    'Code Intelligence',
  fileClassification:  'File Classification',
  semanticChunking:    'Semantic Chunking',
  intelligenceAgents:  'Intelligence Agents',
  inferenceEngine:     'Inference Engine',
}

const PHASE_ORDER = [
  'enrichment', 'codeIntelligence', 'fileClassification',
  'semanticChunking', 'intelligenceAgents', 'inferenceEngine',
]

const PHASE_STATUS_STYLE = {
  completed: { bg: '#dcfce7', color: '#166534', border: '#86efac', label: '✓ Completed' },
  failed:    { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', label: '✗ Failed' },
  running:   { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', label: '⟳ Running' },
  queued:    { bg: '#fef9c3', color: '#854d0e', border: '#fde047', label: '◷ Queued' },
  skipped:   { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db', label: '— Skipped' },
}

const COMPLEXITY_STYLE = {
  low:        { bg: '#dcfce7', color: '#166534' },
  medium:     { bg: '#fef9c3', color: '#854d0e' },
  high:       { bg: '#fed7aa', color: '#9a3412' },
  enterprise: { bg: '#ede9fe', color: '#5b21b6' },
}

const CONTENT_TYPE_COLORS = {
  source_code:    { bg: '#dbeafe', color: '#1e40af' },
  config:         { bg: '#f3f4f6', color: '#374151' },
  documentation:  { bg: '#fef9c3', color: '#854d0e' },
  test:           { bg: '#dcfce7', color: '#166534' },
  infrastructure: { bg: '#fce7f3', color: '#9d174d' },
  manifest:       { bg: '#f3e8ff', color: '#6b21a8' },
  style:          { bg: '#ecfdf5', color: '#065f46' },
  data:           { bg: '#fff7ed', color: '#9a3412' },
  unknown:        { bg: '#f3f4f6', color: '#6b7280' },
}

// ── Code Intelligence constants ───────────────────────────────────────────────
// Used to colour-code technology and framework badges by their domain category.

const CI_TECH_DOMAIN = {
  // Authentication technologies
  jwt: 'auth', passport: 'auth', 'next-auth': 'auth', clerk: 'auth',
  'firebase-auth': 'auth', 'better-auth': 'auth', lucia: 'auth', 'auth-middleware': 'auth',
  // API layer
  express: 'api', fastify: 'api', nestjs: 'api', graphql: 'api',
  trpc: 'api', koa: 'api', hono: 'api', 'rest-routes': 'api',
  // Database / persistence
  prisma: 'db', drizzle: 'db', mongoose: 'db', sequelize: 'db',
  typeorm: 'db', knex: 'db', postgresql: 'db', mysql: 'db',
  mongodb: 'db', redis: 'db', elasticsearch: 'db', dynamodb: 'db',
  // AI tooling
  openai: 'ai', anthropic: 'ai', langchain: 'ai', llamaindex: 'ai',
  'vercel-ai-sdk': 'ai', pinecone: 'ai', weaviate: 'ai', chromadb: 'ai',
  mistral: 'ai', cohere: 'ai', groq: 'ai', embeddings: 'ai',
  // Frontend
  react: 'frontend', nextjs: 'frontend', vue: 'frontend', angular: 'frontend',
  svelte: 'frontend', tailwind: 'frontend', redux: 'frontend', zustand: 'frontend', jotai: 'frontend',
  // Infrastructure
  docker: 'infra', kubernetes: 'infra', 'github-actions': 'infra', terraform: 'infra', stripe: 'infra',
}

// Badge colours per domain — deliberately distinct so scanning is fast
const CI_DOMAIN_COLORS = {
  auth:     { bg: '#fce7f3', color: '#9d174d', border: '#f9a8d4' },
  api:      { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  db:       { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  ai:       { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' },
  frontend: { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  infra:    { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  default:  { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
}

// Human-readable display labels for technology keys
const CI_TECH_LABELS = {
  jwt: 'JWT', passport: 'Passport', 'next-auth': 'NextAuth', clerk: 'Clerk',
  'firebase-auth': 'Firebase Auth', 'better-auth': 'Better Auth', lucia: 'Lucia',
  'auth-middleware': 'Auth Middleware',
  express: 'Express', fastify: 'Fastify', nestjs: 'NestJS', graphql: 'GraphQL',
  trpc: 'tRPC', koa: 'Koa', hono: 'Hono', 'rest-routes': 'REST Routes',
  prisma: 'Prisma', drizzle: 'Drizzle', mongoose: 'Mongoose', sequelize: 'Sequelize',
  typeorm: 'TypeORM', knex: 'Knex', postgresql: 'PostgreSQL', mysql: 'MySQL',
  mongodb: 'MongoDB', redis: 'Redis', elasticsearch: 'Elasticsearch', dynamodb: 'DynamoDB',
  openai: 'OpenAI', anthropic: 'Anthropic', langchain: 'LangChain', llamaindex: 'LlamaIndex',
  'vercel-ai-sdk': 'Vercel AI SDK', pinecone: 'Pinecone', weaviate: 'Weaviate',
  chromadb: 'ChromaDB', mistral: 'Mistral', cohere: 'Cohere', groq: 'Groq', embeddings: 'Embeddings',
  react: 'React', nextjs: 'Next.js', vue: 'Vue', angular: 'Angular', svelte: 'Svelte',
  tailwind: 'Tailwind CSS', redux: 'Redux', zustand: 'Zustand', jotai: 'Jotai',
  docker: 'Docker', kubernetes: 'Kubernetes', 'github-actions': 'GitHub Actions',
  terraform: 'Terraform', stripe: 'Stripe',
}

// Icon + readable label per detected domain
const CI_DOMAIN_META = {
  authentication: { icon: '🔐', label: 'Authentication' },
  api_layer:      { icon: '🔗', label: 'API Layer' },
  database:       { icon: '🗃', label: 'Database' },
  ai_tooling:     { icon: '🤖', label: 'AI Tooling' },
  frontend:       { icon: '🖥', label: 'Frontend' },
  infrastructure: { icon: '🏗', label: 'Infrastructure' },
}

// Override map for architecture pattern labels (keeps common acronyms uppercase)
const CI_ARCH_LABELS = {
  orm: 'ORM', rest_api: 'REST API', graphql_api: 'GraphQL API',
  enterprise_rest_api: 'Enterprise REST', type_safe_api: 'Type-Safe API',
  llm_integration: 'LLM Integration', llm_orchestration: 'LLM Orchestration',
  rag_framework: 'RAG Framework', ssr_framework: 'SSR Framework',
  cicd_pipeline: 'CI/CD Pipeline', rest_routing: 'REST Routing',
  stateless_auth: 'Stateless Auth', session_based_auth: 'Session Auth',
  hosted_auth_provider: 'Hosted Auth', strategy_based_auth: 'Strategy Auth',
  provider_based_auth: 'Provider Auth', custom_auth_middleware: 'Custom Middleware',
  document_database_odm: 'Document ODM', document_database: 'Document DB',
  relational_database: 'Relational DB', cache_store: 'Cache Store',
  nosql_database: 'NoSQL DB', search_database: 'Search DB',
  query_builder: 'Query Builder', vector_database: 'Vector DB',
  vector_embeddings: 'Vector Embeddings', component_ui: 'Component UI',
  global_state_management: 'State Management', utility_css_framework: 'Utility CSS',
  containerization: 'Containerization', container_orchestration: 'Orchestration',
  infrastructure_as_code: 'IaC', payment_processing: 'Payments',
}

function ciTechBadgeStyle(techKey) {
  const domain = CI_TECH_DOMAIN[techKey] || 'default'
  return CI_DOMAIN_COLORS[domain] || CI_DOMAIN_COLORS.default
}

function ciConfidenceColor(score) {
  if (score >= 0.80) return '#16a34a'
  if (score >= 0.60) return '#92400e'
  return '#991b1b'
}

function fmtArchPattern(p) {
  return CI_ARCH_LABELS[p] || p.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function seniorityBadgeStyle(s) {
  if (s === 'senior') return { backgroundColor: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd' }
  if (s === 'mid')    return { backgroundColor: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' }
  return                     { backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac' }
}

function aiMaturityLabel(level) {
  const labels = { none: 'No AI', basic_integration: 'Basic AI Integration', orchestrated_ai: 'Orchestrated AI', production_ai: 'Production AI' }
  return labels[level] || (level ?? '').replace(/_/g, ' ')
}

function deploymentMaturityLabel(level) {
  const labels = { none: 'No Deployment', basic_infrastructure: 'Basic Infrastructure', containerized: 'Containerized', automated_delivery: 'Automated Delivery', production_ready: 'Production Ready' }
  return labels[level] || (level ?? '').replace(/_/g, ' ')
}

// ── Portfolio Intelligence Overview helpers ───────────────────────────────────

const PATTERN_LABELS = {
  fullstack_architecture_confirmed: 'Fullstack Architecture',
  ai_orchestrated_system:           'AI Orchestrated System',
  ai_integration_confirmed:         'AI Integration',
  retrieval_augmented_architecture: 'RAG Architecture',
  production_ready_backend:         'Production Backend',
  scalable_service_architecture:    'Scalable Services',
  enterprise_backend_patterns:      'Enterprise Patterns',
  strong_domain_separation:         'Domain Separation',
  modular_frontend_architecture:    'Modular Frontend',
  authentication_layer_present:     'Auth Layer',
  infrastructure_as_code_present:   'IaC Present',
}

function patternLabel(p) {
  return PATTERN_LABELS[p] || p.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function patternChipStyle(p) {
  if (p.includes('ai_') || p === 'retrieval_augmented_architecture') return { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' }
  if (p.includes('production') || p.includes('infrastructure') || p.includes('scalable')) return { bg: '#dcfce7', color: '#166534', border: '#86efac' }
  if (p.includes('fullstack') || p.includes('frontend') || p.includes('modular')) return { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' }
  if (p.includes('enterprise') || p.includes('domain')) return { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' }
  if (p.includes('auth')) return { bg: '#fce7f3', color: '#9d174d', border: '#f9a8d4' }
  return { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' }
}

function portfolioScoreColor(score) {
  if (score >= 0.72) return '#16a34a'
  if (score >= 0.48) return '#2563eb'
  if (score >= 0.24) return '#d97706'
  return '#9ca3af'
}

function maturityBadgeStyle(level) {
  if (level === 'mature')     return { bg: '#dcfce7', color: '#166534', border: '#86efac' }
  if (level === 'developing') return { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' }
  return                             { bg: '#fef9c3', color: '#854d0e', border: '#fde047' }
}

function deploymentBadgeInfo(level) {
  if (level === 'production_ready')   return { bg: '#dcfce7', color: '#166534', border: '#86efac', label: 'Production Ready' }
  if (level === 'automated_delivery') return { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', label: 'Automated Delivery' }
  if (level === 'containerized')      return { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd', label: 'Containerized' }
  if (level === 'basic')              return { bg: '#fef9c3', color: '#854d0e', border: '#fde047', label: 'Basic Infrastructure' }
  return                                     { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db', label: 'Not Deployed' }
}

function computePortfolioScores(inference, codeIntelligence, intelligence) {
  const c01      = v => Math.min(1, Math.max(0, v ?? 0))
  const patterns = inference?.patternsInferred ?? []
  const has      = p => patterns.includes(p)
  const archPatterns = codeIntelligence?.architecturePatterns?.length ?? 0
  const techCount    = (codeIntelligence?.technologies?.length ?? 0) + (codeIntelligence?.frameworks?.length ?? 0)
  const domains      = codeIntelligence?.detectedDomains?.length ?? 0
  const conf         = inference?.confidence ?? {}

  const architectureQuality = c01(
    archPatterns * 0.06 +
    (has('fullstack_architecture_confirmed') ? 0.22 : 0) +
    (has('strong_domain_separation')         ? 0.18 : 0) +
    (has('scalable_service_architecture')    ? 0.14 : 0) +
    (has('enterprise_backend_patterns')      ? 0.14 : 0) +
    (has('modular_frontend_architecture')    ? 0.10 : 0) +
    (conf.crossPhaseConsistency ?? 0) * 0.22
  )

  const aiSophistication = c01(
    (has('ai_orchestrated_system')           ? 0.60 : 0) +
    (has('retrieval_augmented_architecture') ? 0.45 : 0) +
    (has('ai_integration_confirmed')         ? 0.30 : 0) +
    (intelligence?.aiCapabilities?.present   ? 0.20 : 0) +
    (intelligence?.aiCapabilities?.stack?.length ?? 0) * 0.05
  )

  const dr     = inference?.overallAssessment?.deploymentReadiness ?? 'none'
  const drBase = dr === 'production_ready' ? 0.90 : dr === 'automated_delivery' ? 0.70 : dr === 'containerized' ? 0.50 : dr === 'basic' ? 0.25 : 0.05
  const productionReadiness = c01(
    drBase * 0.55 +
    (has('production_ready_backend')       ? 0.18 : 0) +
    (has('infrastructure_as_code_present') ? 0.15 : 0) +
    (has('authentication_layer_present')   ? 0.10 : 0) +
    (conf.signalCoverage ?? 0) * 0.12
  )

  const scalability = c01(
    (has('scalable_service_architecture') ? 0.35 : 0) +
    (has('enterprise_backend_patterns')   ? 0.28 : 0) +
    (has('production_ready_backend')      ? 0.16 : 0) +
    domains * 0.04 +
    Math.min(techCount * 0.02, 0.16)
  )

  const technologyBreadth = c01(
    Math.min(techCount * 0.045, 0.40) +
    domains * 0.07 +
    (conf.signalCoverage ?? 0) * 0.35 +
    (has('fullstack_architecture_confirmed') ? 0.12 : 0)
  )

  return { architectureQuality, aiSophistication, productionReadiness, scalability, technologyBreadth }
}

// ── System Architecture Canvas helpers ───────────────────────────────────────

const INTEGRATION_TECH_MAP = {
  openai:          { label: 'OpenAI API',    icon: '🧠', color: '#7c3aed', bg: '#f3e8ff', border: '#d8b4fe', category: 'AI Provider' },
  anthropic:       { label: 'Anthropic API', icon: '🧠', color: '#7c3aed', bg: '#f3e8ff', border: '#d8b4fe', category: 'AI Provider' },
  langchain:       { label: 'LangChain',     icon: '⛓',  color: '#6d28d9', bg: '#f5f3ff', border: '#c4b5fd', category: 'AI Provider' },
  llamaindex:      { label: 'LlamaIndex',    icon: '🦙', color: '#6d28d9', bg: '#f5f3ff', border: '#c4b5fd', category: 'AI Provider' },
  groq:            { label: 'Groq API',      icon: '⚡', color: '#7c3aed', bg: '#f3e8ff', border: '#d8b4fe', category: 'AI Provider' },
  mistral:         { label: 'Mistral',       icon: '🌊', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', category: 'AI Provider' },
  cohere:          { label: 'Cohere',        icon: '🤝', color: '#059669', bg: '#f0fdf4', border: '#6ee7b7', category: 'AI Provider' },
  embeddings:      { label: 'Embeddings',    icon: '🧮', color: '#7c3aed', bg: '#f3e8ff', border: '#d8b4fe', category: 'AI Provider' },
  pinecone:        { label: 'Pinecone',      icon: '🌲', color: '#059669', bg: '#f0fdf4', border: '#6ee7b7', category: 'Vector DB' },
  weaviate:        { label: 'Weaviate',      icon: '🔮', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', category: 'Vector DB' },
  chromadb:        { label: 'ChromaDB',      icon: '🎨', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', category: 'Vector DB' },
  stripe:          { label: 'Stripe',        icon: '💳', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', category: 'Payments' },
  clerk:           { label: 'Clerk',         icon: '🔑', color: '#ec4899', bg: '#fdf2f8', border: '#f9a8d4', category: 'Auth' },
  'firebase-auth': { label: 'Firebase Auth', icon: '🔥', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', category: 'Auth' },
  redis:           { label: 'Redis',         icon: '⚡', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', category: 'Cache' },
}

const INFRASTRUCTURE_TECH_MAP = {
  docker:           { label: 'Docker',         icon: '🐳', color: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd' },
  kubernetes:       { label: 'Kubernetes',     icon: '☸',  color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  'github-actions': { label: 'GitHub Actions', icon: '⚙',  color: '#94a3b8', bg: '#f1f5f9', border: '#cbd5e1' },
  terraform:        { label: 'Terraform',      icon: '🏗',  color: '#a78bfa', bg: '#faf5ff', border: '#ddd6fe' },
}

const INFRA_PATTERN_SIGNALS = {
  cicd_pipeline:           { label: 'CI/CD Pipeline',       icon: '🔄', color: '#94a3b8', bg: '#f1f5f9', border: '#cbd5e1' },
  containerization:        { label: 'Container Deploy',      icon: '📦', color: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd' },
  container_orchestration: { label: 'Orchestration',         icon: '☸',  color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  infrastructure_as_code:  { label: 'IaC',                   icon: '📝', color: '#a78bfa', bg: '#faf5ff', border: '#ddd6fe' },
  payment_processing:      { label: 'Payment Processing',    icon: '💳', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
}

const SYSTEM_LAYER_LABELS = {
  presentation: 'Client Application',
  api:          'API Gateway',
  service:      'AI Orchestration Layer',
  data:         'Persistence Layer',
}

function inferExternalIntegrations(technologies, frameworks) {
  const allTechs = new Set([...(technologies ?? []), ...(frameworks ?? [])])
  return Object.entries(INTEGRATION_TECH_MAP)
    .filter(([key]) => allTechs.has(key))
    .map(([key, info]) => ({ key, ...info }))
}

function inferInfrastructureSignals(technologies, frameworks, archPatterns) {
  const allTechs = new Set([...(technologies ?? []), ...(frameworks ?? [])])
  const signals  = []
  const seen     = new Set()

  for (const [key, info] of Object.entries(INFRASTRUCTURE_TECH_MAP)) {
    if (allTechs.has(key)) { signals.push({ key, ...info, source: 'detected' }); seen.add(key) }
  }
  for (const [pattern, info] of Object.entries(INFRA_PATTERN_SIGNALS)) {
    if ((archPatterns ?? []).includes(pattern) && !seen.has(pattern)) {
      signals.push({ key: pattern, ...info, source: 'inferred' })
      seen.add(pattern)
    }
  }
  return signals
}

const ARCH_TIER_CONFIG = [
  { id: 'presentation', label: 'Presentation', icon: '🖥',  domains: ['frontend'],                    ciDomains: ['frontend'],   color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'api',          label: 'API & Auth',   icon: '🔗',  domains: ['api_layer', 'authentication'], ciDomains: ['api', 'auth'], color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  { id: 'service',      label: 'AI Services',  icon: '🤖',  domains: ['ai_tooling'],                  ciDomains: ['ai'],         color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff' },
  { id: 'data',         label: 'Data',         icon: '🗃',  domains: ['database'],                    ciDomains: ['db'],         color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
]

const ARCH_PATTERN_TIER = {
  presentation: ['component_ui', 'ssr_framework', 'global_state_management', 'utility_css_framework'],
  api:          ['rest_api', 'graphql_api', 'enterprise_rest_api', 'type_safe_api', 'rest_routing',
                 'stateless_auth', 'session_based_auth', 'hosted_auth_provider', 'strategy_based_auth',
                 'provider_based_auth', 'custom_auth_middleware'],
  service:      ['llm_integration', 'llm_orchestration', 'rag_framework', 'vector_embeddings', 'vector_database'],
  data:         ['orm', 'document_database_odm', 'document_database', 'relational_database',
                 'cache_store', 'nosql_database', 'search_database', 'query_builder'],
}

const ARCH_TIER_CONNECTIONS = [
  { from: 'presentation', to: 'api',     label: 'HTTP calls' },
  { from: 'api',          to: 'service', label: 'delegates to' },
  { from: 'api',          to: 'data',    label: 'queries' },
  { from: 'service',      to: 'data',    label: 'retrieves from' },
]

function archConnectionLabel(fromId, toId, inferredPatterns) {
  if (fromId === 'presentation' && toId === 'api')
    return 'HTTP / REST calls'
  if (fromId === 'api' && toId === 'service')
    return inferredPatterns.includes('ai_orchestrated_system') ? 'orchestrates AI' : 'delegates to'
  if (fromId === 'api' && toId === 'data')
    return 'queries / stores'
  if (fromId === 'service' && toId === 'data')
    return inferredPatterns.includes('retrieval_augmented_architecture') ? 'vector retrieval' : 'retrieves from'
  return 'connects to'
}

function PhaseBadge({ status }) {
  const s = PHASE_STATUS_STYLE[status] || PHASE_STATUS_STYLE.skipped
  return (
    <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  )
}

function IntelligencePlaceholder() {
  return (
    <div style={{ textAlign: 'center', padding: '18px 0', color: '#9ca3af' }}>
      <div style={{ fontSize: '20px', marginBottom: '6px' }}>⏳</div>
      <p style={{ margin: 0, fontSize: '12px' }}>Awaiting pipeline completion</p>
    </div>
  )
}

// ── ExecutiveIntelligenceDashboard helpers ────────────────────────────────────

const EID_TECH_BUCKETS = {
  Frontend:       new Set(['react','nextjs','vue','angular','svelte','tailwind','redux','zustand','jotai','recoil']),
  Backend:        new Set(['express','fastify','nestjs','graphql','trpc','koa','hono']),
  Auth:           new Set(['jwt','passport','next-auth','clerk','firebase-auth','better-auth','lucia']),
  'AI/ML':        new Set(['openai','anthropic','langchain','llamaindex','vercel-ai-sdk','pinecone','weaviate','chromadb','embeddings','mistral','cohere','groq']),
  Database:       new Set(['prisma','drizzle','mongoose','sequelize','typeorm','knex','postgresql','mysql','mongodb','redis','elasticsearch','dynamodb']),
  Infrastructure: new Set(['docker','kubernetes','github-actions','terraform','circleci','travis','stripe']),
}

const EID_BUCKET_STYLE = {
  Frontend:       { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd', dot: '#7c3aed' },
  Backend:        { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', dot: '#2563eb' },
  Auth:           { bg: '#fce7f3', color: '#9d174d', border: '#f9a8d4', dot: '#db2777' },
  'AI/ML':        { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe', dot: '#9333ea' },
  Database:       { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', dot: '#d97706' },
  Infrastructure: { bg: '#dcfce7', color: '#166534', border: '#86efac', dot: '#16a34a' },
}

const EID_DEPLOY_CONFIG = {
  production_ready: { label: 'Production Ready', color: '#16a34a', accent: '#16a34a', pct: 100 },
  automated:        { label: 'Automated Deploy', color: '#0891b2', accent: '#0891b2', pct: 80  },
  containerized:    { label: 'Containerized',    color: '#7c3aed', accent: '#7c3aed', pct: 60  },
  basic:            { label: 'Basic Infra',      color: '#d97706', accent: '#d97706', pct: 35  },
  none:             { label: 'Not Configured',   color: '#9ca3af', accent: '#9ca3af', pct: 5   },
}

const EID_AI_CONFIG = {
  production_ai:     { label: 'Production AI',  color: '#7c3aed', accent: '#7c3aed', pct: 100 },
  orchestrated_ai:   { label: 'Orchestrated AI',color: '#6d28d9', accent: '#6d28d9', pct: 75  },
  basic_integration: { label: 'AI Integrated',  color: '#4f46e5', accent: '#4f46e5', pct: 50  },
  none:              { label: 'No AI',           color: '#9ca3af', accent: '#9ca3af', pct: 0   },
}

const EID_MATURITY_CONFIG = {
  mature:     { label: 'Mature',      color: '#16a34a', accent: '#16a34a' },
  developing: { label: 'Developing',  color: '#0891b2', accent: '#0891b2' },
  early:      { label: 'Early Stage', color: '#d97706', accent: '#d97706' },
}

const EID_ENG_CONFIG = {
  senior: { label: 'Senior Engineer', color: '#16a34a', accent: '#16a34a' },
  mid:    { label: 'Mid-Level Eng.',  color: '#0891b2', accent: '#0891b2' },
  junior: { label: 'Junior Engineer', color: '#d97706', accent: '#d97706' },
}

const EID_PROJECT_TYPE_LABELS = {
  'ai_fullstack_application': 'AI Full-Stack App',
  'ai_powered_api':           'AI-Powered API',
  'ai_application':           'AI Web Application',
  'ai_project':               'AI / ML Project',
  'fullstack_application':    'Full-Stack Application',
  'frontend_application':     'Frontend Application',
  'api_service':              'API Service',
  'data_application':         'Data Application',
  'software_project':         'Software Project',
}

function eidScoreColor(score) {
  if (score >= 80) return '#16a34a'
  if (score >= 60) return '#0891b2'
  if (score >= 40) return '#d97706'
  if (score >= 20) return '#dc2626'
  return '#9ca3af'
}

function computeEIDMaturityScores(inference, intelligence, codeIntelligence) {
  const archP  = codeIntelligence?.architecturePatterns ?? []
  const infP   = inference?.patternsInferred ?? []
  const aiLvl  = intelligence?.aiCapabilities?.aiMaturityLevel ?? 'none'
  const depLvl = inference?.overallAssessment?.deploymentReadiness ?? 'none'

  const archScore = Math.min(100, Math.round(
    Math.min(archP.length, 8) / 8 * 55 +
    (infP.includes('fullstack_architecture_confirmed') ? 20 : 0) +
    (infP.includes('strong_domain_separation') ? 15 : 0) +
    (infP.includes('enterprise_backend_patterns') ? 10 : 0),
  ))

  const aiScores = { production_ai: 100, orchestrated_ai: 75, basic_integration: 45, none: 0 }
  const aiScore  = aiScores[aiLvl] ?? 0

  const depScores = { production_ready: 100, automated: 80, containerized: 60, basic: 35, none: 5 }
  const prodScore = depScores[depLvl] ?? 5

  const scalScore = Math.min(100, Math.round(
    (archP.includes('containerization')      ? 30 : 0) +
    (archP.includes('cicd_pipeline')         ? 20 : 0) +
    (archP.includes('infrastructure_as_code')? 25 : 0) +
    (infP.includes('scalable_service_architecture') ? 25 : 0),
  ))

  const secScore = Math.min(100, Math.round(
    (infP.includes('authentication_layer_present') ? 45 : 0) +
    (archP.includes('stateless_auth')              ? 20 : 0) +
    (archP.includes('strategy_based_auth')         ? 15 : 0) +
    (archP.includes('provider_based_auth')         ? 15 : 0) +
    (archP.includes('hosted_auth_provider')        ? 20 : 0) +
    (infP.includes('enterprise_backend_patterns')  ? 25 : 0),
  ))

  const docScore = Math.min(100, Math.round(
    (intelligence?.strengths?.testingPresent ? 45 : 0) +
    (archP.includes('cicd_pipeline') ? 35 : 0) +
    (archP.includes('infrastructure_as_code') ? 20 : 0),
  ))

  return [
    { label: 'Architecture Quality', score: archScore },
    { label: 'AI Sophistication',    score: aiScore  },
    { label: 'Production Readiness', score: prodScore },
    { label: 'Scalability',          score: scalScore },
    { label: 'Security',             score: secScore  },
    { label: 'Testing & CI/CD',      score: docScore  },
  ]
}

function computeEIDTechLandscape(technologies, frameworks) {
  const all = [...new Set([...(technologies ?? []), ...(frameworks ?? [])])]
  const result = {}
  for (const [cat, techSet] of Object.entries(EID_TECH_BUCKETS)) {
    const matches = all
      .filter(t => techSet.has(t))
      .map(t => CI_TECH_LABELS[t] || t)
      .sort((a, b) => a.localeCompare(b))
    if (matches.length > 0) result[cat] = matches
  }
  return result
}

function computeEIDReadinessSignals(intelligence, inference, codeIntelligence) {
  const archP = codeIntelligence?.architecturePatterns ?? []
  const infP  = inference?.patternsInferred ?? []
  return [
    { label: 'Automated Testing',    present: intelligence?.strengths?.testingPresent === true },
    { label: 'CI/CD Pipeline',       present: archP.includes('cicd_pipeline') },
    { label: 'Containerized Deploy', present: archP.includes('containerization') },
    { label: 'Security Layer',       present: infP.includes('authentication_layer_present') },
    { label: 'Infrastructure Code',  present: archP.includes('infrastructure_as_code') },
    { label: 'Payment Integration',  present: archP.includes('payment_processing') },
  ]
}

function EIDKPICard({ label, value, sub, color, accent }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px 14px', borderTop: `3px solid ${accent}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', minWidth: 0 }}>
      <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
      <p style={{ margin: '0 0 3px', fontSize: '15px', fontWeight: '800', color, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
      <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</p>
    </div>
  )
}

// ── Overview analysis helpers ─────────────────────────────────────────────────

function generateDetectedStrengths(intelligence, inference, codeIntelligence) {
  const rawStrengths = [
    ...(intelligence?.strengths?.strengths ?? []),
    ...(inference?.strengths ?? []),
  ]
  if (rawStrengths.length > 0) return [...new Set(rawStrengths)].slice(0, 8)

  const strengths    = []
  const archPats     = codeIntelligence?.architecturePatterns ?? []
  const inferredPats = inference?.patternsInferred ?? []
  const technologies = [...(codeIntelligence?.technologies ?? []), ...(codeIntelligence?.frameworks ?? [])]

  if (inferredPats.includes('fullstack_architecture_confirmed'))
    strengths.push('Full-stack architecture with clear separation of frontend and backend concerns')
  if (inferredPats.includes('ai_orchestrated_system'))
    strengths.push('Sophisticated AI orchestration integrating multiple model providers')
  if (inferredPats.includes('ai_integration_confirmed') && !inferredPats.includes('ai_orchestrated_system'))
    strengths.push('AI capabilities integrated into core application workflows')
  if (inferredPats.includes('retrieval_augmented_architecture'))
    strengths.push('Retrieval-Augmented Generation (RAG) implementation for intelligent search')
  if (inferredPats.includes('production_ready_backend'))
    strengths.push('Production-ready backend with operational maturity signals')
  if (inferredPats.includes('enterprise_backend_patterns'))
    strengths.push('Enterprise-grade backend patterns with domain-driven design')
  if (inferredPats.includes('strong_domain_separation'))
    strengths.push('Strong module and domain separation promoting maintainability')
  if (inferredPats.includes('authentication_layer_present'))
    strengths.push('Secure authentication layer protecting application endpoints')
  if (archPats.includes('cicd_pipeline'))
    strengths.push('CI/CD pipeline configured for automated delivery')
  if (archPats.includes('containerization'))
    strengths.push('Containerized deployment configuration present')
  if (intelligence?.strengths?.testingPresent)
    strengths.push('Automated test suite detected')
  const techCount = technologies.length
  if (techCount >= 8)
    strengths.push(`Broad technology stack with ${techCount} detected technologies and frameworks`)

  return [...new Set(strengths)].slice(0, 8)
}

function generateDetectedGaps(intelligence, inference, codeIntelligence) {
  const recommendations = inference?.recommendations ?? []
  if (recommendations.length > 0) return recommendations.slice(0, 6)

  const gaps     = []
  const archPats = codeIntelligence?.architecturePatterns ?? []
  const infPats  = inference?.patternsInferred ?? []
  const technologies = [...(codeIntelligence?.technologies ?? []), ...(codeIntelligence?.frameworks ?? [])]

  if (!archPats.includes('cicd_pipeline'))
    gaps.push('CI/CD pipeline not detected')
  if (!archPats.includes('containerization'))
    gaps.push('No deployment configuration detected')
  if (!infPats.includes('authentication_layer_present'))
    gaps.push('Authentication layer not detected')
  if (!intelligence?.strengths?.testingPresent)
    gaps.push('Limited testing evidence found')
  if (!archPats.includes('infrastructure_as_code'))
    gaps.push('Infrastructure-as-Code not detected')

  const hasMonitoring = technologies.some(t => ['datadog','sentry','newrelic','prometheus'].includes(t))
  if (!hasMonitoring)
    gaps.push('No monitoring or observability tooling detected')

  const deployReady = inference?.overallAssessment?.deploymentReadiness ?? 'none'
  if (deployReady === 'none')
    gaps.push('Production deployment strategy not configured')

  if (inference?.overallAssessment?.projectMaturity === 'early')
    gaps.push('Project shows early-stage maturity — further development needed')

  return [...new Set(gaps)].filter(Boolean).slice(0, 6)
}

function generateRecommendedImprovements(intelligence, inference, codeIntelligence) {
  const pool     = []
  const archPats = codeIntelligence?.architecturePatterns ?? []
  const infPats  = inference?.patternsInferred ?? []
  const technologies = [...(codeIntelligence?.technologies ?? []), ...(codeIntelligence?.frameworks ?? [])]

  if (!archPats.includes('containerization'))
    pool.push({ title: 'Add Docker containerization', impact: 'High' })
  if (!archPats.includes('cicd_pipeline'))
    pool.push({ title: 'Configure CI/CD pipeline', impact: 'High' })
  if (!intelligence?.strengths?.testingPresent)
    pool.push({ title: 'Add automated test suite', impact: 'High' })
  if (!infPats.includes('authentication_layer_present'))
    pool.push({ title: 'Implement authentication layer', impact: 'High' })

  const deployReady = inference?.overallAssessment?.deploymentReadiness ?? 'none'
  if (deployReady === 'none')
    pool.push({ title: 'Configure production deployment strategy', impact: 'High' })

  if (!archPats.includes('infrastructure_as_code'))
    pool.push({ title: 'Add Infrastructure-as-Code (Terraform / CDK)', impact: 'Medium' })
  if (infPats.includes('ai_integration_confirmed') && !infPats.includes('ai_orchestrated_system'))
    pool.push({ title: 'Upgrade to orchestrated AI workflows', impact: 'Medium' })

  const hasMonitoring = technologies.some(t => ['datadog','sentry','newrelic','prometheus'].includes(t))
  if (!hasMonitoring)
    pool.push({ title: 'Add monitoring and error tracking', impact: 'Medium' })

  if (!infPats.includes('strong_domain_separation') && !infPats.includes('enterprise_backend_patterns'))
    pool.push({ title: 'Refactor toward domain-driven module structure', impact: 'Low' })

  pool.push({ title: 'Add API documentation (Swagger / OpenAPI)', impact: 'Low' })

  return [...new Map(pool.map(i => [i.title, i])).values()].slice(0, 5)
}

// ── ExecutiveIntelligenceDashboard ────────────────────────────────────────────

function ExecutiveIntelligenceDashboard({ intelligence, inference, codeIntelligence }) {
  const ia = inference?.overallAssessment ?? {}
  const ic = inference?.confidence ?? {}

  const engScore     = Math.round((ic.overall ?? 0) * 100)
  const signalScore  = Math.round((ic.signalCoverage ?? 0) * 100)
  const engLevel     = ia.engineeringLevel ?? null
  const projMaturity = ia.projectMaturity  ?? null
  const engConf = EID_ENG_CONFIG[engLevel]         ?? null
  const matConf = EID_MATURITY_CONFIG[projMaturity] ?? null

  const hiringSignals      = computeHiringSignals(intelligence, inference, codeIntelligence)
  const jobReadiness       = computePlacementReadiness(hiringSignals, inference)
  const jobReadinessLabel  = jobReadiness >= 80 ? 'Interview Ready' : jobReadiness >= 60 ? 'Nearly Ready' : jobReadiness >= 40 ? 'Needs Work' : 'Not Ready'
  const jobReadinessColor  = jobReadiness >= 80 ? '#16a34a' : jobReadiness >= 60 ? '#0891b2' : jobReadiness >= 40 ? '#d97706' : '#dc2626'
  const projectValueSkills = deriveArchitectureSkills(intelligence, inference, codeIntelligence).slice(0, 6)

  const kpiCards = [
    inference ? {
      label: 'Engineering Score',
      value: `${engScore}%`,
      sub: engScore >= 72 ? 'Strong' : engScore >= 48 ? 'Developing' : 'Emerging',
      color: eidScoreColor(engScore),
      accent: '#4f46e5',
    } : null,
    inference ? {
      label: 'Confidence',
      value: `${signalScore}%`,
      sub: 'Signal coverage',
      color: eidScoreColor(signalScore),
      accent: '#0891b2',
    } : null,
    engConf ? {
      label: 'Engineering Level',
      value: engConf.label,
      sub: engLevel === 'senior' ? 'Advanced' : engLevel === 'mid' ? 'Professional' : 'Foundation',
      color: engConf.color,
      accent: engConf.accent,
    } : null,
    matConf ? {
      label: 'Project Maturity',
      value: matConf.label,
      sub: projMaturity === 'mature' ? 'Production grade' : projMaturity === 'developing' ? 'Growing' : 'Early stage',
      color: matConf.color,
      accent: matConf.accent,
    } : null,
    {
      label: 'Job Readiness',
      value: `${jobReadiness}%`,
      sub: jobReadinessLabel,
      color: jobReadinessColor,
      accent: jobReadinessColor,
    },
  ].filter(Boolean)

  // Purpose card data
  const hookSentence  = intelligence?.portfolioNarrative?.hookSentence ?? null
  const overview      = intelligence?.executiveSummary?.overview        ?? null
  const probDomain    = intelligence?.businessValue?.probableDomain      ?? null
  const projectType   = intelligence?.executiveSummary?.projectType      ?? null
  const projectImpact = intelligence?.portfolioNarrative?.projectImpact  ?? null
  const projTypeLabel = projectType ? (EID_PROJECT_TYPE_LABELS[projectType] ?? projectType) : null
  const hasPurpose    = !!(hookSentence || overview || probDomain)

  // Capabilities card data
  const engCaps    = intelligence?.skills?.engineeringCapabilities ?? []
  const aiFeatures = intelligence?.aiCapabilities?.aiFeatures      ?? []
  const allCaps    = [...new Set([...engCaps, ...aiFeatures].filter(Boolean))].slice(0, 9)
  const hasCaps    = allCaps.length > 0

  // Maturity Assessment — only show if inference or intelligence exists
  const showMaturity   = !!(inference || intelligence)
  const maturityScores = computeEIDMaturityScores(inference, intelligence, codeIntelligence)


  // Readiness signals — shown only when we have some data basis
  const readinessSignals = computeEIDReadinessSignals(intelligence, inference, codeIntelligence)
  const anyReadinessKnown = readinessSignals.some(s => s.present)

  const detectedStrengths = generateDetectedStrengths(intelligence, inference, codeIntelligence)
  const detectedGaps      = generateDetectedGaps(intelligence, inference, codeIntelligence)
  const improvements      = generateRecommendedImprovements(intelligence, inference, codeIntelligence)
  const impactBadge       = imp => imp === 'High' ? { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' } : imp === 'Medium' ? { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' } : { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' }

  return (
    <div style={{ marginBottom: '24px' }}>

      {/* Header */}
      <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)', borderRadius: '16px 16px 0 0' }}>
        <p style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'white', letterSpacing: '-0.3px' }}>Repository Analysis</p>
        <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#a5b4fc' }}>Automated code & architecture analysis</p>
      </div>

      {/* Body */}
      <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 16px 16px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* KPI row */}
        {kpiCards.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpiCards.length}, 1fr)`, gap: '10px' }}>
            {kpiCards.map((card, i) => (
              <EIDKPICard key={i} {...card} />
            ))}
          </div>
        )}

        {/* Repository Purpose */}
        {hasPurpose && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Repository Purpose</p>
            {hookSentence && (
              <p style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '700', color: '#1e1b4b', lineHeight: '1.45' }}>{hookSentence}</p>
            )}
            {overview && (
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#374151', lineHeight: '1.65' }}>{overview}</p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {projTypeLabel && (
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Category</p>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#4f46e5', padding: '3px 10px', backgroundColor: '#eef2ff', borderRadius: '8px', border: '1px solid #a5b4fc', display: 'inline-block' }}>{projTypeLabel}</span>
                </div>
              )}
              {probDomain && (
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Domain</p>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#0369a1', padding: '3px 10px', backgroundColor: '#e0f2fe', borderRadius: '8px', border: '1px solid #7dd3fc', display: 'inline-block', textTransform: 'capitalize' }}>{probDomain}</span>
                </div>
              )}
            </div>
            {projectImpact && (
              <div style={{ marginTop: '12px', padding: '10px 13px', backgroundColor: '#f0f9ff', borderRadius: '8px', borderLeft: '3px solid #0284c7' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#0369a1', fontStyle: 'italic', lineHeight: '1.55' }}>{projectImpact}</p>
              </div>
            )}
          </div>
        )}

        {/* Project Value */}
        {projectValueSkills.length > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Project Value</p>
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#6b7280' }}>This project demonstrates:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
              {projectValueSkills.map((skill, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
                  <span style={{ color: '#16a34a', fontWeight: '700', flexShrink: 0 }}>✓</span>
                  <span style={{ fontWeight: '500' }}>{skill}</span>
                </div>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
              Students can confidently discuss these topics during interviews.
            </p>
          </div>
        )}

        {/* Detected Capabilities */}
        {hasCaps && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Detected Capabilities</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {allCaps.map((cap, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#334155', lineHeight: '1.45' }}>
                  <span style={{ color: '#6366f1', flexShrink: 0, fontSize: '9px', marginTop: '3px' }}>◆</span>
                  {cap}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Maturity Assessment */}
        {showMaturity && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={{ margin: '0 0 14px', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Maturity Assessment</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
              {maturityScores.map(({ label, score }) => {
                const fill = eidScoreColor(score)
                return (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>{label}</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: fill, minWidth: 28, textAlign: 'right' }}>{score}</span>
                    </div>
                    <div style={{ height: '5px', borderRadius: '3px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${score}%`, backgroundColor: fill, borderRadius: '3px' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Detected Strengths + Detected Gaps */}
        {(detectedStrengths.length > 0 || detectedGaps.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: detectedStrengths.length > 0 && detectedGaps.length > 0 ? '1fr 1fr' : '1fr', gap: '12px' }}>
            {detectedStrengths.length > 0 && (
              <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Detected Strengths</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {detectedStrengths.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>
                      <span style={{ color: '#16a34a', flexShrink: 0, fontWeight: '700' }}>✓</span>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detectedGaps.length > 0 && (
              <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Detected Gaps</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {detectedGaps.map((g, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>
                      <span style={{ color: '#d97706', flexShrink: 0, fontWeight: '700' }}>⚠</span>
                      {g}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recommended Improvements */}
        {improvements.length > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Recommended Improvements</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {improvements.map(({ title, impact }, i) => {
                const ib = impactBadge(impact)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '8px 12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                      <span style={{ color: '#94a3b8', fontWeight: '700', fontSize: '11px', flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>{title}</span>
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', backgroundColor: ib.bg, color: ib.color, border: `1px solid ${ib.border}`, flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {impact}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Documentation & Readiness */}
        {anyReadinessKnown && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Documentation & Readiness</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {readinessSignals.map(({ label, present }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', borderRadius: '10px', backgroundColor: present ? '#f0fdf4' : '#fafafa', border: `1px solid ${present ? '#86efac' : '#e5e7eb'}` }}>
                  <span style={{ fontSize: '12px', color: present ? '#16a34a' : '#d1d5db', fontWeight: '700' }}>{present ? '✓' : '○'}</span>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: present ? '#166534' : '#9ca3af' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PortfolioIntelligenceOverview ─────────────────────────────────────────────

function PortfolioIntelligenceOverview({ inference, intelligence, codeIntelligence }) {
  const scores = computePortfolioScores(inference, codeIntelligence, intelligence)

  const overallScore = inference.confidence?.overall ?? 0
  const overallPct   = Math.round(overallScore * 100)
  const scoreColor   = portfolioScoreColor(overallScore)
  const strength     = inference.overallAssessment?.portfolioStrength ?? 'emerging'

  const engineeringLevel    = inference.overallAssessment?.engineeringLevel    ?? 'junior'
  const maturity            = inference.overallAssessment?.projectMaturity      ?? 'early'
  const deploymentReadiness = inference.overallAssessment?.deploymentReadiness  ?? 'none'
  const mStyle              = maturityBadgeStyle(maturity)
  const depInfo             = deploymentBadgeInfo(deploymentReadiness)

  const signalCoverage = inference.confidence?.signalCoverage        ?? 0
  const consistency    = inference.confidence?.crossPhaseConsistency  ?? 0

  const patterns        = inference.patternsInferred ?? []
  const strengths       = inference.strengths        ?? []
  const recommendations = inference.recommendations  ?? []

  const RADIUS       = 52
  const CIRCUMF      = 2 * Math.PI * RADIUS
  const strokeOffset = CIRCUMF - overallScore * CIRCUMF

  const scoreCards = [
    { label: 'Architecture Quality', value: scores.architectureQuality, color: '#2563eb' },
    { label: 'AI Sophistication',    value: scores.aiSophistication,    color: '#7c3aed' },
    { label: 'Production Readiness', value: scores.productionReadiness, color: '#16a34a' },
    { label: 'Scalability',          value: scores.scalability,         color: '#0891b2' },
    { label: 'Technology Breadth',   value: scores.technologyBreadth,   color: '#d97706' },
  ]

  return (
    <div style={{ marginBottom: '24px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(79,70,229,0.10)', border: '1px solid #e0e7ff' }}>

      {/* Gradient header */}
      <div style={{ padding: '16px 24px', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'white', letterSpacing: '-0.2px' }}>Portfolio Intelligence Overview</p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.70)' }}>Cross-phase synthesis · Inference Engine</p>
        </div>
        <span style={{ padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.18)', color: 'white', border: '1px solid rgba(255,255,255,0.30)' }}>
          {strength.charAt(0).toUpperCase() + strength.slice(1)} Portfolio
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 24px', backgroundColor: '#f8f9ff' }}>

        {/* Hero row */}
        <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: '16px', marginBottom: '16px' }}>

          {/* Score + Assessment card */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px 16px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ position: 'relative', width: 120, height: 120 }}>
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="#f3f4f6" strokeWidth="10" />
                <circle cx="60" cy="60" r={RADIUS} fill="none" stroke={scoreColor} strokeWidth="10"
                  strokeDasharray={CIRCUMF} strokeDashoffset={strokeOffset}
                  strokeLinecap="round" transform="rotate(-90 60 60)" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ margin: 0, fontSize: '30px', fontWeight: '900', color: scoreColor, lineHeight: 1 }}>{overallPct}</p>
                <p style={{ margin: 0, fontSize: '10px', color: '#9ca3af', fontWeight: '700' }}>/ 100</p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'center' }}>Portfolio Score</p>

            <div style={{ width: '100%', height: '1px', backgroundColor: '#f3f4f6' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', width: '100%' }}>
              {[
                { label: 'Engineering Level', badge: engineeringLevel, badgeStyle: seniorityBadgeStyle(engineeringLevel) },
                { label: 'Project Maturity',  badge: maturity,         badgeStyle: { backgroundColor: mStyle.bg, color: mStyle.color, border: `1px solid ${mStyle.border}` } },
                { label: 'Deployment',        badge: depInfo.label,    badgeStyle: { backgroundColor: depInfo.bg, color: depInfo.color, border: `1px solid ${depInfo.border}` } },
              ].map(({ label, badge, badgeStyle }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600' }}>{label}</span>
                  <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', ...badgeStyle }}>{badge}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Confidence + Score Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px 18px', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Confidence Metrics</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: 'Signal Coverage',         value: signalCoverage, color: '#4f46e5' },
                  { label: 'Cross-Phase Consistency', value: consistency,    color: '#7c3aed' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>{label}</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color }}>{Math.round(value * 100)}%</span>
                    </div>
                    <div style={{ height: '7px', borderRadius: '4px', backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round(value * 100)}%`, height: '100%', borderRadius: '4px', background: `linear-gradient(90deg, ${color}99, ${color})` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px 18px', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', flex: 1 }}>
              <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Score Breakdown</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {scoreCards.map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>{label}</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color }}>{Math.round(value * 100)}</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round(value * 100)}%`, height: '100%', borderRadius: '3px', background: `linear-gradient(90deg, ${color}80, ${color})` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Insights row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>

          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              <span style={{ color: '#16a34a', marginRight: '5px' }}>✦</span>Detected Strengths
            </p>
            {strengths.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {strengths.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: '7px', fontSize: '12px', color: '#374151', lineHeight: '1.45' }}>
                    <span style={{ color: '#16a34a', flexShrink: 0 }}>✓</span>{s}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>No strengths detected yet.</p>
            )}
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              <span style={{ color: '#d97706', marginRight: '5px' }}>◆</span>Recommendations
            </p>
            {recommendations.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {recommendations.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: '7px', fontSize: '12px', color: '#374151', lineHeight: '1.45' }}>
                    <span style={{ color: '#d97706', flexShrink: 0 }}>→</span>{r}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>No recommendations at this time.</p>
            )}
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              <span style={{ color: '#4f46e5', marginRight: '5px' }}>◈</span>Inferred Patterns
            </p>
            {patterns.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {patterns.map((p, i) => {
                  const s = patternChipStyle(p)
                  return (
                    <span key={i} style={{ padding: '3px 9px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                      {patternLabel(p)}
                    </span>
                  )
                })}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>No patterns inferred yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── SystemArchitectureCanvas ──────────────────────────────────────────────────

function SystemArchitectureCanvas({ intelligence, inference, codeIntelligence }) {
  const detectedDomains  = codeIntelligence?.detectedDomains     ?? []
  const technologies     = codeIntelligence?.technologies        ?? []
  const frameworks       = codeIntelligence?.frameworks          ?? []
  const allTechs         = [...new Set([...technologies, ...frameworks])]
  const archPatterns     = codeIntelligence?.architecturePatterns ?? []
  const inferredPatterns = inference?.patternsInferred            ?? []

  const activeTiers = ARCH_TIER_CONFIG.filter(tier =>
    tier.domains.some(d => detectedDomains.includes(d))
  )

  if (activeTiers.length === 0) return null

  const activeTierIds     = new Set(activeTiers.map(t => t.id))
  const activeConnections = ARCH_TIER_CONNECTIONS.filter(
    c => activeTierIds.has(c.from) && activeTierIds.has(c.to)
  )

  const externalIntegrations = inferExternalIntegrations(technologies, frameworks)
  const infraSignals         = inferInfrastructureSignals(technologies, frameworks, archPatterns)

  function tierTechs(tier) {
    return allTechs.filter(t => tier.ciDomains.includes(CI_TECH_DOMAIN[t] ?? 'default')).slice(0, 8)
  }

  function tierPatterns(tier) {
    const relevant = ARCH_PATTERN_TIER[tier.id] ?? []
    return archPatterns.filter(p => relevant.includes(p)).slice(0, 4)
  }

  return (
    <div style={{ marginBottom: '24px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', border: '1px solid #1e293b' }}>

      <style>{`
        @keyframes archFlowDot {
          0%   { top: 0%; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>

      {/* Dark gradient header */}
      <div style={{ padding: '16px 24px', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'white', letterSpacing: '-0.3px' }}>System Architecture Canvas</p>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#94a3b8' }}>Layer topology · integrations · infrastructure signals</p>
        </div>
        <div style={{ display: 'flex', gap: '7px' }}>
          <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', backgroundColor: 'rgba(139,92,246,0.25)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.4)' }}>
            {activeTiers.length} layer{activeTiers.length !== 1 ? 's' : ''}
          </span>
          <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', backgroundColor: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.35)' }}>
            {activeConnections.length} flow{activeConnections.length !== 1 ? 's' : ''}
          </span>
          {archPatterns.length > 0 && (
            <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', backgroundColor: 'rgba(59,130,246,0.2)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.35)' }}>
              {archPatterns.length} patterns
            </span>
          )}
        </div>
      </div>

      {/* Canvas body */}
      <div style={{ backgroundColor: '#f8fafc' }}>

        {/* ── Application Layers ── */}
        <div style={{ padding: '20px 24px 0' }}>
          <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Application Layers</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {activeTiers.map((tier, idx) => {
              const techs    = tierTechs(tier)
              const patterns = tierPatterns(tier)
              const nextTier = activeTiers[idx + 1] ?? null
              const conn     = nextTier ? ARCH_TIER_CONNECTIONS.find(c => c.from === tier.id && c.to === nextTier.id) : null
              const label    = SYSTEM_LAYER_LABELS[tier.id] ?? tier.label

              return (
                <div key={tier.id}>
                  {/* Compact tier card */}
                  <div
                    style={{ backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${tier.border}`, display: 'flex', transition: 'transform 0.15s, box-shadow 0.15s', cursor: 'default' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 14px ${tier.color}28` }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)' }}
                  >
                    {/* Left accent bar */}
                    <div style={{ width: '4px', backgroundColor: tier.color, flexShrink: 0 }} />

                    {/* Card content */}
                    <div style={{ flex: 1, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '14px', minHeight: 54 }}>
                      {/* Icon + name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 160 }}>
                        <span style={{ width: 28, height: 28, borderRadius: '7px', backgroundColor: `${tier.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0, border: `1px solid ${tier.border}` }}>
                          {tier.icon}
                        </span>
                        <div>
                          <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#111827' }}>{tier.label}</p>
                          <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8' }}>{label}</p>
                        </div>
                      </div>

                      {/* Tech chips */}
                      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {techs.map((t, i) => (
                          <span key={i} style={{ padding: '2px 7px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', backgroundColor: `${tier.color}12`, color: tier.color, border: `1px solid ${tier.border}` }}>
                            {CI_TECH_LABELS[t] || t}
                          </span>
                        ))}
                        {patterns.map((p, i) => (
                          <span key={`p${i}`} style={{ padding: '2px 7px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                            {fmtArchPattern(p)}
                          </span>
                        ))}
                        {techs.length === 0 && patterns.length === 0 && (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Layer detected</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Animated connector */}
                  {nextTier && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', height: '38px' }}>
                      {/* Gradient line */}
                      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', background: `linear-gradient(180deg, ${tier.color}66, ${nextTier.color}66)`, transform: 'translateX(-50%)' }}>
                        {/* Animated flow dot */}
                        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%', backgroundColor: tier.color, animation: 'archFlowDot 2s ease-in-out infinite', animationDelay: `${idx * 0.4}s` }} />
                      </div>
                      {/* Arrow tip */}
                      <div style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', fontSize: '10px', color: nextTier.color, lineHeight: 1 }}>▼</div>
                      {/* Relationship label pill */}
                      <div style={{ position: 'relative', zIndex: 1, padding: '3px 12px', borderRadius: '10px', backgroundColor: 'white', border: `1px solid ${tier.border}`, fontSize: '10px', fontWeight: '700', color: tier.color, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', letterSpacing: '0.2px' }}>
                        {conn
                          ? archConnectionLabel(conn.from, conn.to, inferredPatterns)
                          : archConnectionLabel(tier.id, nextTier.id, inferredPatterns)}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Infrastructure & Deployment ── */}
        {infraSignals.length > 0 && (
          <div style={{ margin: '16px 24px 0', borderRadius: '10px', overflow: 'hidden', border: '1px solid #334155' }}>
            <div style={{ padding: '10px 16px', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>⚙️</span>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Infrastructure & Deployment</p>
            </div>
            <div style={{ padding: '12px 16px', backgroundColor: '#0f172a', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {infraSignals.map((sig, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '8px', backgroundColor: sig.bg ?? '#1e293b', border: `1px solid ${sig.border ?? '#334155'}` }}>
                  <span style={{ fontSize: '14px' }}>{sig.icon}</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: sig.color ?? '#94a3b8' }}>{sig.label}</span>
                  {sig.source === 'inferred' && (
                    <span style={{ fontSize: '9px', color: '#64748b', fontWeight: '600' }}>inferred</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── External Integrations ── */}
        {externalIntegrations.length > 0 && (
          <div style={{ margin: '16px 24px 0' }}>
            <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.7px' }}>External Integrations</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {externalIntegrations.map((intg, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 13px', borderRadius: '10px', backgroundColor: 'white', border: `1px solid ${intg.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: '16px' }}>{intg.icon}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: intg.color }}>{intg.label}</p>
                    <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8' }}>{intg.category}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI Architecture Analysis ── */}
        {intelligence?.architecture?.overview && (
          <div style={{ margin: '16px 24px 0', padding: '13px 16px', backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', borderLeft: '4px solid #7c3aed' }}>
            <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '700', color: '#5b21b6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Architecture Analysis</p>
            <p style={{ margin: 0, fontSize: '13px', color: '#374151', lineHeight: '1.65' }}>{intelligence.architecture.overview}</p>
          </div>
        )}

        {/* ── Data Flows legend ── */}
        {activeConnections.length > 0 && (
          <div style={{ margin: '16px 24px', padding: '10px 16px', backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>Data Flows</p>
            {activeTiers.map(tier => (
              <div key={tier.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: tier.color, flexShrink: 0 }} />
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>{tier.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Portfolio Report Tab ─────────────────────────────────────────────────────

const PR_SKILL_GROUPS = [
  {
    name: 'Backend',
    icon: '🔗',
    style: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
    techs: new Set(['express', 'fastify', 'nestjs', 'trpc', 'koa', 'hono', 'graphql']),
  },
  {
    name: 'Database',
    icon: '🗃',
    style: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
    techs: new Set(['prisma', 'drizzle', 'mongoose', 'sequelize', 'typeorm', 'knex', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb']),
  },
  {
    name: 'AI/ML',
    icon: '🤖',
    style: { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' },
    techs: new Set(['openai', 'anthropic', 'langchain', 'llamaindex', 'vercel-ai-sdk', 'pinecone', 'weaviate', 'chromadb', 'embeddings', 'mistral', 'cohere', 'groq']),
  },
  {
    name: 'DevOps',
    icon: '⚙',
    style: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
    techs: new Set(['docker', 'kubernetes', 'github-actions', 'terraform', 'circleci', 'travis']),
  },
  {
    name: 'Testing',
    icon: '✓',
    style: { bg: '#ecfdf5', color: '#065f46', border: '#6ee7b7' },
    techs: new Set(['jest', 'vitest', 'mocha', 'cypress', 'playwright', 'supertest', 'chai', 'jasmine']),
  },
]

function generateInterviewTalkingPoints(intelligence, inference, codeIntelligence) {
  const pool = []
  const archPatterns    = codeIntelligence?.architecturePatterns ?? []
  const inferredPats    = inference?.patternsInferred ?? []
  const technologies    = [...(codeIntelligence?.technologies ?? []), ...(codeIntelligence?.frameworks ?? [])]
  const engLevel        = inference?.overallAssessment?.engineeringLevel ?? 'mid'

  const apiTechs   = technologies.filter(t => ['express', 'fastify', 'nestjs', 'trpc', 'koa', 'hono'].includes(t))
  const dbTechs    = technologies.filter(t => ['sequelize', 'prisma', 'drizzle', 'mongoose', 'typeorm', 'postgresql', 'mysql', 'mongodb'].includes(t))
  const aiTechs    = technologies.filter(t => ['openai', 'anthropic', 'langchain', 'llamaindex', 'groq', 'mistral', 'cohere', 'vercel-ai-sdk'].includes(t))
  const vecTechs   = technologies.filter(t => ['pinecone', 'weaviate', 'chromadb', 'embeddings'].includes(t))
  const infraTechs = technologies.filter(t => ['docker', 'kubernetes', 'github-actions', 'terraform'].includes(t))
  const authTechs  = technologies.filter(t => ['jwt', 'passport', 'next-auth', 'clerk', 'firebase-auth', 'better-auth', 'lucia'].includes(t))
  const feTechs    = technologies.filter(t => ['react', 'nextjs', 'vue', 'angular', 'svelte'].includes(t))

  const fmt = arr => arr.map(t => CI_TECH_LABELS[t] || t).join(' and ')

  if (archPatterns.some(p => ['rest_api', 'enterprise_rest_api', 'graphql_api', 'type_safe_api'].includes(p)) || apiTechs.length > 0) {
    const apiType = archPatterns.includes('graphql_api') ? 'GraphQL API' : archPatterns.includes('type_safe_api') ? 'type-safe API' : 'RESTful API'
    const techs   = [...apiTechs, ...dbTechs.slice(0, 1)]
    pool.push(`Designed ${apiType} architecture${techs.length ? ' using ' + fmt(techs) : ''}`)
  }

  if (inferredPats.includes('ai_orchestrated_system') || inferredPats.includes('ai_integration_confirmed')) {
    pool.push(`Implemented AI orchestration workflows${aiTechs.length ? ' using ' + fmt(aiTechs) : ''}`)
  }

  if (inferredPats.includes('retrieval_augmented_architecture') || vecTechs.length > 0) {
    pool.push(`Applied vector embedding strategies for AI-powered retrieval${vecTechs.length ? ' using ' + fmt(vecTechs) : ''}`)
  }

  if (infraTechs.length > 0 || archPatterns.some(p => ['cicd_pipeline', 'containerization'].includes(p))) {
    pool.push(`Configured CI/CD and containerized deployment pipelines${infraTechs.length ? ' using ' + fmt(infraTechs) : ''}`)
  }

  if (authTechs.length > 0 || inferredPats.includes('authentication_layer_present')) {
    pool.push(`Implemented secure authentication and authorization layer${authTechs.length ? ' using ' + fmt(authTechs) : ''}`)
  }

  if (inferredPats.includes('fullstack_architecture_confirmed') && feTechs.length > 0) {
    pool.push(`Delivered full-stack features end-to-end using ${fmt(feTechs)} with a backend API`)
  }

  if (inferredPats.includes('enterprise_backend_patterns') || inferredPats.includes('strong_domain_separation')) {
    pool.push('Architected modular domain-driven backend with strong separation of concerns')
  }

  if (pool.length < 5) {
    const headline = intelligence?.executiveSummary?.headline
    if (headline) pool.push(headline)
  }

  if (pool.length < 5) {
    pool.push(`Engineered ${engLevel}-level production software applying modern development practices`)
  }

  return [...new Set(pool)].slice(0, 5)
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }
  return (
    <button
      onClick={handleCopy}
      style={{
        padding: '4px 12px', borderRadius: '6px',
        border: `1px solid ${copied ? '#86efac' : '#e5e7eb'}`,
        backgroundColor: copied ? '#f0fdf4' : 'white',
        color: copied ? '#166534' : '#6b7280',
        fontSize: '11px', fontWeight: '700',
        cursor: 'pointer', transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {copied ? '✓ Copied!' : '⎘ Copy'}
    </button>
  )
}

function generatePortfolioAssets(repo, intelligence, inference, codeIntelligence) {
  const technologies = [...(codeIntelligence?.technologies ?? []), ...(codeIntelligence?.frameworks ?? [])]
  const engLevel     = inference?.overallAssessment?.engineeringLevel ?? 'mid'
  const techLabels   = [...new Set(technologies)].map(t => CI_TECH_LABELS[t] || t)
  const techStr      = techLabels.slice(0, 8).join(', ')

  // A — Resume Bullets
  const rawBullets = intelligence?.resumeHighlights ?? intelligence?.resume?.bullets ?? []
  const genPoints  = generateInterviewTalkingPoints(intelligence, inference, codeIntelligence)
  const atsBullets = rawBullets.length > 0
    ? rawBullets.slice(0, 5).map(b => (b.startsWith('•') ? b : `• ${b}`))
    : genPoints.map(p => `• ${p}`)
  const extraBullets = [
    techStr ? `• Built production-ready ${engLevel}-level software using ${techStr}` : null,
    '• Collaborated on agile software delivery with peer review and documentation standards',
    '• Applied software engineering best practices across the full development lifecycle',
  ].filter(Boolean)
  const resumeBullets = [...new Set([...atsBullets, ...extraBullets])].slice(0, 5)

  // B — Project Description
  const hookSentence     = intelligence?.portfolioNarrative?.hookSentence ?? ''
  const narrative        = intelligence?.portfolioNarrative?.narrative ?? ''
  const summary          = intelligence?.executiveSummary?.summary ?? ''
  const headline         = intelligence?.executiveSummary?.headline ?? repo?.name ?? ''
  const projectType      = intelligence?.executiveSummary?.projectType ?? ''
  const projTypeLabel    = EID_PROJECT_TYPE_LABELS[projectType] ?? ''

  let projectDescription = ''
  if (narrative) {
    projectDescription = narrative
  } else if (hookSentence && summary) {
    projectDescription = `${hookSentence} ${summary}`
  } else if (summary) {
    projectDescription = summary
  } else {
    const techPart = techStr ? ` using ${techStr}` : ''
    const typePart = projTypeLabel ? ` ${projTypeLabel}` : ''
    projectDescription = `${headline} is a${typePart} engineered${techPart}. This project demonstrates ${engLevel}-level software engineering capabilities with a focus on production-quality delivery and modern architecture patterns.`
  }

  // C — LinkedIn Project Entry
  const linkedInTitle = headline || repo?.name || 'Software Project'
  const rawDesc       = hookSentence || summary || narrative || projectDescription
  const linkedInDesc  = rawDesc.length > 300 ? rawDesc.slice(0, 297) + '...' : rawDesc
  const linkedInTechs = techLabels.slice(0, 10).join(' · ')
  const linkedInText  = [
    `Project: ${linkedInTitle}`,
    '',
    `Description: ${linkedInDesc}`,
    linkedInTechs ? '' : null,
    linkedInTechs ? `Technologies: ${linkedInTechs}` : null,
  ].filter(v => v !== null).join('\n')

  return {
    resumeBullets,
    resumeBulletsText: resumeBullets.join('\n'),
    projectDescription,
    linkedInTitle,
    linkedInDesc,
    linkedInTechs,
    linkedInText,
  }
}

function generateResumeBullets(intelligence, inference, codeIntelligence) {
  const bullets      = []
  const archPats     = codeIntelligence?.architecturePatterns ?? []
  const inferredPats = inference?.patternsInferred ?? []
  const technologies = [...(codeIntelligence?.technologies ?? []), ...(codeIntelligence?.frameworks ?? [])]
  const fmt          = arr => arr.map(t => CI_TECH_LABELS[t] || t).join(', ')

  const apiTechs   = technologies.filter(t => ['express','fastify','nestjs','trpc','koa','hono'].includes(t))
  const dbTechs    = technologies.filter(t => ['sequelize','prisma','drizzle','mongoose','typeorm','postgresql','mysql','mongodb'].includes(t))
  const aiTechs    = technologies.filter(t => ['openai','anthropic','langchain','llamaindex','groq','mistral','cohere','vercel-ai-sdk'].includes(t))
  const vecTechs   = technologies.filter(t => ['pinecone','weaviate','chromadb','embeddings'].includes(t))
  const infraTechs = technologies.filter(t => ['docker','kubernetes','github-actions','terraform'].includes(t))
  const authTechs  = technologies.filter(t => ['jwt','passport','next-auth','clerk','firebase-auth','better-auth','lucia'].includes(t))
  const feTechs    = technologies.filter(t => ['react','nextjs','vue','angular','svelte','tailwind'].includes(t))

  if (apiTechs.length > 0 || archPats.some(p => ['rest_api','enterprise_rest_api','graphql_api'].includes(p))) {
    const apiType  = archPats.includes('graphql_api') ? 'GraphQL API' : archPats.includes('enterprise_rest_api') ? 'enterprise REST API' : 'RESTful API'
    const combined = [...new Set([...apiTechs, ...dbTechs.slice(0, 1)])]
    bullets.push(`Designed and implemented a ${apiType}${combined.length > 0 ? ' using ' + fmt(combined) : ''} with clean routing and data validation`)
  }

  if (aiTechs.length > 0 || inferredPats.includes('ai_orchestrated_system') || inferredPats.includes('ai_integration_confirmed')) {
    const depth = inferredPats.includes('ai_orchestrated_system') ? 'AI orchestration pipeline' : 'AI-powered features'
    bullets.push(`Implemented ${depth}${aiTechs.length > 0 ? ' integrating ' + fmt(aiTechs) : ''} to deliver intelligent application behavior`)
  }

  if (vecTechs.length > 0 || inferredPats.includes('retrieval_augmented_architecture')) {
    bullets.push(`Built Retrieval-Augmented Generation (RAG) system${vecTechs.length > 0 ? ' with ' + fmt(vecTechs) : ''} enabling semantic search and context-aware AI responses`)
  }

  if (inferredPats.includes('fullstack_architecture_confirmed') && feTechs.length > 0) {
    bullets.push(`Developed full-stack application using ${fmt(feTechs)} with end-to-end feature ownership from UI to database layer`)
  }

  if (infraTechs.length > 0 || archPats.some(p => ['cicd_pipeline','containerization'].includes(p))) {
    bullets.push(`Architected CI/CD pipeline and containerized deployment${infraTechs.length > 0 ? ' using ' + fmt(infraTechs) : ''} for automated, production-grade delivery`)
  }

  if (authTechs.length > 0 || inferredPats.includes('authentication_layer_present')) {
    bullets.push(`Implemented secure authentication and access control${authTechs.length > 0 ? ' using ' + fmt(authTechs) : ''} following security best practices`)
  }

  if (inferredPats.includes('enterprise_backend_patterns') || inferredPats.includes('strong_domain_separation')) {
    bullets.push('Architected modular, domain-driven codebase with strong separation of concerns and scalable service boundaries')
  }

  const headline = intelligence?.executiveSummary?.headline
  const summary  = intelligence?.executiveSummary?.summary ?? ''
  if (bullets.length < 4 && headline) {
    bullets.push(`Built ${headline} from architecture through deployment`)
  }
  if (bullets.length < 4 && summary) {
    bullets.push(`Developed production software: ${summary.slice(0, 120)}${summary.length > 120 ? '…' : ''}`)
  }

  const techStr = technologies.length > 0 ? fmt([...new Set(technologies)].slice(0, 4)) : 'modern technologies'
  if (bullets.length < 4) {
    bullets.push(`Developed production-quality software using ${techStr} with a focus on clean code and maintainability`)
  }

  return [...new Set(bullets)].slice(0, 6)
}

function generateFallbackBusinessValue(intelligence, inference, codeIntelligence) {
  const props        = []
  const inferredPats = inference?.patternsInferred ?? []
  const technologies = [...(codeIntelligence?.technologies ?? []), ...(codeIntelligence?.frameworks ?? [])]
  const aiMaturity   = intelligence?.aiCapabilities?.aiMaturityLevel ?? 'none'
  const engLevel     = inference?.overallAssessment?.engineeringLevel ?? 'mid'
  const hookSentence = intelligence?.portfolioNarrative?.hookSentence ?? ''
  const summary      = intelligence?.executiveSummary?.summary ?? ''

  const hasAI    = aiMaturity !== 'none'
  const hasRAG   = inferredPats.includes('retrieval_augmented_architecture')
  const hasFull  = inferredPats.includes('fullstack_architecture_confirmed')
  const hasAuth  = inferredPats.includes('authentication_layer_present')
  const hasProd  = inferredPats.includes('production_ready_backend')
  const hasScale = inferredPats.includes('scalable_service_architecture')
  const hasInfra = technologies.some(t => ['docker','kubernetes','github-actions'].includes(t))

  if (hookSentence) {
    props.push(hookSentence)
  } else if (summary) {
    props.push(summary.length > 140 ? summary.slice(0, 137) + '…' : summary)
  }

  if (hasAI && hasRAG) {
    props.push('Delivers AI-powered search and recommendation capabilities, reducing manual effort and improving information retrieval accuracy')
  } else if (hasAI) {
    props.push('Integrates AI/ML capabilities that automate complex workflows, enabling smarter user experiences at scale')
  }

  if (hasFull) {
    props.push('Accelerates product iteration through full-stack ownership — changes flow from UI to database without cross-team dependencies')
  }

  if (hasProd || hasInfra) {
    props.push('Production-ready infrastructure with automated deployment pipelines reduces time-to-market and lowers operational risk')
  }

  if (hasScale) {
    props.push('Horizontally scalable architecture supports growth from prototype to enterprise workloads without re-engineering the core system')
  }

  if (hasAuth) {
    props.push('Secure authentication layer protects user data and meets compliance requirements for access control and session management')
  }

  if (engLevel === 'senior' || inferredPats.includes('enterprise_backend_patterns')) {
    props.push('Senior engineering patterns ensure long-term maintainability, reducing technical debt and onboarding time for new developers')
  }

  return [...new Set(props)].filter(Boolean).slice(0, 5)
}

function PortfolioReportTab({ repo, intelligence, inference, codeIntelligence }) {
  const projectTitle = repo?.name ?? '—'
  const repoPurpose  = intelligence?.portfolioNarrative?.hookSentence
                    || intelligence?.executiveSummary?.summary
                    || null
  const engLevel     = inference?.overallAssessment?.engineeringLevel ?? null
  const projMaturity = inference?.overallAssessment?.projectMaturity  ?? null

  const rawBullets    = intelligence?.resumeHighlights ?? intelligence?.resume?.bullets ?? []
  const resumeBullets = rawBullets.length > 0
    ? rawBullets
    : generateResumeBullets(intelligence, inference, codeIntelligence)

  const allTechs     = [...new Set([...(codeIntelligence?.technologies ?? []), ...(codeIntelligence?.frameworks ?? []), ...(intelligence?.skills?.technical ?? [])])]
  const archPatterns = codeIntelligence?.architecturePatterns ?? []

  const skillGroups = PR_SKILL_GROUPS
    .map(g => ({ ...g, items: [...new Set(allTechs.filter(t => g.techs.has(t)))].map(t => CI_TECH_LABELS[t] || t) }))
    .filter(g => g.items.length > 0)

  if (archPatterns.length > 0) {
    skillGroups.push({
      name: 'Architecture',
      icon: '🏛',
      style: { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
      items: [...new Set(archPatterns)].slice(0, 6).map(fmtArchPattern),
    })
  }

  const bizValue    = intelligence?.businessValue ?? null
  const hasBizValue = bizValue && (bizValue.valuePropositions?.length > 0 || bizValue.targetUsers || bizValue.scalabilityNotes)
  const bizProps    = hasBizValue ? (bizValue.valuePropositions ?? []) : generateFallbackBusinessValue(intelligence, inference, codeIntelligence)

  if (!intelligence && !inference && !codeIntelligence) {
    return (
      <div style={{ textAlign: 'center', padding: '56px 24px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
        <p style={{ fontSize: '32px', margin: '0 0 8px' }}>📋</p>
        <p style={{ margin: '0 0 4px', fontWeight: '700', fontSize: '15px', color: '#111827' }}>Portfolio report unavailable</p>
        <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>Run the v2 analysis pipeline to generate the portfolio report.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Section 1: Executive Summary */}
      <SectionCard icon="✦" title="Executive Summary">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
          <div>
            <p style={{ margin: '0 0 3px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Project Title</p>
            <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#111827', letterSpacing: '-0.2px' }}>{projectTitle}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {engLevel && (
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Engineering Level</p>
                <span style={{ padding: '4px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: '700', display: 'inline-block', ...seniorityBadgeStyle(engLevel) }}>
                  {engLevel.charAt(0).toUpperCase() + engLevel.slice(1)}-level
                </span>
              </div>
            )}
            {projMaturity && (() => {
              const s = maturityBadgeStyle(projMaturity)
              return (
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Project Maturity</p>
                  <span style={{ padding: '4px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: '700', display: 'inline-block', backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                    {projMaturity.charAt(0).toUpperCase() + projMaturity.slice(1)}
                  </span>
                </div>
              )
            })()}
          </div>
        </div>
        {repoPurpose && (
          <div style={{ marginTop: '14px', padding: '12px 16px', backgroundColor: '#f8faff', borderRadius: '8px', borderLeft: '3px solid #6366f1' }}>
            <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Repository Purpose</p>
            <p style={{ margin: 0, fontSize: '13px', color: '#374151', lineHeight: '1.65' }}>{repoPurpose}</p>
          </div>
        )}
      </SectionCard>

      {/* Section 2: Resume Highlights */}
      <SectionCard icon="📄" title="Resume Highlights">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {resumeBullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ color: '#6366f1', flexShrink: 0, fontWeight: '700', marginTop: '2px', fontSize: '11px' }}>▸</span>
              <span style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>{b}</span>
            </div>
          ))}
        </div>
        {intelligence?.resume?.technologiesLine && (
          <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#6b7280', fontStyle: 'italic', paddingTop: '10px', borderTop: '1px solid #f3f4f6' }}>
            {intelligence.resume.technologiesLine}
          </p>
        )}
      </SectionCard>

      {/* Section 3: Engineering Skills */}
      <SectionCard icon="⟨/⟩" title="Engineering Skills">
        {skillGroups.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {skillGroups.map(group => (
              <div key={group.name}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px' }}>{group.icon}</span>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{group.name}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {group.items.map((item, i) => (
                    <span key={i} style={{ padding: '3px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', backgroundColor: group.style.bg, color: group.style.color, border: `1px solid ${group.style.border}` }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>Run the analysis pipeline to detect engineering skills.</p>
        )}
      </SectionCard>

      {/* Section 4: Business Value */}
      <SectionCard icon="💼" title="Business Value">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {hasBizValue && bizValue.targetUsers && (
            <div style={{ padding: '10px 14px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              <p style={{ margin: '0 0 3px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Target Users</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#1e40af', fontWeight: '600' }}>{bizValue.targetUsers}</p>
            </div>
          )}
          {bizProps.map((v, i) => (
            <div key={i} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', padding: '9px 13px', borderRadius: '8px', backgroundColor: '#f0fdf4', border: '1px solid #86efac' }}>
              <span style={{ color: '#16a34a', flexShrink: 0, fontWeight: '700', fontSize: '13px' }}>◆</span>
              <span style={{ fontSize: '13px', color: '#374151', lineHeight: '1.55' }}>{v}</span>
            </div>
          ))}
          {hasBizValue && bizValue.scalabilityNotes && (
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>{bizValue.scalabilityNotes}</p>
          )}
        </div>
      </SectionCard>

      {/* Section 5: Portfolio Assets */}
      {(() => {
        const assets = generatePortfolioAssets(repo, intelligence, inference, codeIntelligence)

        const assetBlocks = [
          {
            id: 'A',
            label: 'Resume Bullets',
            desc: '5 ATS-friendly bullets',
            copyText: assets.resumeBulletsText,
            content: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {assets.resumeBullets.map((b, i) => (
                  <div key={i} style={{ display: 'flex', gap: '7px', fontSize: '13px', color: '#374151', lineHeight: '1.55' }}>
                    <span style={{ color: '#6366f1', flexShrink: 0, fontWeight: '700' }}>•</span>
                    <span>{b.replace(/^•\s*/, '')}</span>
                  </div>
                ))}
              </div>
            ),
          },
          {
            id: 'B',
            label: 'Project Description',
            desc: '1-paragraph portfolio description',
            copyText: assets.projectDescription,
            content: (
              <p style={{ margin: 0, fontSize: '13px', color: '#374151', lineHeight: '1.7' }}>{assets.projectDescription}</p>
            ),
          },
          {
            id: 'C',
            label: 'LinkedIn Project Entry',
            desc: 'Ready to paste into LinkedIn Projects',
            copyText: assets.linkedInText,
            content: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '13px', color: '#374151' }}>
                <div>
                  <span style={{ fontWeight: '700', color: '#0a66c2' }}>Project: </span>
                  <span style={{ fontWeight: '600', color: '#111827' }}>{assets.linkedInTitle}</span>
                </div>
                <div style={{ lineHeight: '1.65' }}>
                  <span style={{ fontWeight: '700', color: '#0a66c2' }}>Description: </span>
                  <span>{assets.linkedInDesc}</span>
                </div>
                {assets.linkedInTechs && (
                  <div>
                    <span style={{ fontWeight: '700', color: '#0a66c2' }}>Technologies: </span>
                    <span style={{ color: '#6366f1', fontWeight: '500' }}>{assets.linkedInTechs}</span>
                  </div>
                )}
              </div>
            ),
          },
        ]

        return (
          <div style={{ border: '1px solid #e0e7ff', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'white' }}>
            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 20px', borderBottom: '1px solid #e0e7ff', background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)' }}>
              <span style={{ fontSize: '18px' }}>📦</span>
              <div>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: '#111827' }}>Portfolio Assets</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Export-ready content — click Copy on any block to copy to clipboard</p>
              </div>
            </div>

            {/* Asset blocks */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '0' }}>
              {assetBlocks.map((block, idx) => (
                <div key={block.id}>
                  {/* Block header row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: '6px',
                        backgroundColor: '#6366f1', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: '800', flexShrink: 0,
                      }}>
                        {block.id}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>{block.label}</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{block.desc}</span>
                    </div>
                    <CopyButton text={block.copyText} />
                  </div>

                  {/* Block content box */}
                  <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {block.content}
                  </div>

                  {/* Divider between blocks */}
                  {idx < assetBlocks.length - 1 && (
                    <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '16px 0' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
// ── Architecture tab helpers ─────────────────────────────────────────────────

const ARCH_PATTERN_TO_SKILL = {
  rest_api: 'REST API Design', enterprise_rest_api: 'REST API Design', rest_routing: 'REST API Design',
  graphql_api: 'GraphQL API Design', type_safe_api: 'Type-Safe API Development',
  orm: 'ORM Data Access', document_database_odm: 'ORM Data Access',
  relational_database: 'Relational Database Design',
  document_database: 'NoSQL Data Modeling', nosql_database: 'NoSQL Data Modeling',
  cache_store: 'Caching Strategy', search_database: 'Search Infrastructure',
  query_builder: 'Database Query Design',
  vector_database: 'Vector Database Management', vector_embeddings: 'Embedding Pipeline Design',
  stateless_auth: 'Authentication Design', session_based_auth: 'Authentication Design',
  hosted_auth_provider: 'Authentication Design', strategy_based_auth: 'Authentication Design',
  provider_based_auth: 'Authentication Design', custom_auth_middleware: 'Authentication Design',
  cicd_pipeline: 'CI/CD Configuration',
  containerization: 'Container-Based Deployment', container_orchestration: 'Container Orchestration',
  infrastructure_as_code: 'Infrastructure as Code',
  llm_integration: 'LLM Integration', llm_orchestration: 'AI Workflow Design',
  rag_framework: 'Retrieval-Augmented Generation',
  component_ui: 'Component-Based UI', global_state_management: 'State Management',
  ssr_framework: 'Server-Side Rendering', payment_processing: 'Payment Integration',
}

const INFERRED_TO_SKILL = {
  fullstack_architecture_confirmed: 'Full-Stack Architecture',
  enterprise_backend_patterns:      'Enterprise Backend Patterns',
  strong_domain_separation:         'Domain Separation',
  scalable_service_architecture:    'Scalable Service Design',
  production_ready_backend:         'Production-Grade Backend',
  authentication_layer_present:     'Authentication Design',
  retrieval_augmented_architecture:  'Retrieval-Augmented Generation',
  ai_orchestrated_system:           'AI Workflow Design',
  ai_integration_confirmed:         'LLM Integration',
}

function deriveArchitectureSkills(intelligence, inference, codeIntelligence) {
  const skills = new Set()
  for (const p of (codeIntelligence?.architecturePatterns ?? []))
    if (ARCH_PATTERN_TO_SKILL[p]) skills.add(ARCH_PATTERN_TO_SKILL[p])
  for (const p of (inference?.patternsInferred ?? []))
    if (INFERRED_TO_SKILL[p]) skills.add(INFERRED_TO_SKILL[p])
  if (intelligence?.strengths?.testingPresent)
    skills.add('Test-Driven Development')
  if ((intelligence?.architecture?.layers?.length ?? 0) >= 2)
    skills.add('Layered Architecture')
  if ((intelligence?.architecture?.decisions?.length ?? 0) > 0)
    skills.add('Architectural Decision-Making')
  const total = (codeIntelligence?.architecturePatterns?.length ?? 0) + (inference?.patternsInferred?.length ?? 0)
  if (total >= 6) skills.add('Complex System Design')
  return [...skills]
}

function computeArchitectureComplexity(intelligence, inference, codeIntelligence) {
  const archPats     = codeIntelligence?.architecturePatterns ?? []
  const infPats      = inference?.patternsInferred ?? []
  const technologies = [...(codeIntelligence?.technologies ?? []), ...(codeIntelligence?.frameworks ?? [])]
  let score = 0
  const reasons = []

  const numLayers = codeIntelligence?.detectedDomains?.length ?? intelligence?.architecture?.layers?.length ?? 0
  if (numLayers >= 3) { score += 2; reasons.push(`${numLayers}-layer architecture detected`) }
  else if (numLayers >= 2) { score += 1; reasons.push('Multi-layer architecture structure') }

  if (infPats.includes('ai_orchestrated_system')) { score += 2; reasons.push('AI orchestration workflow implemented') }
  else if (infPats.includes('ai_integration_confirmed')) { score += 1; reasons.push('AI/ML library integration') }

  if (infPats.includes('retrieval_augmented_architecture')) { score += 2; reasons.push('RAG pipeline with vector retrieval') }

  const hasDb = archPats.some(p => ['relational_database','document_database','nosql_database','vector_database','orm'].includes(p))
             || technologies.some(t => ['postgresql','mysql','mongodb','prisma','sequelize','mongoose'].includes(t))
  if (hasDb) { score += 1; reasons.push('Database abstraction layer') }

  if (infPats.includes('strong_domain_separation') || infPats.includes('enterprise_backend_patterns')) {
    score += 2; reasons.push('Separation of concerns applied')
  }
  if (intelligence?.strengths?.testingPresent) { score += 1; reasons.push('Automated test coverage present') }
  if (archPats.some(p => ['stateless_auth','session_based_auth','hosted_auth_provider'].includes(p)) || infPats.includes('authentication_layer_present')) {
    score += 1; reasons.push('Authentication and security layer')
  }
  if (archPats.includes('cicd_pipeline'))    { score += 1; reasons.push('CI/CD pipeline configuration') }
  if (archPats.includes('containerization')) { score += 1; reasons.push('Containerized deployment') }
  if (infPats.includes('fullstack_architecture_confirmed')) { score += 1; reasons.push('Full-stack architecture breadth') }

  return { level: score >= 7 ? 'Advanced' : score >= 4 ? 'Intermediate' : 'Beginner', score, reasons }
}

function generateArchitectureTalkingPoints(intelligence, inference, codeIntelligence) {
  const pool     = []
  const archPats = codeIntelligence?.architecturePatterns ?? []
  const infPats  = inference?.patternsInferred ?? []
  const technologies = [...(codeIntelligence?.technologies ?? []), ...(codeIntelligence?.frameworks ?? [])]
  const fmt = arr => [...new Set(arr)].map(t => CI_TECH_LABELS[t] || t).slice(0, 2).join(' and ')

  const apiTechs = technologies.filter(t => ['express','fastify','nestjs','trpc','koa','hono'].includes(t))
  const dbTechs  = technologies.filter(t => ['postgresql','mysql','mongodb','prisma','sequelize','mongoose','redis'].includes(t))
  const aiTechs  = technologies.filter(t => ['openai','anthropic','langchain','llamaindex','groq'].includes(t))
  const feTechs  = technologies.filter(t => ['react','nextjs','vue','angular','svelte'].includes(t))

  if (archPats.some(p => ['rest_api','graphql_api','enterprise_rest_api'].includes(p)) || apiTechs.length > 0)
    pool.push(`Explain how requests flow from the ${archPats.includes('graphql_api') ? 'GraphQL' : 'REST'} API layer to the database${dbTechs.length ? ', including the ' + fmt(dbTechs) + ' integration' : ''}`)
  if (apiTechs.length > 0)
    pool.push(`Explain why ${fmt(apiTechs)} was chosen and what trade-offs it involves`)
  if (aiTechs.length > 0 || infPats.includes('ai_orchestrated_system'))
    pool.push(`Describe how AI is orchestrated${aiTechs.length ? ' with ' + fmt(aiTechs) : ''} and what problem it solves in this project`)
  if (infPats.includes('retrieval_augmented_architecture'))
    pool.push('Explain the RAG pipeline — how content is embedded, indexed, and retrieved to improve AI responses')
  if (infPats.includes('authentication_layer_present') || archPats.some(p => ['stateless_auth','session_based_auth'].includes(p)))
    pool.push('Walk through the authentication flow and explain the security decisions made')
  if (infPats.includes('fullstack_architecture_confirmed') && feTechs.length > 0)
    pool.push(`Describe how ${fmt(feTechs)} communicates with the backend and how state is managed`)
  if (infPats.includes('strong_domain_separation') || infPats.includes('enterprise_backend_patterns'))
    pool.push('Explain how business logic is separated from infrastructure concerns and why this matters for maintainability')
  if (archPats.includes('cicd_pipeline'))
    pool.push('Walk through the CI/CD pipeline — what happens automatically when code is pushed')
  if (dbTechs.length > 0)
    pool.push(`Discuss your data modeling decisions and persistence strategy with ${fmt(dbTechs)}`)
  pool.push('Discuss one scaling consideration for the current architecture and how you would address it')

  return [...new Set(pool)].slice(0, 6)
}

function deriveAIEngineeringSkills(intelligence, inference, codeIntelligence) {
  const aiMaturity = intelligence?.aiCapabilities?.aiMaturityLevel ?? 'none'
  if (aiMaturity === 'none') return null

  const skills   = new Set()
  const archPats = codeIntelligence?.architecturePatterns ?? []
  const infPats  = inference?.patternsInferred ?? []
  const technologies = [...(codeIntelligence?.technologies ?? []), ...(codeIntelligence?.frameworks ?? [])]

  if (technologies.some(t => ['openai','anthropic','groq','mistral','cohere'].includes(t)) || infPats.includes('ai_integration_confirmed'))
    skills.add('LLM Integration')
  if (technologies.some(t => ['langchain','llamaindex','vercel-ai-sdk'].includes(t)) || infPats.includes('ai_orchestrated_system'))
    skills.add('Prompt Engineering')
  if (infPats.includes('ai_orchestrated_system'))
    skills.add('AI Workflow Design')
  if (infPats.includes('retrieval_augmented_architecture') || archPats.includes('rag_framework'))
    skills.add('Retrieval-Augmented Generation')
  if (archPats.includes('vector_embeddings') || technologies.some(t => ['embeddings','pinecone','weaviate','chromadb'].includes(t)))
    skills.add('Embedding Pipelines')
  if (technologies.some(t => ['pinecone','weaviate','chromadb'].includes(t)) || infPats.includes('retrieval_augmented_architecture'))
    skills.add('Semantic Search')

  const levelMap = {
    basic_integration: { level: 'Intermediate', desc: 'AI/ML libraries integrated into application workflows' },
    orchestrated_ai:   { level: 'Advanced',     desc: 'Multi-step AI workflows with prompt orchestration and chaining' },
    production_ai:     { level: 'Expert',        desc: 'Production-grade AI system with retrieval pipelines and orchestration' },
  }
  return { skills: [...skills], levelInfo: levelMap[aiMaturity] ?? null }
}

// ── Job Readiness Gap Analysis helpers ────────────────────────────────────────

const SIGNAL_WEIGHTS = {
  backend_api: 15, database: 12, architecture: 14, testing: 12,
  authentication: 10, deployment: 10, cicd: 9, monitoring: 7, documentation: 7,
}

const IMPROVEMENT_DEFS = {
  backend_api:    { title: 'Build a RESTful API service layer',               impact: 9, priority: 'Critical', signalId: 'backend_api'    },
  database:       { title: 'Add a structured database layer',                 impact: 8, priority: 'High',     signalId: 'database'       },
  architecture:   { title: 'Refactor toward layered architecture patterns',   impact: 8, priority: 'High',     signalId: 'architecture'   },
  testing:        { title: 'Implement automated test suite (Jest / Vitest)',  impact: 9, priority: 'Critical', signalId: 'testing'        },
  authentication: { title: 'Implement JWT or OAuth authentication layer',     impact: 8, priority: 'High',     signalId: 'authentication' },
  deployment:     { title: 'Add Docker containerization and deployment config',impact: 8, priority: 'High',    signalId: 'deployment'     },
  cicd:           { title: 'Configure GitHub Actions CI/CD pipeline',         impact: 9, priority: 'Critical', signalId: 'cicd'           },
  monitoring:     { title: 'Add Sentry or structured logging for observability',impact: 6, priority: 'Medium', signalId: 'monitoring'     },
  documentation:  { title: 'Add Swagger / OpenAPI docs and README guide',     impact: 5, priority: 'Medium',   signalId: 'documentation'  },
}

function computeHiringSignals(intelligence, inference, codeIntelligence) {
  const archPats     = codeIntelligence?.architecturePatterns ?? []
  const infPats      = inference?.patternsInferred ?? []
  const technologies = [...(codeIntelligence?.technologies ?? []), ...(codeIntelligence?.frameworks ?? [])]
  return [
    {
      id: 'backend_api', label: 'Backend API',
      present: technologies.some(t => ['express','fastify','nestjs','trpc','koa','hono'].includes(t))
            || archPats.some(p => ['rest_api','graphql_api','enterprise_rest_api','rest_routing'].includes(p)),
      portfolioNote: 'Backend API development is a core engineering skill that demonstrates server-side capability and system design thinking',
    },
    {
      id: 'database', label: 'Database Design',
      present: technologies.some(t => ['postgresql','mysql','mongodb','redis','elasticsearch','dynamodb','prisma','drizzle','mongoose','sequelize','typeorm','knex'].includes(t))
            || archPats.some(p => ['relational_database','document_database','document_database_odm','orm'].includes(p)),
      portfolioNote: 'Database design shows data modeling skills and the ability to build persistent, data-driven applications',
    },
    {
      id: 'architecture', label: 'Architecture',
      present: archPats.length >= 3
            || infPats.some(p => ['fullstack_architecture_confirmed','enterprise_backend_patterns','strong_domain_separation'].includes(p)),
      portfolioNote: 'Architecture awareness shows you understand how systems scale and how to organize complex, maintainable codebases',
    },
    {
      id: 'testing', label: 'Testing',
      present: !!intelligence?.strengths?.testingPresent
            || technologies.some(t => ['jest','vitest','mocha','cypress','playwright','supertest','chai'].includes(t)),
      portfolioNote: 'Automated testing demonstrates professional-grade code quality and confidence in your own implementations',
    },
    {
      id: 'authentication', label: 'Authentication',
      present: infPats.includes('authentication_layer_present')
            || archPats.some(p => ['stateless_auth','session_based_auth','hosted_auth_provider','strategy_based_auth'].includes(p))
            || technologies.some(t => ['jwt','passport','next-auth','clerk','firebase-auth','better-auth','lucia'].includes(t)),
      portfolioNote: 'Authentication demonstrates security engineering skills and production-ready application design',
    },
    {
      id: 'deployment', label: 'Deployment',
      present: archPats.some(p => ['containerization','infrastructure_as_code'].includes(p))
            || technologies.some(t => ['docker','kubernetes'].includes(t))
            || (inference?.overallAssessment?.deploymentReadiness ?? 'none') !== 'none',
      portfolioNote: 'Deployment configuration shows you can ship a complete, working application beyond local development',
    },
    {
      id: 'cicd', label: 'CI/CD',
      present: archPats.includes('cicd_pipeline')
            || technologies.some(t => ['github-actions','circleci','travis'].includes(t)),
      portfolioNote: 'CI/CD demonstrates professional development workflow and production-quality engineering discipline',
    },
    {
      id: 'monitoring', label: 'Monitoring',
      present: technologies.some(t => ['datadog','sentry','newrelic','prometheus','pino','winston'].includes(t)),
      portfolioNote: 'Monitoring and logging shows production awareness and engineering maturity beyond basic functionality',
    },
    {
      id: 'documentation', label: 'Documentation',
      present: technologies.some(t => ['swagger','openapi'].includes(t))
            || !!(intelligence?.executiveSummary?.overview && (intelligence?.summary?.filesInTree ?? 0) > 0),
      portfolioNote: 'Documentation demonstrates communication skills and the ability to collaborate effectively on engineering teams',
    },
  ]
}

function computePlacementReadiness(signals, inference) {
  const base    = signals.reduce((acc, s) => acc + (s.present ? (SIGNAL_WEIGHTS[s.id] ?? 8) : 0), 0)
  const infPats = inference?.patternsInferred ?? []
  const bonus   = (infPats.includes('enterprise_backend_patterns') ? 3 : 0)
                + (infPats.includes('production_ready_backend')    ? 3 : 0)
                + (inference?.overallAssessment?.engineeringLevel === 'senior' ? 4 : 0)
  return Math.min(100, base + bonus)
}

function generateImprovementRoadmap(signals, inference) {
  const pool    = signals.filter(s => !s.present && IMPROVEMENT_DEFS[s.id]).map(s => IMPROVEMENT_DEFS[s.id])
  const infPats = inference?.patternsInferred ?? []
  if (pool.length < 3) {
    if (!infPats.includes('enterprise_backend_patterns'))
      pool.push({ title: 'Apply domain-driven design patterns',           impact: 7, priority: 'Medium', signalId: null })
    pool.push(   { title: 'Add end-to-end integration tests',             impact: 5, priority: 'Low',    signalId: null })
    pool.push(   { title: 'Add API performance and load-test benchmarks', impact: 4, priority: 'Low',    signalId: null })
  }
  return [...new Map(pool.map(i => [i.title, i])).values()].slice(0, 5)
}

function generateInterviewTopics(intelligence, inference, codeIntelligence) {
  const topics       = []
  const archPats     = codeIntelligence?.architecturePatterns ?? []
  const infPats      = inference?.patternsInferred ?? []
  const technologies = [...(codeIntelligence?.technologies ?? []), ...(codeIntelligence?.frameworks ?? [])]
  const label        = t => CI_TECH_LABELS[t] || t
  const fmt          = arr => [...new Set(arr)].map(label).slice(0, 2).join(' and ')

  const apiTechs = technologies.filter(t => ['express','fastify','nestjs','trpc','koa','hono'].includes(t))
  const aiTechs  = technologies.filter(t => ['openai','anthropic','langchain','llamaindex','groq'].includes(t))
  const dbTechs  = technologies.filter(t => ['postgresql','mysql','mongodb','prisma','sequelize','mongoose'].includes(t))
  const feTechs  = technologies.filter(t => ['react','nextjs','vue','angular','svelte'].includes(t))

  if (archPats.some(p => ['rest_api','graphql_api','enterprise_rest_api'].includes(p)) || apiTechs.length > 0)
    topics.push({
      topic: 'API Design & REST Principles',
      why: 'You built the server-side of this project — be ready to walk through your design decisions',
      points: [
        'Route structure and organization',
        'Middleware design and request flow',
        'Error handling and response formats',
        apiTechs.length > 0 ? `Why you chose ${fmt(apiTechs)} for this project` : 'API framework selection trade-offs',
      ],
    })

  if (aiTechs.length > 0 || infPats.includes('ai_orchestrated_system'))
    topics.push({
      topic: 'AI Integration & LLM Orchestration',
      why: 'You integrated AI into this project — be ready to explain your approach end-to-end',
      points: [
        aiTechs.length > 0 ? `${fmt(aiTechs)} integration and API usage` : 'AI model integration',
        'Prompt design and engineering decisions',
        infPats.includes('ai_orchestrated_system') ? 'AI workflow and orchestration design' : 'How AI fits into the application flow',
        'Why AI was chosen for this specific use case',
      ],
    })

  if (infPats.includes('retrieval_augmented_architecture'))
    topics.push({
      topic: 'Vector Search & RAG Architecture',
      why: 'RAG is an advanced pattern that shows deep system design understanding',
      points: [
        'Embedding strategy and model choice',
        'Vector database design and indexing approach',
        'Retrieval pipeline and similarity search logic',
        'Why RAG over direct prompting for this use case',
      ],
    })

  if (dbTechs.length > 0)
    topics.push({
      topic: 'Database Design & Data Modeling',
      why: 'You made persistence decisions — be prepared to justify your schema and query approach',
      points: [
        `${fmt(dbTechs)} usage and configuration`,
        'Schema design and data modeling decisions',
        'Query optimization and indexing approach',
        archPats.some(p => ['orm','document_database_odm'].includes(p)) ? 'ORM usage trade-offs vs raw queries' : 'Database access patterns',
      ],
    })

  if (infPats.includes('fullstack_architecture_confirmed'))
    topics.push({
      topic: 'Full-Stack Architecture Trade-offs',
      why: 'You built both frontend and backend — be ready to discuss how they integrate',
      points: [
        feTechs.length > 0 ? `${fmt(feTechs)} component and state design` : 'Frontend architecture decisions',
        'Frontend/backend communication and API contract design',
        'State management approach and trade-offs',
        'How you handled data consistency across layers',
      ],
    })

  if (archPats.includes('cicd_pipeline'))
    topics.push({
      topic: 'CI/CD & Deployment Strategy',
      why: 'You configured automated delivery — explain the pipeline you built and why',
      points: [
        'Pipeline stages and what triggers each step',
        'Automated test execution in the pipeline',
        'Deployment target and environment configuration',
        'Failure handling and rollback strategy',
      ],
    })

  if (archPats.length >= 5 || infPats.includes('enterprise_backend_patterns'))
    topics.push({
      topic: 'System Design & Scalability',
      why: 'Your architecture shows real complexity — be ready to discuss design decisions',
      points: [
        'How the architecture handles increased load',
        'Bottlenecks you anticipate and how you would address them',
        'Domain separation and module organization decisions',
        'What you would change if building it again at scale',
      ],
    })

  if (!infPats.includes('authentication_layer_present'))
    topics.push({
      topic: 'Authentication & Security',
      why: 'Auth is not detected in this project — prepare how you would add it',
      points: [
        'How you would implement user authentication for this app',
        'JWT vs session-based auth trade-offs',
        'Route protection and authorization strategy',
        'Security considerations specific to your stack',
      ],
    })

  if (!intelligence?.strengths?.testingPresent)
    topics.push({
      topic: 'Testing Strategy',
      why: 'No tests detected — prepare your testing philosophy and what you would write first',
      points: [
        'What tests you would prioritize adding first',
        'Unit vs integration vs end-to-end testing decisions',
        'Testing framework choice and rationale',
        'How you would test async or AI-dependent behavior',
      ],
    })

  topics.push({
    topic: 'Stack Decisions & Lessons Learned',
    why: 'Every technology choice is a design decision you should be able to own and defend',
    points: [
      'Why you chose this specific stack for this project',
      'What you would do differently if starting over',
      'Key technical lessons from building this',
      'How you would scale or extend this project next',
    ],
  })

  return [...new Map(topics.map(t => [t.topic, t])).values()].slice(0, 7)
}

// ── Portfolio narrative text ──────────────────────────────────────────────────

function generatePortfolioNarrativeText(inference, codeIntelligence, missingSignals) {
  const assessment = inference?.overallAssessment ?? {}
  const patterns   = inference?.patternsInferred  ?? []
  const strength   = assessment.portfolioStrength ?? null
  const engLevel   = assessment.engineeringLevel  ?? null

  const strengthPhrases = {
    strong:    'strong engineering foundations',
    developing:'solid development skills',
    emerging:  'foundational engineering skills',
    minimal:   'early-stage development experience',
  }
  const levelPhrases = {
    senior: 'advanced-level',
    mid:    'professional-level',
    junior: 'foundational',
  }

  const highlights = []
  if (patterns.includes('fullstack_architecture_confirmed'))          highlights.push('full-stack development')
  if (patterns.includes('ai_orchestrated_system') || patterns.includes('ai_integration_confirmed')) highlights.push('AI integration')
  if (patterns.includes('enterprise_backend_patterns') || patterns.includes('production_ready_backend')) highlights.push('production-ready backend engineering')
  if (patterns.includes('retrieval_augmented_architecture'))          highlights.push('RAG architecture')
  if (patterns.includes('authentication_layer_present'))              highlights.push('secure application design')
  if (highlights.length === 0) highlights.push('software development skills')

  const gaps = missingSignals.slice(0, 2).map(s => s.label.toLowerCase())

  let text = `This project demonstrates ${strengthPhrases[strength] || 'software development skills'}`
  if (engLevel && levelPhrases[engLevel]) text += ` at a ${levelPhrases[engLevel]} complexity level`
  const joined = highlights.length === 1 ? highlights[0]
    : highlights.slice(0, -1).join(', ') + ' and ' + highlights[highlights.length - 1]
  text += `, with clear portfolio signals in ${joined}`
  text += gaps.length > 0
    ? `. Adding ${gaps.join(' and ')} would significantly strengthen the portfolio impact.`
    : '.'

  return text
}

// ── JobReadinessGapAnalysis ───────────────────────────────────────────────────

function JobReadinessGapAnalysis({ intelligence, inference, codeIntelligence }) {
  if (!intelligence && !inference && !codeIntelligence) {
    return (
      <div style={{ textAlign: 'center', padding: '56px 24px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
        <p style={{ fontSize: '32px', margin: '0 0 8px' }}>✦</p>
        <p style={{ margin: '0 0 4px', fontWeight: '700', fontSize: '15px', color: '#111827' }}>Gap analysis pending</p>
        <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>Requires pipeline phases 5 and 6 to complete.</p>
      </div>
    )
  }

  const signals        = computeHiringSignals(intelligence, inference, codeIntelligence)
  const readiness      = computePlacementReadiness(signals, inference)
  const roadmap        = generateImprovementRoadmap(signals, inference)
  const topics         = generateInterviewTopics(intelligence, inference, codeIntelligence)
  const missingSignals = signals.filter(s => !s.present)
  const presentCount   = signals.filter(s => s.present).length

  const projectedGain      = roadmap.reduce((acc, r) => acc + (r.signalId ? (SIGNAL_WEIGHTS[r.signalId] ?? 5) : 2), 0)
  const projectedReadiness = Math.min(100, readiness + projectedGain)

  const readinessColor = r => r >= 80 ? '#16a34a' : r >= 60 ? '#0891b2' : r >= 40 ? '#d97706' : '#dc2626'
  const readinessLabel = r => r >= 80 ? 'Interview Ready' : r >= 60 ? 'Nearly Ready' : r >= 40 ? 'Needs Work' : 'Not Ready'

  const priorityStyle = p =>
    p === 'Critical' ? { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' } :
    p === 'High'     ? { bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' } :
    p === 'Medium'   ? { bg: '#fef9c3', color: '#854d0e', border: '#fde047' } :
                       { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' }

  const topicTypeStyle = t =>
    t === 'Technical'    ? { bg: '#eef2ff', color: '#4338ca', border: '#a5b4fc' } :
    t === 'System Design'? { bg: '#f5f3ff', color: '#6d28d9', border: '#c4b5fd' } :
    t === 'Operational'  ? { bg: '#ecfdf5', color: '#065f46', border: '#6ee7b7' } :
    t === 'Gap'          ? { bg: '#fef9c3', color: '#854d0e', border: '#fde047' } :
                           { bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' }

  const engLevel = inference?.overallAssessment?.engineeringLevel ?? null
  const engConf  = EID_ENG_CONFIG[engLevel] ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Dashboard header ── */}
      <div style={{ padding: '16px 22px', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #3b0764 100%)', borderRadius: '14px' }}>
        <p style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'white', letterSpacing: '-0.3px' }}>Portfolio Readiness Analysis</p>
        <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#a5b4fc' }}>What does this project demonstrate about you as a developer?</p>
      </div>

      {/* ── 1. Placement Readiness Score ── */}
      <SectionCard icon="◎" title="Placement Readiness">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
          <EIDKPICard
            label="Readiness Score"
            value={`${readiness}%`}
            sub={readinessLabel(readiness)}
            color={readinessColor(readiness)}
            accent={readinessColor(readiness)}
          />
          <EIDKPICard
            label="Signals Present"
            value={`${presentCount} / ${signals.length}`}
            sub={`${missingSignals.length} gaps detected`}
            color={presentCount >= 7 ? '#16a34a' : presentCount >= 5 ? '#0891b2' : '#d97706'}
            accent="#6366f1"
          />
          {engConf && (
            <EIDKPICard
              label="Engineering Level"
              value={engConf.label}
              sub={engLevel === 'senior' ? 'Advanced' : engLevel === 'mid' ? 'Professional' : 'Foundation'}
              color={engConf.color}
              accent={engConf.accent}
            />
          )}
          {inference?.overallAssessment?.deploymentReadiness && (
            <EIDKPICard
              label="Deployment"
              value={(EID_DEPLOY_CONFIG[inference.overallAssessment.deploymentReadiness] ?? EID_DEPLOY_CONFIG.none).label}
              sub={(EID_DEPLOY_CONFIG[inference.overallAssessment.deploymentReadiness] ?? EID_DEPLOY_CONFIG.none).pct >= 60 ? 'Configured' : 'Not configured'}
              color={(EID_DEPLOY_CONFIG[inference.overallAssessment.deploymentReadiness] ?? EID_DEPLOY_CONFIG.none).color}
              accent={(EID_DEPLOY_CONFIG[inference.overallAssessment.deploymentReadiness] ?? EID_DEPLOY_CONFIG.none).color}
            />
          )}
        </div>

        {/* Readiness Projection bar */}
        <div style={{ backgroundColor: '#f8fafc', borderRadius: '10px', padding: '14px 16px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Readiness Projection</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: 'Current Readiness', value: readiness, color: readinessColor(readiness) },
              { label: 'Projected After Improvements', value: projectedReadiness, color: readinessColor(projectedReadiness) },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>{label}</span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color }}>{value}%</span>
                </div>
                <div style={{ height: '8px', borderRadius: '4px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${value}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, borderRadius: '4px', transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── 2. Portfolio Signal Checklist ── */}
      <SectionCard icon="✓" title="Portfolio Signal Checklist">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {signals.map(s => (
            <div
              key={s.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 12px', borderRadius: '9px',
                backgroundColor: s.present ? '#f0fdf4' : '#fafafa',
                border: `1px solid ${s.present ? '#86efac' : '#e5e7eb'}`,
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: '800', color: s.present ? '#16a34a' : '#d1d5db', flexShrink: 0 }}>
                {s.present ? '✓' : '✗'}
              </span>
              <span style={{ fontSize: '12px', fontWeight: '600', color: s.present ? '#166534' : '#9ca3af' }}>{s.label}</span>
            </div>
          ))}
        </div>
        <style>{`@media (max-width: 580px) { .jrga-signals { grid-template-columns: repeat(2,1fr) !important; } }`}</style>
      </SectionCard>

      {/* ── 3. Portfolio Readiness Gaps ── */}
      {missingSignals.length > 0 && (
        <SectionCard icon="⚠" title="Portfolio Readiness Gaps">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {missingSignals.map(s => (
              <div key={s.id} style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: '#fffbeb', border: '1px solid #fcd34d' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#d97706', fontWeight: '800' }}>⚠</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>{s.label} not detected</span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#78350f', lineHeight: '1.55' }}>
                  <strong style={{ color: '#92400e' }}>Portfolio impact: </strong>{s.portfolioNote}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── 4. Portfolio Impact Analysis ── */}
      {(inference || presentCount > 0) && (
        <SectionCard icon="◆" title="Portfolio Impact Analysis">

          {/* Strength score row */}
          {inference && (() => {
            const strength = inference.overallAssessment?.portfolioStrength ?? null
            const pct      = Math.round((inference.confidence?.overall ?? 0) * 100)
            const scoreColor = pct >= 72 ? '#16a34a' : pct >= 48 ? '#2563eb' : pct >= 24 ? '#d97706' : '#9ca3af'
            const strengthLabels = { strong: 'Strong', developing: 'Developing', emerging: 'Emerging', minimal: 'Minimal' }
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                <div style={{ textAlign: 'center', minWidth: 60 }}>
                  <p style={{ margin: 0, fontSize: '26px', fontWeight: '900', color: scoreColor, lineHeight: 1 }}>{pct}</p>
                  <p style={{ margin: 0, fontSize: '10px', color: '#9ca3af', fontWeight: '700' }}>/ 100</p>
                </div>
                <div style={{ width: '1px', height: 38, backgroundColor: '#e2e8f0', flexShrink: 0 }} />
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Portfolio Strength Score</p>
                  {strength && (
                    <span style={{ padding: '2px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
                      backgroundColor: pct >= 72 ? '#dcfce7' : pct >= 48 ? '#dbeafe' : pct >= 24 ? '#fef9c3' : '#f3f4f6',
                      color: scoreColor, border: `1px solid ${pct >= 72 ? '#86efac' : pct >= 48 ? '#93c5fd' : pct >= 24 ? '#fde047' : '#d1d5db'}`,
                    }}>{strengthLabels[strength] ?? strength} Portfolio</span>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Strongest signals + Growth opportunities */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>

            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '14px 16px' }}>
              <p style={{ margin: '0 0 9px', fontSize: '11px', fontWeight: '800', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Strongest Signals</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(inference?.strengths?.length > 0
                  ? inference.strengths
                  : signals.filter(s => s.present).map(s => s.label)
                ).slice(0, 5).map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '12px', color: '#166534', lineHeight: '1.45' }}>
                    <span style={{ color: '#16a34a', fontWeight: '700', flexShrink: 0 }}>✓</span>{s}
                  </div>
                ))}
                {(inference?.strengths?.length ?? signals.filter(s => s.present).length) === 0 && (
                  <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>No strong signals detected yet.</p>
                )}
              </div>
            </div>

            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '14px 16px' }}>
              <p style={{ margin: '0 0 9px', fontSize: '11px', fontWeight: '800', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Growth Opportunities</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {missingSignals.slice(0, 5).map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '12px', color: '#92400e', lineHeight: '1.45' }}>
                    <span style={{ color: '#d97706', fontWeight: '700', flexShrink: 0 }}>⚠</span>{s.label}
                  </div>
                ))}
                {missingSignals.length === 0 && (
                  <p style={{ margin: 0, fontSize: '12px', color: '#16a34a', fontWeight: '600' }}>All key signals detected.</p>
                )}
              </div>
            </div>
          </div>

          {/* Primary Portfolio Narrative */}
          <div style={{ padding: '14px 16px', backgroundColor: '#eef2ff', borderRadius: '10px', border: '1px solid #a5b4fc' }}>
            <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '800', color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Primary Portfolio Narrative</p>
            <p style={{ margin: 0, fontSize: '13px', color: '#1e1b4b', lineHeight: '1.65', fontStyle: 'italic' }}>
              "{generatePortfolioNarrativeText(inference, codeIntelligence, missingSignals)}"
            </p>
          </div>

        </SectionCard>
      )}

      {/* ── 5. AI Improvement Roadmap ── */}
      <SectionCard icon="🗺" title="AI Improvement Roadmap">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {roadmap.map(({ title, impact, priority }, i) => {
            const ps = priorityStyle(priority)
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '9px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <span style={{ width: 26, height: 26, borderRadius: '7px', backgroundColor: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', flexShrink: 0 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: '600', color: '#111827', minWidth: 0 }}>{title}</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#6366f1' }}>Impact {impact}/10</span>
                  <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', backgroundColor: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>
                    {priority}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>

      {/* ── 6. Portfolio Talking Points ── */}
      <SectionCard icon="🎯" title="Portfolio Talking Points">
        <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6b7280', lineHeight: '1.55' }}>
          These are the topics you should be prepared to explain when presenting this project.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {topics.map(({ topic, why, points }, i) => (
            <div key={i} style={{ padding: '13px 16px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: '700', color: '#111827' }}>{topic}</p>
              {why && (
                <p style={{ margin: '0 0 9px', fontSize: '12px', color: '#6b7280', lineHeight: '1.5' }}>{why}</p>
              )}
              <p style={{ margin: '0 0 5px', fontSize: '10px', fontWeight: '800', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Be ready to explain:
              </p>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {(points || []).map((pt, j) => (
                  <li key={j} style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>{pt}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

    </div>
  )
}

// ── V2AnalysisDetail ──────────────────────────────────────────────────────────

function V2AnalysisDetail({ repo, analysis, onBack, onLogout, onReanalyzed }) {
  const [reanalyzing,     setReanalyzing]     = useState(false)
  const [reanalyzeError,  setReanalyzeError]  = useState(null)
  const [reanalyzeQueued, setReanalyzeQueued] = useState(false)
  const [activeTab,       setActiveTab]       = useState('overview')
  const [readmeContent,   setReadmeContent]   = useState('')
  const [readmeGenerating, setReadmeGenerating] = useState(false)
  const [readmeError,     setReadmeError]     = useState(null)
  const [mediaInputs,     setMediaInputs]     = useState([{ label: 'Demo', url: '' }])

  async function handleGenerateReadme() {
    setReadmeGenerating(true)
    setReadmeError(null)
    try {
      const mediaUrls = mediaInputs.filter(m => m.url.trim())
      const res  = await authFetch(`${BASE_URL}/api/repos/${repo.id}/generate-readme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaUrls }),
      }, onLogout)
      const json = await res.json()
      if (json?.success) {
        setReadmeContent(json.data.readme)
      } else {
        setReadmeError(json?.error?.message || 'Failed to generate README.')
      }
    } catch (err) {
      setReadmeError(`Could not reach server: ${err.message}`)
    }
    setReadmeGenerating(false)
  }

  const lang       = repo.primary_language || repo.language
  const stars      = (repo.stars_count ?? repo.stargazers_count ?? 0).toLocaleString()
  const forks      = repo.forks_count ?? 0
  const analyzedAt = formatAnalyzedDate(analysis.completedAt)

  const phaseStatus      = analysis.phaseStatus      || {}
  const phaseErrors      = analysis.phaseErrors      || {}
  const phaseMetrics     = analysis.phaseMetrics     || {}
  const intelligence     = analysis.intelligence            // Phase 5 output — null until intelligenceAgents phase completes
  const inference        = analysis.inference        || null  // Phase 6 output — null until inferenceEngine phase completes
  const codeIntelligence = analysis.codeIntelligence || null  // Phase 2 output — available after codeIntelligence completes
  const hasErrors        = Object.keys(phaseErrors).length > 0
  const isActive         = analysis.status === 'queued' || analysis.status === 'running'

  async function handleReanalyze() {
    if (reanalyzing || isActive) return
    setReanalyzing(true)
    setReanalyzeError(null)
    setReanalyzeQueued(false)

    const url = `${BASE_URL}/api/deep-analysis/${repo.id}/reanalyze`
    console.log('[V2AnalysisDetail] handleReanalyze — POST', url, '| repoId:', repo.id)

    let res  = null
    let json = null
    try {
      // Content-Type: application/json is required so express.json() parses req.body.
      // Without it, req.body is undefined and the route throws before the try/catch.
      res  = await authFetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({}),
      }, onLogout)
      console.log('[V2AnalysisDetail] handleReanalyze — status:', res?.status, '| ok:', res?.ok)
      try { json = await res?.json() } catch { json = null }
      console.log('[V2AnalysisDetail] handleReanalyze — body:', json)
    } catch (err) {
      console.error('[V2AnalysisDetail] handleReanalyze — fetch error:', err)
      setReanalyzeError(`Could not reach server: ${err.message}`)
      setReanalyzing(false)
      return
    }

    if (json?.success) {
      setReanalyzeQueued(true)
      setTimeout(() => setReanalyzeQueued(false), 4000)
      onReanalyzed?.()
    } else if (json?.error?.code === 'ANALYSIS_IN_PROGRESS') {
      setReanalyzeError('An analysis is already running for this repository.')
    } else {
      setReanalyzeError(
        json?.error?.message
        || (res ? `Server error (HTTP ${res.status})` : null)
        || 'Failed to start reanalysis.',
      )
    }
    setReanalyzing(false)
  }

  return (
    <div>

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          ← Back to Repositories
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {analyzedAt && <span style={{ fontSize: '13px', color: '#9ca3af' }}>Analyzed {analyzedAt}</span>}
        </div>
      </div>

      {/* Repo header */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', backgroundColor: 'white', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ width: 52, height: 52, borderRadius: '12px', backgroundColor: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6d28d9', fontSize: '20px', flexShrink: 0 }}>
              ▤
            </div>
            <div>
              <a
                href={`https://github.com/${repo.full_name ?? repo.fullName}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontWeight: 'bold', fontSize: '20px', color: '#111827', textDecoration: 'none' }}
              >
                {repo.name}
              </a>
              {repo.description && (
                <p style={{ margin: '4px 0 10px', fontSize: '13px', color: '#6b7280' }}>{repo.description}</p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: '#6b7280', flexWrap: 'wrap' }}>
                {lang && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: langColor(lang), display: 'inline-block', flexShrink: 0 }} />
                    {lang}
                  </span>
                )}
                <span>⭐ {stars}</span>
                {forks > 0 && <span>🍴 {forks.toLocaleString()}</span>}
              </div>
            </div>
          </div>
          {/* Header actions: status + reanalyze */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0, marginLeft: '16px' }}>
            {statusBadge(analysis.status)}
            <button
              onClick={handleReanalyze}
              disabled={reanalyzing || isActive}
              style={{
                padding: '5px 13px', borderRadius: '8px',
                border: `1px solid ${reanalyzeQueued ? '#86efac' : (reanalyzing || isActive) ? '#d1d5db' : '#c4b5fd'}`,
                backgroundColor: reanalyzeQueued ? '#f0fdf4' : (reanalyzing || isActive) ? '#f3f4f6' : '#faf5ff',
                color: reanalyzeQueued ? '#166534' : (reanalyzing || isActive) ? '#9ca3af' : '#7c3aed',
                fontWeight: '600', fontSize: '12px',
                cursor: (reanalyzing || isActive) ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >
              {reanalyzing ? 'Starting…' : reanalyzeQueued ? '✓ Queued' : isActive ? '⟳ Running…' : '↺ Reanalyze'}
            </button>
            {reanalyzeError && (
              <p style={{ margin: 0, fontSize: '11px', color: '#dc2626', textAlign: 'right', maxWidth: '160px' }}>{reanalyzeError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Active indicator */}
      {isActive && (
        <div style={{ padding: '12px 16px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '16px' }}>⟳</span>
          <span style={{ fontSize: '13px', color: '#1e40af', fontWeight: '600' }}>
            Analysis {analysis.status === 'queued' ? 'queued' : 'running'} — results will appear automatically.
          </span>
        </div>
      )}

      {/* ── Tab navigation ── */}
      <style>{`
        .aw-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .aw-grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
        .aw-grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
        @media (max-width: 640px) {
          .aw-grid-2, .aw-grid-3, .aw-grid-4 { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '4px', overflowX: 'auto' }}>
        {[
          { id: 'overview',          label: 'Overview',          icon: '◎' },
          { id: 'architecture',      label: 'Architecture',      icon: '🏛' },
          { id: 'quality',           label: 'Quality',           icon: '✦' },
          { id: 'portfolio-report',  label: 'Portfolio Report',  icon: '📋' },
          { id: 'readme',            label: 'README',            icon: '📝' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: '1 0 auto', padding: '9px 14px', borderRadius: '8px', border: 'none',
              fontSize: '13px', fontWeight: activeTab === tab.id ? '700' : '500',
              color: activeTab === tab.id ? 'white' : '#6b7280',
              backgroundColor: activeTab === tab.id ? '#4f46e5' : 'transparent',
              cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: '13px' }}>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════
          OVERVIEW TAB
          ════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {(inference || intelligence || codeIntelligence) ? (
            <>
              <ExecutiveIntelligenceDashboard
                intelligence={intelligence}
                inference={inference}
                codeIntelligence={codeIntelligence}
              />
              {intelligence?.executiveSummary?.headline && (
                <SectionCard icon="✦" title="What Is This Repository?">
                  <p style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '800', color: '#111827', letterSpacing: '-0.3px', lineHeight: '1.25' }}>
                    {intelligence.executiveSummary.headline}
                  </p>
                  {intelligence.executiveSummary?.summary && (
                    <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#374151', lineHeight: '1.65' }}>
                      {intelligence.executiveSummary.summary}
                    </p>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {intelligence.executiveSummary?.projectType && (
                      <span style={{ padding: '4px 11px', borderRadius: '10px', fontSize: '12px', fontWeight: '600', backgroundColor: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd' }}>
                        {intelligence.executiveSummary.projectType.replace(/_/g, ' ')}
                      </span>
                    )}
                    {intelligence.executiveSummary?.seniority && (
                      <span style={{ padding: '4px 11px', borderRadius: '10px', fontSize: '12px', fontWeight: '600', ...seniorityBadgeStyle(intelligence.executiveSummary.seniority) }}>
                        {intelligence.executiveSummary.seniority}-level
                      </span>
                    )}
                    {intelligence.executiveSummary?.deploymentMaturity && intelligence.executiveSummary.deploymentMaturity !== 'none' && (
                      <span style={{ padding: '4px 11px', borderRadius: '10px', fontSize: '12px', fontWeight: '600', backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac' }}>
                        {deploymentMaturityLabel(intelligence.executiveSummary.deploymentMaturity)}
                      </span>
                    )}
                  </div>
                </SectionCard>
              )}

              {/* AI Features Detected — shown only when AI capabilities exist */}
              {(intelligence?.aiCapabilities?.hasAiFeatures || intelligence?.aiCapabilities?.present) && (() => {
                const aiTechs = [...new Set([...(codeIntelligence?.technologies ?? []), ...(codeIntelligence?.frameworks ?? [])])].filter(t => EID_TECH_BUCKETS['AI/ML'].has(t))
                const features = intelligence.aiCapabilities.aiFeatures ?? intelligence.aiCapabilities.capabilities ?? []
                const integrations = intelligence.aiCapabilities.modelIntegrations ?? intelligence.aiCapabilities.stack ?? []
                const maturityLevel = intelligence.aiCapabilities.aiMaturityLevel ?? intelligence.aiCapabilities.maturityLevel
                return (
                  <SectionCard icon="🤖" title="AI Features Detected">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* Maturity badge + AI tech chips */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                        {maturityLevel && (
                          <span style={{ padding: '4px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: '700', backgroundColor: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe' }}>
                            {aiMaturityLabel(maturityLevel)}
                          </span>
                        )}
                        {aiTechs.map((t, i) => (
                          <span key={i} style={{ padding: '3px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', backgroundColor: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe' }}>
                            {CI_TECH_LABELS[t] || t}
                          </span>
                        ))}
                      </div>

                      {/* Model Integrations */}
                      {integrations.length > 0 && (
                        <div>
                          <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Model Integrations</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {integrations.map((s, i) => (
                              <span key={i} style={{ padding: '3px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', backgroundColor: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd' }}>
                                {CI_TECH_LABELS[s] || s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Detected AI capabilities */}
                      {features.length > 0 && (
                        <div>
                          <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Capabilities</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {features.map((f, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#374151', lineHeight: '1.45' }}>
                                <span style={{ color: '#7c3aed', flexShrink: 0, fontSize: '10px', marginTop: '3px' }}>◆</span>{f}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                )
              })()}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '56px 24px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: '32px', margin: '0 0 8px' }}>⟳</p>
              <p style={{ margin: '0 0 4px', fontWeight: '700', fontSize: '15px', color: '#111827' }}>Awaiting analysis</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>Click ↺ Reanalyze in the repository header to run the v2 pipeline.</p>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          ARCHITECTURE TAB
          ════════════════════════════════════════ */}
      {activeTab === 'architecture' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Section 1: System Architecture Canvas */}
          {codeIntelligence?.detectedDomains?.length > 0 ? (
            <SystemArchitectureCanvas
              intelligence={intelligence}
              inference={inference}
              codeIntelligence={codeIntelligence}
            />
          ) : null}

          {/* Technology Landscape */}
          {(() => {
            const landscape = computeEIDTechLandscape(codeIntelligence?.technologies, codeIntelligence?.frameworks)
            return Object.keys(landscape).length > 0 ? (
              <SectionCard icon="⚡" title="Technology Landscape">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Object.entries(landscape).map(([cat, techs]) => {
                    const st = EID_BUCKET_STYLE[cat] ?? EID_BUCKET_STYLE.Infrastructure
                    return (
                      <div key={cat}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: st.dot, flexShrink: 0 }} />
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{cat}</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {techs.map((t, i) => (
                            <span key={i} style={{ padding: '3px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </SectionCard>
            ) : null
          })()}

          {/* Section 2: Architecture Skills Demonstrated */}
          {(() => {
            const skills  = deriveArchitectureSkills(intelligence, inference, codeIntelligence)
            const overview = intelligence?.architecture?.overview
            return (skills.length > 0 || overview) ? (
              <SectionCard icon="⟨/⟩" title="Architecture Skills Demonstrated">
                {overview && (
                  <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#374151', lineHeight: '1.7' }}>{overview}</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {skills.map((skill, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 12px', borderRadius: '8px', backgroundColor: '#f0fdf4', border: '1px solid #86efac' }}>
                      <span style={{ color: '#16a34a', fontWeight: '800', fontSize: '13px', flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#166534' }}>{skill}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null
          })()}

          {/* Section 3: Architecture Complexity */}
          {(intelligence || codeIntelligence) && (() => {
            const { level, reasons } = computeArchitectureComplexity(intelligence, inference, codeIntelligence)
            const LEVELS = ['Beginner', 'Intermediate', 'Advanced']
            const LEVEL_STYLE = {
              Beginner:     { bg: '#dcfce7', color: '#166534', border: '#86efac' },
              Intermediate: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
              Advanced:     { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
            }
            return (
              <SectionCard icon="📊" title="Architecture Complexity">
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  {LEVELS.map(l => {
                    const active = l === level
                    const ls = LEVEL_STYLE[l]
                    return (
                      <span key={l} style={{
                        padding: '6px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700',
                        backgroundColor: active ? ls.bg : '#f3f4f6',
                        color: active ? ls.color : '#9ca3af',
                        border: `1px solid ${active ? ls.border : '#e5e7eb'}`,
                      }}>
                        {l}{active ? ' ✓' : ''}
                      </span>
                    )
                  })}
                </div>
                {reasons.length > 0 && (
                  <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '12px 14px', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reasoning</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {reasons.map((r, i) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>
                          <span style={{ color: '#6366f1', flexShrink: 0 }}>•</span>{r}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>
            )
          })()}

          {/* Section 4: Architecture Talking Points */}
          {(() => {
            const points = generateArchitectureTalkingPoints(intelligence, inference, codeIntelligence)
            return points.length > 0 ? (
              <SectionCard icon="🎯" title="Architecture Talking Points">
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#6b7280', lineHeight: '1.5' }}>
                  Use these to prepare for technical interviews about this project's architecture.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {points.map((pt, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 14px', borderRadius: '9px', backgroundColor: '#f8faff', border: '1px solid #e0e7ff' }}>
                      <span style={{ color: '#6366f1', fontWeight: '800', flexShrink: 0, fontSize: '13px', marginTop: '1px' }}>✓</span>
                      <span style={{ fontSize: '13px', color: '#374151', lineHeight: '1.55' }}>{pt}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null
          })()}

          {/* Section 5: AI Engineering Skills */}
          {(() => {
            const aiData = deriveAIEngineeringSkills(intelligence, inference, codeIntelligence)
            return aiData && aiData.skills.length > 0 ? (
              <SectionCard icon="🤖" title="AI Engineering Skills">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: aiData.levelInfo ? '14px' : 0 }}>
                  {aiData.skills.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 12px', borderRadius: '8px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff' }}>
                      <span style={{ color: '#7c3aed', fontWeight: '800', fontSize: '13px', flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#6b21a8' }}>{s}</span>
                    </div>
                  ))}
                </div>
                {aiData.levelInfo && (
                  <div style={{ padding: '10px 14px', backgroundColor: '#f5f3ff', borderRadius: '8px', border: '1px solid #ddd6fe' }}>
                    <p style={{ margin: '0 0 3px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>AI Engineering Level</p>
                    <p style={{ margin: '0 0 3px', fontSize: '15px', fontWeight: '800', color: '#7c3aed' }}>{aiData.levelInfo.level}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{aiData.levelInfo.desc}</p>
                  </div>
                )}
              </SectionCard>
            ) : null
          })()}

          {!codeIntelligence?.detectedDomains?.length && !intelligence?.architecture && (
            <div style={{ textAlign: 'center', padding: '56px 24px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: '32px', margin: '0 0 8px' }}>🏛</p>
              <p style={{ margin: '0 0 4px', fontWeight: '700', fontSize: '15px', color: '#111827' }}>Architecture coaching unavailable</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>Requires code intelligence phase to complete.</p>
            </div>
          )}
        </div>
      )}
      {/* ════════════════════════════════════════
          QUALITY TAB
          ════════════════════════════════════════ */}
      {activeTab === 'quality' && (
        <JobReadinessGapAnalysis
          intelligence={intelligence}
          inference={inference}
          codeIntelligence={codeIntelligence}
        />
      )}

      {/* ════════════════════════════════════════
          PORTFOLIO REPORT TAB
          ════════════════════════════════════════ */}
      {activeTab === 'portfolio-report' && (
        <PortfolioReportTab
          repo={repo}
          intelligence={intelligence}
          inference={inference}
          codeIntelligence={codeIntelligence}
        />
      )}

      {/* ════════════════════════════════════════
          README TAB
          ════════════════════════════════════════ */}
      {activeTab === 'readme' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Header */}
          <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', borderRadius: '12px' }}>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'white' }}>README Generator</p>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#6ee7b7' }}>AI-powered README draft using deep analysis + your media assets</p>
          </div>

          {/* Media URL inputs */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', backgroundColor: 'white' }}>
            <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '700', color: '#111827' }}>Demo / Screenshot URLs (optional)</p>
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#6b7280' }}>
              Paste raw image or GIF URLs — these will be embedded in a Demo section. Use the Project Media tab in Portfolio Builder to get raw URLs.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {mediaInputs.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Label (e.g. Demo)"
                    value={m.label}
                    onChange={e => {
                      const next = [...mediaInputs]
                      next[i] = { ...next[i], label: e.target.value }
                      setMediaInputs(next)
                    }}
                    style={{ width: '120px', padding: '7px 10px', borderRadius: '7px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                  <input
                    type="url"
                    placeholder="https://raw.githubusercontent.com/..."
                    value={m.url}
                    onChange={e => {
                      const next = [...mediaInputs]
                      next[i] = { ...next[i], url: e.target.value.trim() }
                      setMediaInputs(next)
                    }}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: '7px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                  {mediaInputs.length > 1 && (
                    <button
                      onClick={() => setMediaInputs(mediaInputs.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}
                    >×</button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setMediaInputs([...mediaInputs, { label: '', url: '' }])}
              style={{ marginTop: '10px', background: 'none', border: '1px dashed #d1d5db', borderRadius: '7px', padding: '6px 14px', fontSize: '12px', color: '#6b7280', cursor: 'pointer' }}
            >
              + Add another URL
            </button>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerateReadme}
            disabled={readmeGenerating}
            style={{ padding: '11px 20px', borderRadius: '10px', border: 'none', backgroundColor: readmeGenerating ? '#6ee7b7' : '#059669', color: 'white', fontWeight: '700', fontSize: '14px', cursor: readmeGenerating ? 'not-allowed' : 'pointer' }}
          >
            {readmeGenerating ? 'Generating…' : '📝 Generate README'}
          </button>

          {readmeError && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '13px' }}>
              {readmeError}
            </div>
          )}

          {/* Output */}
          {readmeContent && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#111827' }}>Generated README.md</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => navigator.clipboard.writeText(readmeContent)}
                    style={{ padding: '5px 12px', borderRadius: '7px', border: '1px solid #d1d5db', backgroundColor: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', color: '#374151' }}
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([readmeContent], { type: 'text/plain' })
                      const url  = URL.createObjectURL(blob)
                      const a    = document.createElement('a')
                      a.href     = url
                      a.download = 'README.md'
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    style={{ padding: '5px 12px', borderRadius: '7px', border: '1px solid #d1d5db', backgroundColor: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', color: '#374151' }}
                  >
                    Download
                  </button>
                </div>
              </div>
              <pre style={{ margin: 0, padding: '16px', fontSize: '12px', lineHeight: '1.65', color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word', backgroundColor: 'white', maxHeight: '600px', overflowY: 'auto' }}>
                {readmeContent}
              </pre>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

// ── AnalysisPanel ─────────────────────────────────────────────────────────────
// v2-only architecture: all analyses render through V2AnalysisDetail.
// Repos with no v2 analysis show a "Requires Analysis" card with a trigger button.
// Legacy AnalysisDetail and all _source / legacy branching have been removed.

function AnalysisPanel({ importedRepos, onLogout }) {
  // analysisMap values are either a v2 analysis object (from /api/deep-analysis/:id/latest)
  // or a sentinel { status: 'needs_reanalysis', repositoryId } when no v2 record exists yet.
  const [analysisMap,    setAnalysisMap]    = useState({})
  const [detailRepo,     setDetailRepo]     = useState(null)
  const [triggeringRepo, setTriggeringRepo] = useState(null)   // repoId currently being triggered
  const [triggerErrors,  setTriggerErrors]  = useState({})     // { [repoId]: string | null }
  const pollRef = useRef(null)

  // ── Load on mount / repo list change ─────────────────────────────────────────

  useEffect(() => {
    if (!importedRepos.length) return
    importedRepos.forEach(repo => loadRepoAnalysis(repo.id))
  }, [importedRepos])

  // ── Polling — fires while any analysis is queued or running ──────────────────

  useEffect(() => {
    const hasActive = Object.values(analysisMap).some(
      a => a.status === 'queued' || a.status === 'running',
    )
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(() => pollActive(), POLL_INTERVAL_MS)
    }
    if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [analysisMap])

  // ── Data fetching ─────────────────────────────────────────────────────────────

  function loadRepoAnalysis(repositoryId) {
    authFetch(`${BASE_URL}/api/deep-analysis/${repositoryId}/latest`, {}, onLogout)
      .then(async res => {
        if (res && res.ok) {
          const data = await res.json()
          if (data?.success) {
            setAnalysisMap(prev => ({ ...prev, [repositoryId]: { ...data.data, repositoryId } }))
            return
          }
        }
        // No v2 analysis exists for this repo yet — show "Requires Analysis" state
        setAnalysisMap(prev => ({ ...prev, [repositoryId]: { status: 'needs_reanalysis', repositoryId } }))
      })
      .catch(() => {
        setAnalysisMap(prev => ({ ...prev, [repositoryId]: { status: 'needs_reanalysis', repositoryId } }))
      })
  }

  function pollActive() {
    Object.values(analysisMap)
      .filter(a => a.status === 'queued' || a.status === 'running')
      .forEach(a => {
        authFetch(`${BASE_URL}/api/deep-analysis/${a.repositoryId}/latest`, {}, onLogout)
          .then(res => res?.json())
          .then(data => {
            if (data?.success) {
              setAnalysisMap(prev => ({
                ...prev,
                [a.repositoryId]: { ...data.data, repositoryId: a.repositoryId },
              }))
            }
          })
          .catch(() => {})
      })
  }

  // ── Trigger v2 analysis for a single repo ────────────────────────────────────

  async function handleTriggerAnalysis(repoId) {
    const url = `${BASE_URL}/api/deep-analysis/${repoId}/reanalyze`
    console.log('[AnalysisPanel] handleTriggerAnalysis — POST', url, '| repoId:', repoId)

    setTriggeringRepo(repoId)
    setTriggerErrors(prev => ({ ...prev, [repoId]: null }))

    let res       = null
    let json      = null
    let fetchErr  = null

    try {
      // Content-Type: application/json is required so express.json() can parse req.body.
      // Without it req.body is undefined, the route destructs it, throws a TypeError,
      // Express returns an HTML 500 page, and res.json() throws SyntaxError → "Network error."
      res = await authFetch(
        url,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({}),
        },
        onLogout,
      )
      console.log('[AnalysisPanel] handleTriggerAnalysis — status:', res?.status, '| ok:', res?.ok)
      // Guard against non-JSON responses (HTML error pages from Express)
      try { json = await res?.json() } catch { json = null }
      console.log('[AnalysisPanel] handleTriggerAnalysis — body:', json)
    } catch (err) {
      fetchErr = err.message
      console.error('[AnalysisPanel] handleTriggerAnalysis — fetch error:', err)
    }

    if (fetchErr) {
      setTriggerErrors(prev => ({ ...prev, [repoId]: `Could not reach server: ${fetchErr}` }))
    } else if (json?.success) {
      // Optimistically mark as queued so polling starts immediately
      setAnalysisMap(prev => ({
        ...prev,
        [repoId]: { ...(prev[repoId] || {}), status: 'queued', repositoryId: repoId },
      }))
    } else if (json?.error?.code === 'ANALYSIS_IN_PROGRESS') {
      // A run is already active — reload from server to show current state
      loadRepoAnalysis(repoId)
    } else {
      setTriggerErrors(prev => ({
        ...prev,
        [repoId]: json?.error?.message
                || (res ? `Server error (HTTP ${res.status})` : null)
                || 'Failed to start analysis.',
      }))
    }

    setTriggeringRepo(null)
  }

  // ── Detail view — always V2AnalysisDetail, no branching ──────────────────────

  if (detailRepo) {
    const analysis = analysisMap[detailRepo.id]
    console.log('[AnalysisPanel] renderer —', {
      repoId:          detailRepo.id,
      analysisVersion: analysis?.analysisVersion,
      pipelineVersion: analysis?.pipelineVersion,
      status:          analysis?.status,
    })
    return (
      <V2AnalysisDetail
        repo={detailRepo}
        analysis={analysis}
        onBack={() => setDetailRepo(null)}
        onLogout={onLogout}
        onReanalyzed={() => setAnalysisMap(prev => ({
          ...prev,
          [detailRepo.id]: { ...(prev[detailRepo.id] || {}), status: 'queued', repositoryId: detailRepo.id },
        }))}
      />
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────────

  const anyActive = Object.values(analysisMap).some(
    a => a.status === 'queued' || a.status === 'running',
  )

  if (!importedRepos.length) {
    return (
      <p style={{ color: '#6b7280', fontSize: '14px' }}>
        No repos imported yet. Go to Browse and import repos first.
      </p>
    )
  }

  return (
    <>
      {/* Action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontSize: '14px', color: '#6b7280' }}>
          {importedRepos.length} imported repo{importedRepos.length !== 1 ? 's' : ''}
          {anyActive && <span style={{ marginLeft: '10px', color: '#2563eb' }}>● Analyzing…</span>}
        </span>
      </div>

      {/* Repo list */}
      {importedRepos.map(repo => {
        const analysis      = analysisMap[repo.id]
        // A repo is renderable when it has a v2 analysis that is complete or partially complete.
        // queued / running analyses are active but not yet viewable.
        // needs_reanalysis means no v2 record exists — show the trigger UI.
        const isActive      = analysis?.status === 'queued' || analysis?.status === 'running'
        const isComplete    = analysis?.status === 'completed' || analysis?.status === 'partial'
        const isFailed      = analysis?.status === 'failed'
        const needsAnalysis = !analysis || analysis.status === 'needs_reanalysis'
        const isTriggering  = triggeringRepo === repo.id
        const triggerError  = triggerErrors[repo.id]

        return (
          <div
            key={repo.id}
            onClick={isComplete ? () => setDetailRepo(repo) : undefined}
            style={{
              padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: '10px',
              marginBottom: '10px', backgroundColor: 'white',
              cursor: isComplete ? 'pointer' : 'default', transition: 'box-shadow 0.15s',
            }}
            onMouseEnter={e => { if (isComplete) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#111827' }}>{repo.name}</span>
                {isComplete && (
                  <span style={{ marginLeft: '8px', fontSize: '12px', color: '#4f46e5' }}>View analysis →</span>
                )}
                {repo.description && (
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>{repo.description}</p>
                )}
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '12px', color: '#9ca3af' }}>
                  {repo.primary_language && <span>{repo.primary_language}</span>}
                  <span>⭐ {repo.stars_count ?? 0}</span>
                </div>
                {triggerError && (
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#dc2626' }}>{triggerError}</p>
                )}
              </div>

              <div style={{ marginLeft: '12px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                {needsAnalysis ? (
                  <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db' }}>
                    Not analyzed
                  </span>
                ) : (
                  statusBadge(analysis.status)
                )}
                {/* Show trigger button for repos with no v2 analysis or a failed run */}
                {(needsAnalysis || isFailed) && (
                  <button
                    onClick={e => { e.stopPropagation(); handleTriggerAnalysis(repo.id) }}
                    disabled={isTriggering}
                    style={{
                      padding: '5px 14px', borderRadius: '6px', border: 'none',
                      backgroundColor: isTriggering ? '#a5b4fc' : '#4f46e5',
                      color: 'white', fontWeight: '600', fontSize: '12px',
                      cursor: isTriggering ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    {isTriggering ? 'Starting…' : 'Analyze'}
                  </button>
                )}
              </div>
            </div>


            {isFailed && (
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#dc2626' }}>
                Analysis failed. Click Analyze to retry.
              </p>
            )}
          </div>
        )
      })}
    </>
  )
}

export default AnalysisPanel
