const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
- Use the provided "Project Hook" sentence directly — do NOT write generic descriptions

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
    { "repoName": "my-app", "oneLiner": "Use the Project Hook sentence from input when available." }
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
  const projectRows = analyses.map((a, i) => {
    const hook = a.intelligence?.portfolioNarrative?.hookSentence
              || a.whatItDoes
              || 'No description available';
    return `  Project ${i + 1}: repoName="${a.repoName}" | oneLiner="${hook}"`;
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
    max_tokens: 2000,
  });

  const raw = response.choices[0].message.content;
  return JSON.parse(raw);
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

const PROJECT_DESCRIPTION_SYSTEM_PROMPT = `You are a technical writer creating a professional project description for a developer portfolio.

Based on the structured signals provided, write exactly 2–4 prose paragraphs:
- Paragraph 1: What the project does and its primary business value
- Paragraph 2: Engineering architecture — key technical decisions, patterns, complexity
- Paragraph 3: Key accomplishments, standout capabilities, or measurable impact
- Paragraph 4 (only if there is meaningful additional context): Technology stack or deployment highlights

Rules:
- Write in third person ("This system..." / "The platform..." / "The application...")
- Name actual technologies, patterns, and capabilities from the input — do not invent details
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
  const input = [
    `Project: ${repoName}`,
    (hookSentence || whatItDoes) ? `What it does: ${hookSentence || whatItDoes}` : null,
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

module.exports = { analyzeRepository, generatePortfolioNarrative, generateReadme, extractLinkedInProfile, generateProjectDescription };
