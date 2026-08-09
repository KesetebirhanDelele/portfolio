'use strict';

const puppeteer = require('puppeteer');
const { TECH_CATEGORIES, TECH_LABELS } = require('./techMaps');

async function generatePortfolioPdf(data) {
  const html = buildResumeHtml(data);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: false,
      margin: { top: '12mm', right: '14mm', bottom: '12mm', left: '14mm' },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

// ─── Lookup tables ────────────────────────────────────────────────────────────


// code_intelligence architecturePatterns → human labels
const CI_ARCH_LABELS = {
  rest_api:                'REST API Architecture',
  graphql_api:             'GraphQL API',
  type_safe_api:           'Type-Safe API',
  enterprise_rest_api:     'Enterprise REST API',
  stateless_auth:          'JWT Authentication',
  session_based_auth:      'Session Authentication',
  hosted_auth_provider:    'Hosted Auth Provider',
  strategy_based_auth:     'Strategy-Based Auth',
  provider_based_auth:     'OAuth Authentication',
  custom_auth_middleware:  'Custom Auth Middleware',
  orm:                     'Database Persistence Layer',
  query_builder:           'Programmatic Query Layer',
  document_database_odm:   'Document ODM',
  document_database:       'Document Database',
  relational_database:     'Relational Database',
  cache_store:             'Caching Layer',
  nosql_database:          'NoSQL Database',
  search_database:         'Full-Text Search',
  vector_database:         'Vector Database',
  vector_embeddings:       'Vector Embeddings',
  llm_integration:         'LLM Integration',
  llm_orchestration:       'LLM Orchestration',
  rag_framework:           'RAG Framework',
  component_ui:            'Component-Driven Frontend',
  ssr_framework:           'Server-Side Rendering (SSR)',
  global_state_management: 'Global State Management',
  utility_css_framework:   'Utility-First CSS',
  containerization:        'Containerized Deployment',
  container_orchestration: 'Container Orchestration',
  cicd_pipeline:           'Automated CI/CD Pipeline',
  infrastructure_as_code:  'Infrastructure Automation',
  payment_processing:      'Payment Integration',
  rest_routing:            'REST API Routing',
};

// career_signals domain → professional job title noun
const DOMAIN_TO_TITLE = {
  // AI / ML variants (OpenAI may return any of these)
  'AI Engineering':           'AI Backend Engineer',
  'Artificial Intelligence':  'AI Backend Engineer',
  'AI/ML Engineering':        'AI Backend Engineer',
  'AI Development':           'AI Backend Engineer',
  'AI/ML':                    'AI Backend Engineer',
  'Machine Learning':         'Machine Learning Engineer',
  // Full-stack / web
  'Full Stack Development':   'Full-Stack Developer',
  'Web Development':          'Software Engineer',
  // Backend / frontend
  'Backend Development':      'Backend Engineer',
  'Frontend Development':     'Frontend Engineer',
  // Other engineering domains
  'Software Development':     'Software Engineer',
  'Software Engineering':     'Software Engineer',
  'Mobile Development':       'Mobile Developer',
  'Data Engineering':         'Data Engineer',
  'DevOps Engineering':       'DevOps Engineer',
  'System Architecture':      'Software Architect',
  'Cloud Engineering':        'Cloud Engineer',
  'Security Engineering':     'Security Engineer',
  // Data / BI
  'Power BI Development':     'Power BI Developer',
  'Business Intelligence':    'Business Intelligence Developer',
  'Data Analytics':           'Data Analyst',
  'Data Analysis':            'Data Analyst',
};

// patternsInferred → secondary headline specialization (shown after pipe)
const PATTERN_SECONDARY = {
  fullstack_architecture_confirmed:   'Full-Stack Development',
  ai_orchestrated_system:             'AI Systems',
  retrieval_augmented_architecture:   'RAG Development',
  production_ready_backend:           'Backend Engineering',
  enterprise_backend_patterns:        'Enterprise Backend',
  modular_frontend_architecture:      'Frontend Development',
  infrastructure_as_code_present:     'Cloud Infrastructure',
};

// patternsInferred → role noun used in summary S1 sentence
const ROLE_MAP = {
  ai_orchestrated_system:           'AI Engineer',
  retrieval_augmented_architecture: 'AI Engineer',
  ai_integration_confirmed:         'Full-Stack AI Engineer',
  fullstack_architecture_confirmed: 'Full-Stack Engineer',
  production_ready_backend:         'Backend Engineer',
  enterprise_backend_patterns:      'Backend Engineer',
  modular_frontend_architecture:    'Frontend Engineer',
};

// patternsInferred → concise noun-phrase specialization for summary sentence 2
const SPEC_MAP = {
  ai_orchestrated_system:           'LLM orchestration and AI system integration',
  retrieval_augmented_architecture: 'RAG pipeline development',
  ai_integration_confirmed:         'AI and LLM integration',
  fullstack_architecture_confirmed: 'full-stack architecture and system design',
  production_ready_backend:         'production-grade backend development',
  enterprise_backend_patterns:      'enterprise backend architecture',
  infrastructure_as_code_present:   'infrastructure automation and cloud deployment',
  strong_domain_separation:         'domain-driven architecture',
  scalable_service_architecture:    'scalable service design',
};

// Industry hints derived from known employer names
const INDUSTRY_HINTS = {
  'marine corps':     'defense',
  'military':         'defense',
  'army':             'defense',
  'navy':             'defense',
  'cb richard ellis': 'commercial real estate',
  'cbre':             'commercial real estate',
  'wizetrade':        'financial technology',
  'associates':       'technology consulting',
  'consulting':       'technology consulting',
};

// Generic AI-assessment phrases to filter from project bullets
const GENERIC_PATTERNS = [
  'managed architectural complexity',
  'operated across a',
  'engineering capability detected',
  'applied engineering best practices',
  'spanning the full application lifecycle',
  'interconnected system components',
  'technology stack spanning',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function allPatterns(repos) {
  return [...new Set(repos.flatMap(r => r.inference?.patternsInferred || []))];
}

function getEngLevel(repos) {
  for (const r of repos) {
    const lvl = r.inference?.overallAssessment?.engineeringLevel;
    if (lvl) return lvl;
  }
  return null;
}

function getYearsExperience(experience) {
  if (!Array.isArray(experience) || !experience.length) return null;
  const dates = experience
    .map(e => e.startDate).filter(Boolean)
    .map(d => new Date(d)).filter(d => !isNaN(d.getTime()));
  if (!dates.length) return null;
  const years = Math.floor((Date.now() - Math.min(...dates.map(d => d.getTime()))) / (1000 * 60 * 60 * 24 * 365));
  return years > 0 ? years : null;
}

function buildProfessionalHeadline(repos, careerSignals, experience, fallbackHeadline) {
  // Engineering level prefix (omit "Junior" — sounds entry-level on a resume)
  const engLevel = getEngLevel(repos);
  const levelLabel = engLevel === 'senior' ? 'Senior' : engLevel === 'mid' ? 'Mid-Level' : null;

  // Primary title from top career signal domain
  const sorted = Array.isArray(careerSignals)
    ? [...careerSignals].filter(s => s?.domain).sort((a, b) => (b.score || 0) - (a.score || 0))
    : [];
  const topDomain  = sorted[0]?.domain || null;
  const primaryTitle = topDomain ? (DOMAIN_TO_TITLE[topDomain] || topDomain) : null;

  if (!primaryTitle) return fallbackHeadline || 'Software Engineer';

  // Secondary specialization: prefer second career signal, else first matching pattern
  const secondDomain = sorted[1]?.domain || null;
  let secondary = secondDomain ? (DOMAIN_TO_TITLE[secondDomain] || null) : null;
  if (!secondary) {
    const patterns = allPatterns(repos);
    for (const [pat, label] of Object.entries(PATTERN_SECONDARY)) {
      if (patterns.includes(pat) && label !== primaryTitle) { secondary = label; break; }
    }
  }
  // Suppress secondary when it's redundant with the primary title
  if (secondary && primaryTitle.toLowerCase().includes(secondary.toLowerCase().split(' ')[0].toLowerCase())) {
    secondary = null;
  }

  const parts = [levelLabel, primaryTitle].filter(Boolean).join(' ');
  return secondary ? `${parts}  |  ${secondary}` : parts;
}

function extractIndustries(experience) {
  const found = new Set();
  for (const exp of (experience || [])) {
    const co = (exp.company || '').toLowerCase();
    for (const [key, industry] of Object.entries(INDUSTRY_HINTS)) {
      if (co.includes(key)) { found.add(industry); break; }
    }
  }
  return [...found].slice(0, 3);
}

function isGenericBullet(b) {
  const lower = b.toLowerCase();
  return GENERIC_PATTERNS.some(g => lower.includes(g));
}

// ─── Professional Summary (4 sentences, career-focused, human-sounding) ───────

function buildPersonSummary(repos, experience, careerSignals) {
  const patterns   = allPatterns(repos);
  const engLevel   = getEngLevel(repos);
  const years      = getYearsExperience(experience);
  const industries = extractIndustries(experience);

  const levelLabel = { senior: 'Senior', mid: 'Mid-Level', junior: 'Entry-Level' }[engLevel] || null;
  let role = null;
  for (const [pat, r] of Object.entries(ROLE_MAP)) {
    if (patterns.includes(pat)) { role = r; break; }
  }
  const titlePart = [levelLabel, role].filter(Boolean).join(' ') || 'Software Engineer';

  // S1 — Identity + years + industry breadth
  const yearsPart = years ? `${years}+ years of experience` : 'extensive experience';
  const industryPhrase = industries.length >= 2
    ? `across ${industries.slice(0, -1).join(', ')}, and ${industries[industries.length - 1]}`
    : 'across enterprise software and cloud-native systems';
  const s1 = `${titlePart} with ${yearsPart} delivering production-grade software systems ${industryPhrase}.`;

  // S2 — Top 2 specializations (cap at 2 to stay concise; tech list lives in Skills section)
  const specs = patterns.filter(p => SPEC_MAP[p]).slice(0, 2).map(p => SPEC_MAP[p]);
  const s2 = specs.length ? `Specializes in ${specs.join(' and ')}.` : null;

  // S3 — Business-impact closing
  const isAI       = patterns.includes('ai_orchestrated_system') || patterns.includes('ai_integration_confirmed');
  const isFullstack = patterns.includes('fullstack_architecture_confirmed');
  const s3 = (engLevel === 'senior' && isAI)
    ? 'Delivers intelligent, production-ready systems that combine technical leadership with hands-on engineering.'
    : (engLevel === 'senior' && isFullstack)
    ? 'Brings a systems-thinking approach to full-stack delivery, balancing architecture quality with execution speed.'
    : engLevel === 'senior'
    ? 'Builds production-grade systems with a focus on reliability, observability, and long-term maintainability.'
    : isAI
    ? 'Applies AI and modern engineering practices to build scalable, real-world software solutions.'
    : 'Focused on clarity, reliability, and long-term quality across the full software lifecycle.';

  return [s1, s2, s3].filter(Boolean).join(' ') || null;
}

// ─── Synthesized accomplishment bullets from architecture patterns ─────────────

function buildArchBullets(archPatterns, techs, frameworks) {
  const all = [...new Set([...techs, ...frameworks])];
  const bullets = [];

  const ARCH_BULLET = {
    rest_api: () => {
      const hasAuth = all.includes('jwt') || all.includes('passport');
      return hasAuth
        ? 'Built RESTful API with JWT authentication for secure client access'
        : 'Built RESTful API with structured resource routing and request handling';
    },
    stateless_auth: () =>
      'Implemented JWT-based authentication for secure, stateless API access',
    orm: () => {
      const orm = all.find(t => ['sequelize','prisma','typeorm','mongoose','drizzle','knex'].includes(t));
      const label = orm ? (TECH_LABELS[orm] || orm.charAt(0).toUpperCase() + orm.slice(1)) : null;
      return label
        ? `Implemented ${label} ORM for structured database access and query management`
        : 'Implemented ORM-based data access layer for structured database interaction';
    },
    containerization: () => all.includes('kubernetes')
      ? 'Deployed containerized services to Kubernetes for production scalability'
      : 'Containerized application with Docker for portable, reproducible deployment',
    container_orchestration: () =>
      'Orchestrated services with Kubernetes for automated scaling and rolling deployments',
    cicd_pipeline: () => {
      const ciLabel = all.includes('github-actions') ? 'GitHub Actions' : 'CI/CD tooling';
      return `Automated CI/CD pipeline using ${ciLabel} for continuous integration and deployment`;
    },
    infrastructure_as_code: () => {
      const iac = all.find(t => ['terraform','pulumi'].includes(t));
      const iacLabel = iac ? (TECH_LABELS[iac] || iac.charAt(0).toUpperCase() + iac.slice(1)) : 'Terraform';
      return `Managed infrastructure as code using ${iacLabel} for reproducible cloud environments`;
    },
    llm_integration: () => {
      const llm = all.find(t => ['openai','anthropic','langchain','llamaindex','mistral'].includes(t));
      const llmLabel = llm ? (TECH_LABELS[llm] || llm.charAt(0).toUpperCase() + llm.slice(1)) : 'OpenAI API';
      return `Integrated ${llmLabel} for AI-powered features and intelligent automation`;
    },
    llm_orchestration: () =>
      'Built multi-step LLM orchestration pipeline for structured AI workflow execution',
    rag_framework: () =>
      'Implemented RAG pipeline combining vector search with LLM responses for context-aware AI output',
    vector_database: () => {
      const vdb = all.find(t => ['pinecone','chromadb','weaviate'].includes(t));
      const vdbLabel = vdb ? (TECH_LABELS[vdb] || vdb.charAt(0).toUpperCase() + vdb.slice(1)) : 'vector database';
      return `Integrated ${vdbLabel} for semantic search and embedding storage`;
    },
    relational_database: () => {
      const db = all.find(t => ['postgresql','mysql','sqlite'].includes(t));
      const dbLabel = db ? (TECH_LABELS[db] || db.charAt(0).toUpperCase() + db.slice(1)) : 'relational database';
      return `Designed ${dbLabel} schema with optimized queries for core business data`;
    },
    global_state_management: () =>
      'Implemented global state management for complex client-side data flows',
  };

  for (const pat of archPatterns) {
    if (bullets.length >= 3) break;
    if (ARCH_BULLET[pat]) {
      const b = ARCH_BULLET[pat]();
      if (b) bullets.push(b);
    }
  }

  return bullets;
}

// ─── Project description line ─────────────────────────────────────────────────

function cleanProjectDescription(overview, hookSentence) {
  const raw = overview || hookSentence;
  if (!raw) return null;
  let s = raw
    .replace(/^This\s+(repository|repo|project)\s+(is\s+|implements?\s+)?/i, '')
    .replace(/^[Aa]n?\s+[\w\s,+\-\/]+?-powered\s+/i, '')
    .replace(/^[Aa]n?\s+/, '')
    .replace(/\s+spanning\s+\d+\s+architectural\s+layers?[^.]*\.?/gi, '.')
    .replace(/\s+across\s+\d+\s+(interconnected\s+)?components?[^.]*\.?/gi, '.')
    .trim();
  if (!s) return null;
  // Use only the first sentence
  const firstPeriod = s.indexOf('.');
  if (firstPeriod > 0 && firstPeriod < s.length - 1) s = s.slice(0, firstPeriod + 1);
  // Truncate at 85 characters on a word boundary
  if (s.length > 85) s = s.slice(0, 83).replace(/\s+\S*$/, '') + '.';
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!s.endsWith('.')) s += '.';
  return s;
}

// ─── Project blocks ───────────────────────────────────────────────────────────

function buildProjectBlocks(projects, repos) {
  return projects.map(p => {
    const repo  = repos.find(r => r.name === p.repoName) || {};
    const ci    = repo.codeIntelligence || {};
    const intel = repo.intelligence     || {};

    // One-line description of what the project is
    const desc = cleanProjectDescription(
      intel.executiveSummary?.overview,
      intel.portfolioNarrative?.hookSentence || p.oneLiner,
    );

    // Priority 1: technicalDifferentiation — what's technically interesting (human-sounding)
    const techDiff = (intel.portfolioNarrative?.technicalDifferentiation || [])
      .filter(b => !isGenericBullet(b)).slice(0, 2);

    // Priority 2: operationalCapabilities — what the system actually does
    const opCaps = (intel.businessValue?.operationalCapabilities || [])
      .filter(b => !isGenericBullet(b)).slice(0, 2);

    const humanBullets = [...new Set([...techDiff, ...opCaps])].slice(0, 3);

    // Priority 3: synthesized arch bullets to supplement or replace generic ones
    const archBullets = buildArchBullets(
      ci.architecturePatterns || [],
      ci.technologies || [],
      ci.frameworks || [],
    );

    const finalBullets = [...humanBullets];
    for (const b of archBullets) {
      if (finalBullets.length >= 4) break;
      if (!finalBullets.some(ex => ex.toLowerCase().slice(0, 25) === b.toLowerCase().slice(0, 25))) {
        finalBullets.push(b);
      }
    }

    // Tech stack: deduplicate, limit to 6, display labels
    const techKeys = [...new Set([...(ci.technologies || []), ...(ci.frameworks || [])])];
    const techs = techKeys
      .slice(0, 6)
      .map(t => TECH_LABELS[t] || t.charAt(0).toUpperCase() + t.slice(1));

    return { name: p.repoName, desc, bullets: finalBullets.slice(0, 4), techs };
  });
}

// ─── Skills aggregation ───────────────────────────────────────────────────────

function aggregateSkills(repos, topSkills, patterns) {
  const byCategory = {};

  // Primary languages from repo metadata
  const languages = [...new Set(repos.map(r => r.primaryLanguage).filter(Boolean))];
  if (languages.length) byCategory['Languages'] = [...languages];

  // Technologies from code intelligence
  const seen = new Set();
  for (const repo of repos) {
    const ci = repo.codeIntelligence;
    if (!ci) continue;
    for (const t of [...(ci.technologies || []), ...(ci.frameworks || [])]) {
      if (seen.has(t)) continue;
      seen.add(t);
      const cat = TECH_CATEGORIES[t];
      if (!cat) continue;
      const label = TECH_LABELS[t] || t.charAt(0).toUpperCase() + t.slice(1);
      byCategory[cat] = byCategory[cat] || [];
      if (!byCategory[cat].includes(label)) byCategory[cat].push(label);
    }
  }

  // Fallback to narrative top_skills
  if (Object.keys(byCategory).filter(k => k !== 'Languages').length === 0 && topSkills.length) {
    for (const s of topSkills) {
      const cat = s.category || 'Other';
      byCategory[cat] = byCategory[cat] || [];
      if (!byCategory[cat].includes(s.name)) byCategory[cat].push(s.name);
    }
  }

  // Implied languages
  const langs = byCategory['Languages'] || [];
  if (langs.includes('TypeScript') && !langs.includes('JavaScript')) langs.push('JavaScript');
  const hasRelDb = (byCategory['Databases'] || []).some(d => ['PostgreSQL','MySQL','SQLite'].includes(d));
  if (hasRelDb && !langs.includes('SQL')) {
    byCategory['Languages'] = byCategory['Languages'] || [];
    byCategory['Languages'].push('SQL');
  }

  // Pattern-derived additions to AI/ML
  const pats = patterns || [];
  if (pats.includes('ai_orchestrated_system') || pats.includes('retrieval_augmented_architecture')) {
    byCategory['AI/ML'] = byCategory['AI/ML'] || [];
    if (!byCategory['AI/ML'].includes('LLM Orchestration')) byCategory['AI/ML'].push('LLM Orchestration');
  }
  if (pats.includes('retrieval_augmented_architecture')) {
    byCategory['AI/ML'] = byCategory['AI/ML'] || [];
    if (!byCategory['AI/ML'].includes('RAG Pipelines')) byCategory['AI/ML'].push('RAG Pipelines');
  }

  return byCategory;
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildResumeHtml({
  title, headline, narrative, topSkills = [], projects = [],
  careerSignals = [], repos = [], githubUsername,
  profile = {}, experience = [], education = [],
}) {
  const patterns      = allPatterns(repos);
  const skillsByCategory = aggregateSkills(repos, topSkills, patterns);
  const projectBlocks = buildProjectBlocks(projects, repos);
  const summary       = buildPersonSummary(repos, experience, careerSignals);

  const displayName     = profile.fullName || title || 'Developer Portfolio';
  const displayRoleLine = buildProfessionalHeadline(repos, careerSignals, experience, profile.headline || headline);

  const contactParts = [
    profile.email       ? esc(profile.email) : null,
    profile.location    ? esc(profile.location) : null,
    profile.linkedinUrl ? `<a href="${esc(ensureHttps(profile.linkedinUrl))}">${esc(profile.linkedinUrl.replace(/^https?:\/\//, ''))}</a>` : null,
    githubUsername      ? `<a href="https://github.com/${esc(githubUsername)}">github.com/${esc(githubUsername)}</a>` : null,
    profile.website     ? `Portfolio: <a href="${esc(ensureHttps(profile.website))}">${esc(profile.website.replace(/^https?:\/\//, ''))}</a>` : null,
  ].filter(Boolean);

  // Skills — ORM & Data Access sits between Databases and AI/ML
  const SKILL_ORDER = ['Languages', 'Backend', 'Frontend', 'Databases', 'ORM & Data Access', 'AI/ML', 'DevOps', 'Integrations', 'Other'];
  const orderedSkillEntries = [
    ...SKILL_ORDER.filter(c => skillsByCategory[c]),
    ...Object.keys(skillsByCategory).filter(c => !SKILL_ORDER.includes(c)),
  ].map(cat => [cat, [...new Set(skillsByCategory[cat])]]);

  const skillsHtml = orderedSkillEntries.length ? `
  <div class="section">
    <div class="section-title">Technical Skills</div>
    ${orderedSkillEntries.map(([cat, names]) => `
    <div class="skill-row">
      <span class="skill-cat">${esc(cat)}:</span>
      <span class="skill-list">${names.map(esc).join(', ')}</span>
    </div>`).join('')}
  </div>` : '';

  const experienceHtml = (experience || []).map(e => {
    const dateRange   = [e.startDate, e.endDate].filter(Boolean).join(' – ') + (e.duration ? ` (${e.duration})` : '');
    const companyLine = [e.company, e.location].filter(Boolean).join(', ');
    const bulletsHtml = (e.bullets || []).length
      ? `<ul class="exp-bullets">${e.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>`
      : '';
    return `
    <div class="exp-entry">
      <div class="exp-header">
        <span class="exp-role">${esc(e.role)}</span>
        ${dateRange ? `<span class="exp-date">${esc(dateRange)}</span>` : ''}
      </div>
      ${companyLine ? `<div class="exp-company">${esc(companyLine)}</div>` : ''}
      ${bulletsHtml}
    </div>`;
  }).join('');

  const educationHtml = (education || []).map(e => {
    const years = [e.startYear, e.endYear].filter(Boolean).join(' – ');
    return `
    <div class="edu-entry">
      <div class="edu-degree">${esc(e.degree)}</div>
      <div class="edu-institution">${esc(e.institution)}${years ? ` &middot; ${esc(years)}` : ''}</div>
    </div>`;
  }).join('');

  const projectsHtml = projectBlocks.map(p => `
    <div class="project">
      <div class="project-name">${esc(fmtName(p.name))}</div>
      ${p.desc ? `<p class="project-desc">${esc(p.desc)}</p>` : ''}
      ${p.bullets.length ? `<ul class="project-bullets">${p.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      ${p.techs.length ? `<p class="project-techs"><strong>Tech Stack:</strong> ${p.techs.map(esc).join(', ')}</p>` : ''}
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', Cambria, serif;
    font-size: 10.5pt;
    line-height: 1.5;
    color: #1a1a1a;
    background: #fff;
  }

  /* ── Page container ── */
  .resume { width: 100%; padding: 0; }

  /* ── Header ── */
  .header {
    display: flex; flex-direction: column; align-items: center;
    text-align: center;
    margin-bottom: 18px; padding-bottom: 14px; border-bottom: 2px solid #000;
  }
  .name        { font-size: 24pt; font-weight: 700; color: #000; letter-spacing: 0.5px; }
  .role        { font-size: 13pt; color: #222; margin-top: 6px; font-weight: 400; letter-spacing: 0.3px; }
  .contact     { font-size: 9pt; color: #444; margin-top: 8px; }
  .contact a   { color: #1a1a1a; text-decoration: none; }
  .contact-sep { color: #999; margin: 0 8px; }

  /* ── Sections ── */
  .section { margin-bottom: 18px; }
  .section-title {
    font-size: 13pt; font-weight: 700; color: #000;
    text-transform: uppercase; letter-spacing: 1.5px;
    border-bottom: 1.5px solid #000;
    padding-bottom: 4px; margin-bottom: 10px;
  }

  /* ── Summary ── */
  .summary { font-size: 10pt; color: #222; line-height: 1.6; }

  /* ── Skills — fixed-width label column ── */
  .skill-row  { display: flex; margin-bottom: 5px; font-size: 9.5pt; }
  .skill-cat  { font-weight: 700; color: #000; min-width: 155px; flex-shrink: 0; }
  .skill-list { color: #222; }

  /* ── Experience ── */
  .exp-entry   { margin-bottom: 12px; }
  .exp-header  { display: flex; justify-content: space-between; align-items: baseline; }
  .exp-role    { font-size: 10.5pt; font-weight: 700; color: #000; }
  .exp-date    { font-size: 9pt; color: #444; white-space: nowrap; margin-left: 10px; }
  .exp-company { font-size: 9.5pt; color: #333; margin-top: 2px; font-style: italic; }
  .exp-bullets { margin: 4px 0 0 16px; font-size: 9.5pt; color: #222; line-height: 1.5; }
  .exp-bullets li { margin-bottom: 3px; }

  /* ── Education ── */
  .edu-entry       { margin-bottom: 7px; }
  .edu-degree      { font-size: 10pt; font-weight: 600; color: #000; }
  .edu-institution { font-size: 9.5pt; color: #333; margin-top: 2px; }

  /* ── Projects ── */
  .project         { margin-bottom: 14px; }
  .project-name    { font-size: 10.5pt; font-weight: 700; color: #000; }
  .project-desc    { font-size: 9.5pt; color: #444; margin-top: 2px; font-style: italic; }
  .project-bullets { margin: 5px 0 0 16px; font-size: 9.5pt; color: #222; line-height: 1.55; }
  .project-bullets li { margin-bottom: 3px; }
  .project-techs   { font-size: 8.5pt; color: #444; margin-top: 5px; }
  .project-techs strong { color: #000; font-weight: 700; }

  /* ── Footer ── */
  .footer {
    margin-top: 16px; border-top: 1px solid #ccc;
    padding-top: 6px; font-size: 8pt; color: #666; text-align: center;
  }
</style>
</head>
<body>
<div class="resume">

  <div class="header">
    <div class="name">${esc(displayName)}</div>
    ${displayRoleLine ? `<div class="role">${esc(displayRoleLine)}</div>` : ''}
    ${contactParts.length ? `<div class="contact">${contactParts.join('<span class="contact-sep">|</span>')}</div>` : ''}
  </div>

  ${summary ? `
  <div class="section">
    <div class="section-title">Professional Summary</div>
    <p class="summary">${esc(summary)}</p>
  </div>` : ''}

  ${experienceHtml ? `
  <div class="section">
    <div class="section-title">Experience</div>
    ${experienceHtml}
  </div>` : ''}

  ${skillsHtml}

  ${projectsHtml ? `
  <div class="section">
    <div class="section-title">Projects</div>
    ${projectsHtml}
  </div>` : ''}

  ${educationHtml ? `
  <div class="section">
    <div class="section-title">Education</div>
    ${educationHtml}
  </div>` : ''}

  <div class="footer">
    Generated by Repo2Reputation &middot; ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
  </div>

</div>
</body>
</html>`;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function fmtName(name = '') {
  return name.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
}

function ensureHttps(url) {
  if (!url) return url;
  return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
}

module.exports = { generatePortfolioPdf };
