const OpenAI = require('openai');

// Explicit timeout (observability Tier 1) — previously unset, so a hung
// OpenAI request had no bound short of the SDK's own 10-minute default,
// well past anything a request handler should be allowed to block on.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000, maxRetries: 2 });

const SYSTEM_PROMPT = `You are a technical skill analyzer for a developer portfolio platform.
Analyze the provided GitHub repository metadata and extract technologies, key takeaways, and a professional summary.

Rules:
- Only include technologies clearly evidenced by the provided metadata
- Do not invent or assume skills not evidenced in the data
- Confidence scores must be between 0.0 and 1.0
- Technologies must be specific (e.g. "React" not "Frontend")
- Evidence must quote what in the metadata supports the claim
- confidence_label must be "High" (>=0.8), "Medium" (0.5–0.79), or "Low" (<0.5)
- key_takeaways status must be either "positive" or "warning"

Return ONLY valid JSON with this exact structure:
{
  "summary": "2-3 sentence professional summary of the work demonstrated in this repository.",
  "key_takeaways": [
    { "text": "Uses React 18 with hooks for modern UI patterns", "status": "positive" },
    { "text": "No test files detected", "status": "warning" }
  ],
  "technologies": [
    { "name": "React", "category": "Frontend", "confidence": 0.94, "evidence": "Listed in topics and README" },
    { "name": "Node.js", "category": "Backend", "confidence": 0.88, "evidence": "package.json engine field" }
  ],
  "what_it_does": "A concise 1-2 sentence explanation of what this project actually does from an end-user perspective.",
  "highlights": {
    "purpose": "The main goal or problem this repository solves.",
    "strengths": "The most notable technical strengths visible from the metadata.",
    "use_cases": "Who would use this and in what context.",
    "repository_activity": "Observations about stars, forks, recency, and overall activity level."
  },
  "overall_confidence": 0.87,
  "confidence_label": "High"
}`;

function buildUserPrompt(repo) {
  const topics = Array.isArray(repo.topics)
    ? repo.topics.join(', ')
    : (repo.topics ? JSON.parse(repo.topics).join(', ') : 'None');

  const readme = repo.readme_content
    ? repo.readme_content.slice(0, 2000)
    : 'No README available';

  return `Repository: ${repo.name}
Description: ${repo.description || 'No description provided'}
Primary Language: ${repo.primary_language || 'Unknown'}
Topics/Tags: ${topics || 'None'}
Stars: ${repo.stars_count}
Forks: ${repo.forks_count}

README (first 2000 chars):
${readme}`;
}

async function analyzeRepository(repo) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: buildUserPrompt(repo) },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  const raw = response.choices[0].message.content;
  return JSON.parse(raw);
}

const NARRATIVE_SYSTEM_PROMPT = `You are a technical portfolio writer creating first-person developer portfolio content.

ABSOLUTE RULES — THESE OVERRIDE EVERYTHING ELSE:
1. DO NOT mention any repository names anywhere in headline or narrative.
2. DO NOT mention any project names anywhere in headline or narrative.
3. DO NOT describe individual projects in the narrative.
4. Summarize capabilities ACROSS ALL repositories — write about the developer, not the projects.
5. The narrative must read like a LinkedIn About section or professional developer bio.
6. Narrative maximum: 250 words. Reject your own output if it exceeds this.

Write exclusively in first person. Never use "This developer...", "The candidate...", or any third-person phrasing.

The repository data is background research only. Extract what the developer knows and can do — then discard the project names and write about the person.

=== HEADLINE RULES ===
- A concise professional title, NOT a sentence
- Maximum 60–80 characters
- LinkedIn-style title case, pipe separators where appropriate
- Role type and technology domains only
- NEVER: project names, repo names, "I build...", first-person sentences
- Examples:
    "Full-Stack Engineer | AI, APIs & Automation"
    "AI & Full-Stack Developer"
    "Backend & AI Engineer | Python, Node.js & React"
    "Software Engineer | AI-Powered Applications"

=== NARRATIVE RULES ===
- 150–250 words. Hard cap: 250 words.
- 2–3 paragraphs structured as:
    Paragraph 1: who the developer is, specialization, engineering focus
    Paragraph 2: technology stack and problem types — synthesized across all work, no per-project breakdown
    Paragraph 3 (optional): engineering approach, professional goals
- NEVER include:
    * Repository names or GitHub project names
    * "In [project]..." / "This repository..." / "Project X demonstrates..."
    * Architecture layer counts ("3-layer", "5-phase", "cross-phase")
    * Analysis terminology ("inference engine", "Phase 5", "maturity score", "confidence score")
    * Stars, forks, or any repository metrics
    * Per-project walkthroughs

=== CORRECT NARRATIVE EXAMPLE ===
"I am a software engineer with hands-on experience building AI-powered applications, production backend APIs, and full-stack systems. I specialize in designing and shipping end-to-end software solutions that integrate large language models, automate workflows, and solve real business problems at scale.

My technical work spans backend engineering with Node.js and Python, frontend development with React and TypeScript, AI integration using OpenAI and LLM APIs, database design with PostgreSQL, and containerized deployment with Docker and cloud platforms. I apply engineering practices including RESTful API design, asynchronous processing, data modeling, and CI/CD pipeline management to build systems that are reliable and maintainable in production.

I approach software development by focusing on clean architecture, thoughtful system design, and practical problem-solving. I am comfortable working across the full stack — from database schema to frontend UI — and I take ownership of the entire software lifecycle from design through deployment. I am looking to contribute to teams building ambitious products where engineering quality and product impact matter."

=== PROJECT ONE-LINERS ===
- For each project, write ONE sentence (max ~25 words) describing its USE CASE — the real-world problem it solves or who it's for — grounded in the provided "useCase" reference text, in your own words.
- Do NOT copy the reference text verbatim, and do NOT write a tech-stack recap (e.g. avoid "An X-powered application spanning N layers"). A recruiter reading it should understand what the project DOES, not what it's built with.

=== SKILLS AND SIGNALS ===
- top_skills: deduplicate across repos, rank by confidence descending, max 10
- engineering_strengths: 4–8 strengths evidenced by the analysis — only include what is clearly present
- career_signals: score 1–5 per domain, only include score >= 2: AI Engineering, Backend Engineering, System Design, Frontend Engineering, DevOps, Security, Data Engineering

PROHIBITED PHRASES (reject if present):
"strong software engineering skills" / "demonstrates strong" / "passionate about" / "solid foundation" / any repo or project name in headline or narrative

Return ONLY valid JSON with this exact structure:
{
  "headline": "Concise LinkedIn-style professional title, 60–80 chars max, NOT a sentence.",
  "narrative": "2–3 paragraph first-person About Me. Developer-focused. No repo or project names. 150–250 words.",
  "top_skills": [
    { "name": "React", "category": "Frontend", "confidence": 0.94 }
  ],
  "projects": [
    { "repoName": "my-app", "oneLiner": "One sentence on what this project does and who it's for — not a tech-stack recap." }
  ],
  "engineering_strengths": ["AI Integration", "Backend API Development", "System Architecture"],
  "career_signals": [
    { "domain": "AI Engineering", "score": 5 },
    { "domain": "Backend Engineering", "score": 4 }
  ]
}`;

function buildNarrativeUserPrompt(analyses) {
  const bulletList = arr => (Array.isArray(arr) ? arr : []).map(x => `  - ${x}`).join('\n') || '  - None';

  // Build a scrubber that strips every known repo name from a string.
  // Intelligence data was generated with project context and may embed repo names.
  const repoNames = analyses.map(a => a.repoName).filter(Boolean);
  function scrub(text) {
    if (!text || typeof text !== 'string') return text;
    let out = text;
    repoNames.forEach(name => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(escaped, 'gi'), 'this project');
    });
    return out;
  }
  const scrubList = arr => (Array.isArray(arr) ? arr : []).map(scrub);

  // ── Aggregate capability signals — repo names scrubbed, none in this section ─

  const techMap = new Map();
  analyses.forEach(a => {
    (a.technologies || []).forEach(t => {
      const existing = techMap.get(t.name);
      if (!existing || existing.confidence < t.confidence) techMap.set(t.name, t);
    });
  });
  const techList = [...techMap.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .map(t => `  - ${t.name} (${t.category})`).join('\n') || '  - None detected';

  const strengthSet = new Set();
  const impactList  = [];
  const domainSet   = new Set();
  const levelSet    = new Set();
  const roleSet     = new Set();
  const capList     = [];

  analyses.forEach(a => {
    const intel = a.intelligence;
    const pn    = intel?.portfolioNarrative;
    const bv    = intel?.businessValue;
    const res   = intel?.resume;

    scrubList(pn?.technicalDifferentiation || []).forEach(s => strengthSet.add(s));
    scrubList(a.inference?.strengths || []).forEach(s => strengthSet.add(s));
    scrubList(res?.impactStatements || []).forEach(s => impactList.push(s));
    scrubList(bv?.operationalCapabilities || []).slice(0, 3).forEach(c => capList.push(c));

    if (bv?.probableDomain) domainSet.add(bv.probableDomain);
    if (a.inference?.overallAssessment?.engineeringLevel) levelSet.add(a.inference.overallAssessment.engineeringLevel);
    if (res?.suggestedTitle) roleSet.add(res.suggestedTitle);
  });

  const narrativeContext = `=== DEVELOPER CAPABILITY PROFILE ===
This section contains NO repository names. Use ONLY this section to write the "headline" and "narrative" fields.
Synthesize these signals into a cohesive first-person developer bio. Do NOT describe individual projects.

Core Technologies:
${techList}

Engineering Strengths:
${bulletList([...strengthSet].slice(0, 15))}

Role Signals:
${bulletList([...roleSet])}

Business Domains:
${bulletList([...domainSet])}

Engineering Level:
${bulletList([...levelSet])}

Impact Signals:
${bulletList(impactList.slice(0, 10))}

Operational Capabilities:
${bulletList(capList.slice(0, 10))}`;

  // ── Per-project data — repo names present here for the "projects" array ONLY ─
  // whatItDoes (from the basic analysis pipeline's own LLM call, which reads
  // the actual repo) comes first — it's genuine purpose-aware text.
  // hookSentence is a deterministic template ("A Next.js-powered
  // application spanning N architectural layers...") built from structural
  // counts, not prose about what the project does; it's a last-resort
  // fallback only. Getting this backwards was why "oneLiner" values read as
  // generic tech-stack recitations regardless of how accurate detection
  // was — confirmed live. See PROGRESS.md M64.7.
  const projectRows = analyses.map((a, i) => {
    const hook = a.whatItDoes
              || a.intelligence?.portfolioNarrative?.hookSentence
              || 'No description available';
    return `  Project ${i + 1}: repoName="${a.repoName}" | useCase="${hook}"`;
  }).join('\n');

  const projectContext = `=== PROJECT LIST (populate the "projects" array ONLY — do NOT use repoName values in headline or narrative) ===
${projectRows}`;

  return `${narrativeContext}\n\n${projectContext}`;
}

async function generatePortfolioNarrative(analyses) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: NARRATIVE_SYSTEM_PROMPT },
      { role: 'user',   content: buildNarrativeUserPrompt(analyses) },
    ],
    temperature: 0.5,
    max_tokens: 3000,
  });

  const raw = response.choices[0].message.content;
  const result = JSON.parse(raw);

  // The model is instructed to echo repoName per project (see the schema
  // example above and projectContext in buildNarrativeUserPrompt) but
  // doesn't reliably do so — likely bleed-over from the "no repo names in
  // headline or narrative" rule a few lines above it in the same prompt.
  // Downstream rendering (PDF tech stack, bullets, the strengths sentence)
  // depends on repoName to match a project back to its real repo data, so
  // re-attach it deterministically by position rather than trusting the
  // model's free-form field — projects are given to it in this exact order.
  // See PROGRESS.md M61.
  if (Array.isArray(result.projects) && result.projects.length > 0) {
    result.projects = result.projects.map((p, i) => ({
      ...p,
      repoName: analyses[i]?.repoName || p.repoName || null,
    }));
  } else if (analyses.length > 0) {
    // The model occasionally returns otherwise-valid JSON that just omits
    // the "projects" key entirely (not a parse failure — confirmed live,
    // M64.2) — never ship a narrative with zero projects when repos WERE
    // analyzed; fall back to a deterministic array built from the same data
    // given to the prompt.
    result.projects = analyses.map(a => ({
      repoName: a.repoName,
      oneLiner: a.whatItDoes || a.intelligence?.portfolioNarrative?.hookSentence || 'No description available',
    }));
  }

  return result;
}

const README_SYSTEM_PROMPT = `You are a senior technical writer producing a professional README.md that provides genuine recruiter value.

ABSOLUTE RULES — violating any of these will make the README useless:
1. Never write "This repository appears to be...", "It seems like...", or any hedged/speculative language.
2. Never insert placeholder comments like "<!-- update with actual steps -->". If you cannot write a real sentence, omit the section entirely.
3. Never generate an empty section. If the data does not support a section, skip it completely — no heading, no placeholder.
4. Every factual claim must be grounded in the analysis data provided. Do not invent technologies, features, or capabilities.
5. Write with confidence and authority, as if you built the project.
6. Output raw markdown only — no outer code fence wrapping the entire document.

SECTION RULES:
- ## Executive Summary — 2–3 sentences: what it does, who it serves, why it exists. Derived from hook sentence, overview, and business domain.
- ## Business Problem — the concrete challenge being solved. Skip if no domain or problem context is available.
- ## Solution — how the application solves the problem. Use operational capabilities and technical differentiation.
- ## Key Features — bullet list of features with evidence in the analysis. No generic items like "User authentication" unless the auth pattern is explicitly detected.
- ## Architecture Overview — describe frontend, backend, database, and API layers based on detected domains and architecture patterns. Skip tiers not present.
- ## Technology Stack — grouped list of detected technologies only. No invented tools.
- ## Technical Highlights — advanced implementation details drawn from impact statements, architecture patterns, and engineering patterns. Examples: JWT auth, RAG pipeline, event-driven design, CI/CD, containerization. Only include patterns with evidence.
- ## Demonstration — include ONLY if media assets are provided. Embed each as ![label](url). Skip this section entirely if no media.
- ## Installation — include ONLY if primary language and enough structural evidence exists to write real steps. Skip otherwise.
- ## Usage — include ONLY if capabilities support real usage examples. Skip otherwise.

TONE: Professional open-source project. Confident, specific, recruiter-friendly.`;

function buildReadmeUserPrompt(repo, analysis, mediaUrls = []) {
  const techs = (analysis.technologies || [])
    .map(t => `  - ${t.name} (${t.category})`)
    .join('\n');

  const capabilities    = (analysis.operationalCapabilities  || []).slice(0, 6).map(c => `  - ${c}`).join('\n');
  const differentiators = (analysis.technicalDifferentiation || []).slice(0, 5).map(d => `  - ${d}`).join('\n');
  const impacts         = (analysis.impactStatements         || []).slice(0, 5).map(i => `  - ${i}`).join('\n');
  const patterns        = (analysis.patternsInferred         || []).slice(0, 6).map(p => `  - ${p}`).join('\n');
  const architecture    = (analysis.architecturePatterns     || []).slice(0, 8).map(a => `  - ${a}`).join('\n');

  const mediaSection = mediaUrls.filter(m => m.url?.trim()).length > 0
    ? `\nMedia assets (embed in ## Demonstration section):\n${mediaUrls.filter(m => m.url?.trim()).map(m => `  - label: "${m.label || 'Demo'}", url: ${m.url}`).join('\n')}`
    : '\nNo media assets provided — omit the ## Demonstration section entirely.';

  return `Repository: ${repo.name}
Primary language: ${repo.primary_language || 'Unknown'}
Topics/tags: ${Array.isArray(repo.topics) ? repo.topics.join(', ') : (repo.topics || 'None')}
Business domain: ${analysis.probableDomain || 'Not specified'}

--- WHAT IT DOES ---
${analysis.what_it_does || analysis.summary || 'Not specified'}

--- NARRATIVE / HOOK ---
${analysis.highlights?.purpose || analysis.summary || 'Not specified'}

--- OPERATIONAL CAPABILITIES ---
${capabilities || '  - Not specified'}

--- TECHNICAL DIFFERENTIATORS ---
${differentiators || '  - Not specified'}

--- IMPACT STATEMENTS ---
${impacts || '  - Not specified'}

--- INFERRED ENGINEERING PATTERNS ---
${patterns || '  - Not specified'}

--- ARCHITECTURE PATTERNS (detected) ---
${architecture || '  - Not specified'}

--- TECHNOLOGIES DETECTED ---
${techs || '  - None'}
${mediaSection}`;
}

async function generateReadme(repo, analysis, mediaUrls = []) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: README_SYSTEM_PROMPT },
      { role: 'user',   content: buildReadmeUserPrompt(repo, analysis, mediaUrls) },
    ],
    temperature: 0.3,
    max_tokens: 2500,
  });

  return response.choices[0].message.content.trim();
}

const LINKEDIN_EXTRACT_PROMPT = `You are a resume parser. Extract structured professional data from the LinkedIn PDF text provided.

Rules:
- Only extract what is clearly present in the text — do not invent or assume details
- experience bullets: limit to the 3 most impactful per role
- skills: limit to 15 most relevant
- If a section is absent, use an empty array []

Return ONLY valid JSON with this exact structure:
{
  "name": "Full name or null",
  "headline": "Professional headline or null",
  "location": "City, Country or null",
  "email": "Email address if present in the text or null",
  "linkedinUrl": "LinkedIn profile URL if present or null",
  "summary": "About/summary section text or null",
  "experience": [
    {
      "company": "Company name",
      "role": "Job title",
      "startDate": "Month Year or Year",
      "endDate": "Month Year or Year or Present",
      "duration": "e.g. 1 yr 6 mos or null",
      "location": "Location or null",
      "bullets": ["Achievement or responsibility sentence"]
    }
  ],
  "education": [
    {
      "institution": "School or university name",
      "degree": "Degree and field of study",
      "startYear": "Year or null",
      "endYear": "Year or null"
    }
  ],
  "certifications": [
    {
      "name": "Certification or license name",
      "issuer": "Issuing organization",
      "issueDate": "Month Year or Year or null",
      "credentialUrl": "Credential URL if present or null"
    }
  ],
  "skills": ["skill1", "skill2"]
}`;

async function extractLinkedInProfile(rawText) {
  // Truncate to ~6000 chars to stay within token limits — LinkedIn PDFs are typically 2–5K chars
  const text = rawText.slice(0, 6000);
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: LINKEDIN_EXTRACT_PROMPT },
      { role: 'user',   content: text },
    ],
    temperature: 0.1,
    max_tokens: 1500,
  });
  return JSON.parse(response.choices[0].message.content);
}

const PROJECT_DESCRIPTION_SYSTEM_PROMPT = `You are a technical writer creating a professional project description for a developer portfolio. The primary reader is a recruiter or hiring manager — not an engineer doing a code review — so it has to make sense to someone skimming quickly, not just someone fluent in the tech stack.

Based on the structured signals provided, write exactly 2–3 prose paragraphs:
- Paragraph 1: The use case — what real-world problem this solves and who it's for. Lead with this, in plain language. A reader should understand what the project DOES before any technology is named.
- Paragraph 2: How the implementation makes it effective — the specific design decisions that matter, and why they matter (e.g. a queue exists to handle concurrent load, a cache exists to cut response time, an integration exists to keep data in sync). Not an inventory of every technology used.
- Paragraph 3 (only if there is a genuine, evidenced accomplishment or measurable impact in the input — omit otherwise): concrete outcomes or standout capabilities.

Rules:
- Write in third person ("This system..." / "The platform..." / "The application...")
- Lead with the use case, not the tech stack
- Name a technology only when it supports a point about the design — not as a checklist. Keep jargon light; prefer plain descriptions of what something accomplishes over naming every pattern.
- Avoid architecture-report phrasing ("N architectural layers", "M interconnected components", "spans across") — this is a portfolio, not an audit
- Each paragraph: 2–4 sentences
- No bullet points, no section headings — prose only
- Do not open the first sentence with the project name

Return ONLY valid JSON:
{ "description": "Paragraph 1.\\n\\nParagraph 2.\\n\\nParagraph 3." }`;

async function generateProjectDescription({
  repoName, hookSentence, whatItDoes, probableDomain,
  operationalCapabilities, technologies, technicalDifferentiation,
  impactStatements, patternsInferred,
}) {
  // whatItDoes (genuine LLM read of the actual repo) leads; hookSentence
  // (deterministic tech-stack/layer-count template) is only a fallback when
  // no real analysis exists yet. Reversed before — see PROGRESS.md M64.7.
  const input = [
    `Project: ${repoName}`,
    (whatItDoes || hookSentence) ? `What it does: ${whatItDoes || hookSentence}` : null,
    probableDomain             ? `Business domain: ${probableDomain}` : null,
    operationalCapabilities?.length ? `Capabilities: ${operationalCapabilities.slice(0, 5).join('; ')}` : null,
    technologies?.length       ? `Technologies: ${technologies.slice(0, 12).join(', ')}` : null,
    technicalDifferentiation?.length ? `Technical strengths: ${technicalDifferentiation.slice(0, 4).join('; ')}` : null,
    impactStatements?.length   ? `Impact: ${impactStatements.slice(0, 4).join('; ')}` : null,
    patternsInferred?.length   ? `Engineering patterns: ${patternsInferred.slice(0, 4).join('; ')}` : null,
  ].filter(Boolean).join('\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PROJECT_DESCRIPTION_SYSTEM_PROMPT },
      { role: 'user',   content: input },
    ],
    temperature: 0.4,
    max_tokens: 600,
  });
  const raw = JSON.parse(response.choices[0].message.content);
  return typeof raw.description === 'string' ? raw.description : '';
}

// Case-study generation (M65, versioned M65.1) — the per-project GitHub
// README section structure (Business Problem / Objective / Tools / Workflow /
// Key Insights / Business Impact) ported from legacy/portfolioforge-
// automation's AI path (generateAIProjectContent), NOT its hardcoded
// per-category fallback template engine — that fallback is exactly the kind
// of generic templating M64.7 eliminated elsewhere, so there is no non-AI
// fallback here. If generation fails, the caller simply omits the
// case-study sections.
//
// CASE_STUDY_PROMPT_VERSION is stamped onto every generated case study and
// checked by the caller before reusing repositories.case_study_json. Bump
// this whenever the prompts/output shape below change — every cached row
// then reads as stale on its next publish and regenerates automatically,
// instead of silently sitting on out-of-date content until someone notices
// and runs a manual backfill (the recurring problem M64.3/M64.5's one-off
// backfill scripts existed to paper over for image_url/resume data).
const CASE_STUDY_PROMPT_VERSION = 1;
//
// Colaberry-sourced projects (provider === 'colaberry') have real
// step-by-step project material in readme_content and get a business-case
// framing, matching Kalkidan's tool. GitHub repos don't have that material,
// so they get an engineering-project framing grounded in the same
// whatItDoes/code-intelligence signals generateProjectDescription() uses —
// with an explicit instruction not to invent business impact when the repo
// has none evidenced.
const CASE_STUDY_COLABERRY_SYSTEM_PROMPT = `You are writing a project case-study page for a data analytics portfolio, for a recruiter or hiring manager reading quickly — not a technical reviewer. Base everything ONLY on the provided project material (title, description, and step-by-step project instructions). Do not invent tools, metrics, or outcomes that aren't supported by that material.

Return ONLY valid JSON with this exact shape:
{
  "businessProblem": "2-3 sentences: the real-world business problem this project addresses, in plain language.",
  "objectives": ["3 concise objective bullets"],
  "tools": ["5-8 tools/technologies actually used, from the material"],
  "workflow": ["4-6 concise steps describing how the project was actually carried out"],
  "keyInsights": ["3-4 specific insights or findings — pull real numbers/specifics from the material when present, don't generalize them away"],
  "businessImpact": ["3 concise bullets on the business value this delivers"]
}

Rules:
- Ground every field in the actual project material — no generic filler like "identified meaningful patterns"
- Recruiter-friendly language, minimal jargon
- If the material doesn't support a strong claim, keep the bullet modest rather than inventing one`;

const CASE_STUDY_ENGINEERING_SYSTEM_PROMPT = `You are writing a project case-study page for a software engineering portfolio, for a recruiter or hiring manager reading quickly — not a code reviewer. Base everything ONLY on the provided project signals. Do not invent metrics, users, or outcomes that aren't supported by them.

Return ONLY valid JSON with this exact shape:
{
  "businessProblem": "2-3 sentences: the real problem this application solves and who it's for, in plain language — not a tech-stack recap.",
  "objectives": ["3 concise bullets on what the project set out to do"],
  "tools": ["5-8 core technologies actually used"],
  "workflow": ["4-6 concise steps describing how the system works or was built — plain language, not a code walkthrough"],
  "keyInsights": ["3-4 specific, evidenced technical or design highlights — why a particular decision matters, not a features list"],
  "businessImpact": ["2-3 bullets on the value delivered; if the input has no genuine evidenced impact, describe the capability/skill demonstrated instead of inventing outcomes"]
}

Rules:
- Ground every field in the provided signals — no invented metrics or unsupported claims
- Recruiter-friendly language, minimal jargon — avoid "N architectural layers" style phrasing
- Lead the business problem with the use case, not the technology`;

async function generateProjectCaseStudy({
  repoName, isColaberrySourced, readmeContent,
  whatItDoes, hookSentence, technologies, operationalCapabilities,
  impactStatements, probableDomain,
}) {
  let systemPrompt, input;

  if (isColaberrySourced) {
    systemPrompt = CASE_STUDY_COLABERRY_SYSTEM_PROMPT;
    input = [
      `Project: ${repoName}`,
      readmeContent ? `Project material:\n${readmeContent.slice(0, 8000)}` : null,
    ].filter(Boolean).join('\n\n');
  } else {
    systemPrompt = CASE_STUDY_ENGINEERING_SYSTEM_PROMPT;
    input = [
      `Project: ${repoName}`,
      (whatItDoes || hookSentence) ? `What it does: ${whatItDoes || hookSentence}` : null,
      probableDomain ? `Business domain: ${probableDomain}` : null,
      operationalCapabilities?.length ? `Capabilities: ${operationalCapabilities.slice(0, 5).join('; ')}` : null,
      technologies?.length ? `Technologies: ${technologies.slice(0, 12).join(', ')}` : null,
      impactStatements?.length ? `Impact: ${impactStatements.slice(0, 4).join('; ')}` : null,
      readmeContent ? `README excerpt:\n${readmeContent.slice(0, 4000)}` : null,
    ].filter(Boolean).join('\n');
  }

  if (!input.trim()) return null;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input },
    ],
    temperature: 0.3,
    max_tokens: 900,
  });

  const raw = JSON.parse(response.choices[0].message.content);
  const toArray = v => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()) : [];

  const caseStudy = {
    version: CASE_STUDY_PROMPT_VERSION,
    businessProblem: typeof raw.businessProblem === 'string' ? raw.businessProblem.trim() : '',
    objectives: toArray(raw.objectives),
    tools: toArray(raw.tools),
    workflow: toArray(raw.workflow),
    keyInsights: toArray(raw.keyInsights),
    businessImpact: toArray(raw.businessImpact),
  };

  // Incomplete AI output is treated as failure — the caller omits the
  // case-study sections rather than rendering a half-empty page.
  if (!caseStudy.businessProblem || caseStudy.objectives.length === 0) return null;

  return caseStudy;
}

module.exports = { analyzeRepository, generatePortfolioNarrative, generateReadme, extractLinkedInProfile, generateProjectDescription, generateProjectCaseStudy, CASE_STUDY_PROMPT_VERSION };
