const express   = require('express');
const multer    = require('multer');
const pdfjsLib  = require('pdfjs-dist/legacy/build/pdf.js');
const pool = require('../db/postgres');
const authMiddleware = require('../middleware/authMiddleware');
const { generationLimiter, heavyOperationLimiter } = require('../middleware/rateLimiter');
const { generatePortfolioNarrative, extractLinkedInProfile, generateProjectDescription, generateProjectCaseStudy, CASE_STUDY_PROMPT_VERSION } = require('../services/openai');
const { generatePortfolioPdf } = require('../services/pdfGenerator');
const { registerHeavyTaskHandler, runHeavyTask } = require('../services/heavyTaskQueue');
const { TECH_CATEGORIES, TECH_LABELS } = require('../services/techMaps');
const { publishPortfolioAsGithubRepo, assignProjectFolders } = require('../services/githubPortfolioPublisher');
const { getGithubInfo } = require('../services/githubTokenResolver');
const { getResumeData, saveResumeData, deleteResumeData } = require('../services/resumeDataResolver');

const router = express.Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Extracts all text from a PDF buffer using pdfjs-dist (handles LinkedIn PDFs reliably)
async function extractPdfText(buffer) {
  const loadingTask = pdfjsLib.getDocument({
    data:             new Uint8Array(buffer),
    useWorkerFetch:   false,
    isEvalSupported:  false,
    useSystemFonts:   true,
    disableFontFace:  true,
  });
  const pdf   = await loadingTask.promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(' '));
  }
  return pages.join('\n');
}

// Word count excludes tech-stack names by construction, not by parsing —
// technologies are a separate field (repo.analysis.technologies /
// caseStudy.tools) never embedded in this description string, so a plain
// whitespace word count is already counting prose only.
function truncateWords(text, maxWords) {
  if (!text) return text;
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '…';
}

function generateSlug(title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

// Well-known tech name normalisation map (raw → display)
const TECH_DISPLAY = {
  typescript:'TypeScript', javascript:'JavaScript', python:'Python', java:'Java',
  'c#':'C#', 'c++':'C++', go:'Go', rust:'Rust', ruby:'Ruby', php:'PHP',
  react:'React', vue:'Vue', angular:'Angular', svelte:'Svelte',
  nextjs:'Next.js', nuxtjs:'Nuxt.js', remix:'Remix', astro:'Astro',
  node:'Node.js', nodejs:'Node.js', express:'Express', expressjs:'Express',
  fastapi:'FastAPI', flask:'Flask', django:'Django', rails:'Rails',
  nestjs:'NestJS', spring:'Spring', laravel:'Laravel',
  postgresql:'PostgreSQL', postgres:'PostgreSQL', mysql:'MySQL',
  mongodb:'MongoDB', redis:'Redis', sqlite:'SQLite',
  bigquery:'BigQuery', snowflake:'Snowflake', elasticsearch:'Elasticsearch',
  docker:'Docker', kubernetes:'Kubernetes', terraform:'Terraform',
  aws:'AWS', gcp:'GCP', azure:'Azure',
  openai:'OpenAI', anthropic:'Anthropic', langchain:'LangChain',
  llamaindex:'LlamaIndex', chromadb:'ChromaDB', ollama:'Ollama',
  prisma:'Prisma', sequelize:'Sequelize', typeorm:'TypeORM',
  graphql:'GraphQL', grpc:'gRPC', kafka:'Kafka', rabbitmq:'RabbitMQ',
  tailwind:'Tailwind CSS', bootstrap:'Bootstrap',
  jest:'Jest', pytest:'pytest', cypress:'Cypress',
  stripe:'Stripe', firebase:'Firebase', supabase:'Supabase',
  jwt:'JWT', oauth:'OAuth', clerk:'Clerk',
};

function normalizeTechName(raw) {
  const key = raw.toLowerCase().replace(/[\s._-]/g, '');
  return TECH_DISPLAY[key] || TECH_DISPLAY[raw.toLowerCase()] ||
    raw.charAt(0).toUpperCase() + raw.slice(1);
}

// Merge basic analysis skills_json with deep-analysis intelligence_json.technologies.
// Keeps all skills_json entries (they have confidence/category), then appends any
// additional technologies found only in deep analysis, deduplicated case-insensitively.
// codeIntelJson is deep_analyses.code_intelligence_json — its .technologies field is a
// flat array of raw lowercase strings (e.g. ['typescript','express','openai','sequelize']).
function mergeTechnologies(skillsJson, codeIntelJson) {
  const basic = Array.isArray(skillsJson) ? skillsJson : [];
  const deepNames = Array.isArray(codeIntelJson?.technologies) ? codeIntelJson.technologies : [];
  const basicNamesLower = new Set(basic.map(t => t.name.toLowerCase().replace(/[\s._-]/g, '')));
  const extra = deepNames
    .filter(n => typeof n === 'string' && !basicNamesLower.has(n.toLowerCase().replace(/[\s._-]/g, '')))
    .map(n => ({ name: normalizeTechName(n), category: 'Other' }));
  return [...basic, ...extra];
}

// POST /api/portfolios — create a portfolio with selected repos
router.post('/', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { title, repositoryIds } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'title is required.' },
    });
  }

  if (!Array.isArray(repositoryIds) || repositoryIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'repositoryIds must be a non-empty array.' },
    });
  }

  try {
    const repoCheck = await pool.query(
      `SELECT id FROM repositories WHERE id = ANY($1::uuid[]) AND user_id = $2`,
      [repositoryIds, userId]
    );

    if (repoCheck.rows.length !== repositoryIds.length) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'One or more repositories not found or not owned by you.' },
      });
    }

    const analysisCheck = await pool.query(
      `SELECT DISTINCT repository_id FROM (
         SELECT repository_id FROM analyses
         WHERE repository_id = ANY($1::uuid[]) AND status = 'completed'
         UNION
         SELECT repository_id FROM deep_analyses
         WHERE repository_id = ANY($1::uuid[]) AND status IN ('completed', 'partial')
       ) AS analyzed`,
      [repositoryIds]
    );

    const analyzedIds = analysisCheck.rows.map(r => r.repository_id);
    const unanalyzed = repositoryIds.filter(id => !analyzedIds.includes(id));

    if (unanalyzed.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ANALYSES_INCOMPLETE',
          message: 'All selected repositories must have completed analyses before creating a portfolio.',
          unanalyzedIds: unanalyzed,
        },
      });
    }

    const slug = generateSlug(title.trim());
    const contentJson = { repository_ids: repositoryIds };

    const result = await pool.query(
      `INSERT INTO portfolios (user_id, title, slug, status, visibility, content_json, created_at, updated_at)
       VALUES ($1, $2, $3, 'draft', 'private', $4, NOW(), NOW())
       RETURNING id, title, slug, status, visibility, content_json, created_at`,
      [userId, title.trim(), slug, JSON.stringify(contentJson)]
    );

    const p = result.rows[0];
    return res.status(201).json({
      success: true,
      data: {
        portfolioId:   p.id,
        title:         p.title,
        slug:          p.slug,
        status:        p.status,
        visibility:    p.visibility,
        repositoryIds: p.content_json.repository_ids,
        createdAt:     p.created_at,
      },
    });
  } catch (err) {
    console.error('[portfolios] create error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create portfolio.' } });
  }
});

// GET /api/portfolios — list the authenticated user's portfolios
router.get('/', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;

  try {
    const result = await pool.query(
      `SELECT id, title, slug, status, visibility, content_json, published_at, created_at, updated_at
       FROM portfolios
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );

    const portfolios = result.rows.map(p => ({
      portfolioId:     p.id,
      title:           p.title,
      slug:            p.slug,
      status:          p.status,
      visibility:      p.visibility,
      repositoryCount: (p.content_json?.repository_ids || []).length,
      narrativeStatus: p.content_json?.narrative_status || null,
      publishedAt:     p.published_at,
      createdAt:       p.created_at,
      updatedAt:       p.updated_at,
    }));

    return res.status(200).json({ success: true, data: portfolios });
  } catch (err) {
    console.error('[portfolios] list error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch portfolios.' } });
  }
});

// GET /api/portfolios/public/:slug — no auth, recruiter-facing view
router.get('/public/:slug', async (req, res) => {
  const { slug } = req.params;

  try {
    const portfolioResult = await pool.query(
      `SELECT id, user_id, title, slug, content_json, published_at
       FROM portfolios
       WHERE slug = $1 AND status = 'published' AND visibility = 'public'`,
      [slug]
    );

    if (!portfolioResult.rows[0]) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Portfolio not found.' } });
    }

    const portfolio = portfolioResult.rows[0];
    const repositoryIds = portfolio.content_json?.repository_ids || [];

    const reposResult = await pool.query(
      `SELECT r.id AS repo_id, r.name, r.full_name, r.provider, r.description,
              r.primary_language, r.stars_count, r.forks_count, r.topics, r.image_url,
              a.confidence_score, a.skills_json, a.summary_json,
              da.code_intelligence_json
       FROM repositories r
       LEFT JOIN LATERAL (
         SELECT confidence_score, skills_json, summary_json
         FROM analyses
         WHERE repository_id = r.id AND status = 'completed'
         ORDER BY created_at DESC LIMIT 1
       ) a ON true
       LEFT JOIN LATERAL (
         SELECT code_intelligence_json
         FROM deep_analyses
         WHERE repository_id = r.id AND status IN ('completed', 'partial')
         ORDER BY completed_at DESC LIMIT 1
       ) da ON true
       WHERE r.id = ANY($1::uuid[])`,
      [repositoryIds]
    );

    const repoMedia = portfolio.content_json?.repo_media || {};

    const repos = reposResult.rows.map(r => ({
      name:        r.name,
      fullName:    r.full_name,
      provider:    r.provider,
      description: r.description,
      language:    r.primary_language,
      stars:       r.stars_count,
      forks:       r.forks_count,
      topics:      r.topics,
      // Manually-pasted media wins when set; otherwise fall back to the
      // image auto-captured at Colaberry import time (M64.3).
      gifUrl:      repoMedia[r.repo_id]?.gifUrl || r.image_url || null,
      analysis: r.skills_json ? {
        confidenceScore: r.confidence_score,
        technologies:    mergeTechnologies(r.skills_json, r.code_intelligence_json),
        summary:         r.summary_json?.text,
        whatItDoes:      r.summary_json?.what_it_does,
        highlights:      r.summary_json?.highlights,
        confidenceLabel: r.summary_json?.confidence_label,
      } : null,
    }));

    const narrative = portfolio.content_json?.narrative || {};
    const profile   = portfolio.content_json?.profile   || {};
    const linkedin  = await getResumeData(portfolio.user_id);

    // If this portfolio has been pushed to GitHub (content_json.github_publish,
    // set by POST /:id/publish-github-repo), attach each project's real
    // per-project README URL — reuses the exact same folder-naming logic
    // publishPortfolioAsGithubRepo used when it wrote those files, so the
    // link is guaranteed to point at a real path rather than a guessed one.
    // This is what lets the live page offer "View Full Project" for
    // Colaberry-sourced projects, which never had a real GitHub source repo
    // to link to in the first place. See PROGRESS.md M93.
    const githubPublish = portfolio.content_json?.github_publish || null;
    const assignedFolders = githubPublish ? assignProjectFolders(narrative.projects || []) : [];
    const projectsWithGithubUrl = (narrative.projects || []).map(p => {
      if (!githubPublish) return p;
      const match = assignedFolders.find(a => a.project.repoName === p.repoName);
      if (!match) return p;
      return {
        ...p,
        githubProjectUrl: `https://github.com/${githubPublish.owner}/${githubPublish.repoName}/blob/main/${match.folder}/README.md`,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        title:                portfolio.title,
        slug:                 portfolio.slug,
        headline:             narrative.headline             || null,
        narrative:            narrative.narrative            || null,
        topSkills:            narrative.top_skills           || [],
        projects:             projectsWithGithubUrl,
        careerSignals:        narrative.career_signals        || [],
        profile,
        linkedin,
        publishedAt: portfolio.published_at,
        repos,
      },
    });
  } catch (err) {
    console.error('[portfolios] public get error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch portfolio.' } });
  }
});

// generatePortfolioPdf launches a real headless Chromium (Puppeteer) per
// call — previously invoked directly on the request path with no
// concurrency cap of any kind, unlike the other two Chromium/Playwright
// paths in this app (Colaberry scraping, deep analysis), both of which
// already go through heavyTaskQueue.js specifically to prevent unbounded
// concurrent browser launches on a 2-vCPU/4GB host. This route is also
// public and unauthenticated, so it was reachable by anyone (or any
// crawler) with no rate limit either — the single biggest concurrency risk
// in the app until fixed. Job data here (title, narrative text, tech
// skills, repo names, resume summary) is exactly the public portfolio
// content already about to be sent to the requester as a PDF — not
// secret/session state, unlike the Colaberry live-login job data
// heavyTaskQueue.js's header comment warns about.
// Return value crosses the queue boundary via BullMQ's JSON.stringify/parse
// (heavyTaskQueue.js's job.waitUntilFinished) — a raw Buffer would come
// back as {type:'Buffer', data:[...]} with every byte listed as a separate
// JSON number, so base64-encode here and decode on the route side instead.
registerHeavyTaskHandler('portfolio-pdf', async pdfInput => {
  const pdfData = await generatePortfolioPdf(pdfInput);
  // page.pdf() (Puppeteer) returns a Uint8Array here, not a Node Buffer —
  // Uint8Array.prototype.toString silently ignores a 'base64' argument and
  // falls back to Array.prototype.toString's comma-joined decimal list.
  // Buffer.from() copies either a real Buffer or a Uint8Array correctly.
  return Buffer.from(pdfData).toString('base64');
});

// GET /api/portfolios/public/:slug/pdf — generate and return a PDF resume (no auth)
router.get('/public/:slug/pdf', heavyOperationLimiter, async (req, res) => {
  const { slug } = req.params;

  try {
    const portfolioResult = await pool.query(
      `SELECT id, user_id, title, slug, content_json
       FROM portfolios
       WHERE slug = $1 AND status = 'published' AND visibility = 'public'`,
      [slug]
    );

    if (!portfolioResult.rows[0]) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Portfolio not found.' } });
    }

    const portfolio = portfolioResult.rows[0];
    const repositoryIds = portfolio.content_json?.repository_ids || [];

    const reposResult = await pool.query(
      `SELECT r.id AS repo_id, r.name, r.full_name, r.primary_language,
              a.skills_json, a.summary_json,
              da.intelligence_json, da.inference_json, da.code_intelligence_json
       FROM repositories r
       LEFT JOIN LATERAL (
         SELECT skills_json, summary_json
         FROM analyses
         WHERE repository_id = r.id AND status = 'completed'
         ORDER BY created_at DESC LIMIT 1
       ) a ON true
       LEFT JOIN LATERAL (
         SELECT intelligence_json, inference_json, code_intelligence_json
         FROM deep_analyses
         WHERE repository_id = r.id AND status IN ('completed', 'partial')
         ORDER BY completed_at DESC LIMIT 1
       ) da ON true
       WHERE r.id = ANY($1::uuid[])`,
      [repositoryIds]
    );

    const narrative      = portfolio.content_json?.narrative || {};
    const profile        = portfolio.content_json?.profile   || {};
    const linkedin       = (await getResumeData(portfolio.user_id)) || {};
    const githubUsername = reposResult.rows.find(r => r.full_name)?.full_name?.split('/')?.[0] || null;

    const repos = reposResult.rows.map(r => ({
      name:            r.name,
      fullName:        r.full_name,
      primaryLanguage: r.primary_language,
      analysis: r.skills_json ? {
        technologies: r.skills_json,
        whatItDoes:   r.summary_json?.what_it_does,
        summary:      r.summary_json?.text,
        strengths:    r.summary_json?.highlights?.strengths,
      } : null,
      intelligence:     r.intelligence_json    || null,
      inference:        r.inference_json       || null,
      codeIntelligence: r.code_intelligence_json || null,
    }));

    // Routed through the heavy-task queue (Tier 2) so concurrent PDF
    // requests can't launch unbounded Chromium instances on the host — see
    // the registerHeavyTaskHandler comment above. Shorter timeout than the
    // queue's 10-minute default: this is a synchronous request a browser is
    // waiting on, not a background job — a few seconds normally, capped at
    // 60s even if queued behind another heavy operation.
    const pdfBase64 = await runHeavyTask('portfolio-pdf', {
      title:          portfolio.title,
      headline:       narrative.headline   || null,
      narrative:      narrative.narrative  || null,
      topSkills:      narrative.top_skills || [],
      projects:       narrative.projects   || [],
      careerSignals:  narrative.career_signals || [],
      repos,
      githubUsername,
      profile,
      experience:     linkedin.experience  || [],
      education:      linkedin.education   || [],
      certifications: linkedin.certifications || [],
      resumeSummary:  linkedin.summary || null,
      resumeHeadline: linkedin.headline || null,
    }, { timeoutMs: 60 * 1000 });
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}-resume.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);

  } catch (err) {
    console.error('[portfolios] pdf error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to generate PDF.' } });
  }
});

// GET /api/portfolios/:id — single portfolio with repos and their analyses
router.get('/:id', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { id } = req.params;

  try {
    const portfolioResult = await pool.query(
      `SELECT id, title, slug, status, visibility, content_json, published_at, created_at, updated_at
       FROM portfolios WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (!portfolioResult.rows[0]) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Portfolio not found.' } });
    }

    const portfolio = portfolioResult.rows[0];
    const repositoryIds = portfolio.content_json?.repository_ids || [];

    const reposResult = await pool.query(
      `SELECT r.id AS repo_id, r.name, r.full_name, r.description,
              r.primary_language, r.stars_count, r.topics,
              a.id AS analysis_id, a.status AS analysis_status,
              a.confidence_score, a.skills_json, a.summary_json
       FROM repositories r
       LEFT JOIN LATERAL (
         SELECT id, status, confidence_score, skills_json, summary_json
         FROM analyses
         WHERE repository_id = r.id AND status = 'completed'
         ORDER BY created_at DESC LIMIT 1
       ) a ON true
       WHERE r.id = ANY($1::uuid[]) AND r.user_id = $2`,
      [repositoryIds, userId]
    );

    const repos = reposResult.rows.map(r => ({
      repositoryId: r.repo_id,
      name:         r.name,
      fullName:     r.full_name,
      description:  r.description,
      language:     r.primary_language,
      stars:        r.stars_count,
      topics:       r.topics,
      analysis: r.analysis_id ? {
        analysisId:      r.analysis_id,
        status:          r.analysis_status,
        confidenceScore: r.confidence_score,
        technologies:    r.skills_json,
        summary:         r.summary_json?.text,
        whatItDoes:      r.summary_json?.what_it_does,
        highlights:      r.summary_json?.highlights,
        confidenceLabel: r.summary_json?.confidence_label,
      } : null,
    }));

    return res.status(200).json({
      success: true,
      data: {
        portfolioId:     portfolio.id,
        title:           portfolio.title,
        slug:            portfolio.slug,
        status:          portfolio.status,
        visibility:      portfolio.visibility,
        narrative:       portfolio.content_json?.narrative  || null,
        narrativeStatus: portfolio.content_json?.narrative_status || null,
        profile:         portfolio.content_json?.profile    || {},
        linkedin:        await getResumeData(userId),
        repoMedia:       portfolio.content_json?.repo_media || {},
        publishedAt:     portfolio.published_at,
        createdAt:       portfolio.created_at,
        updatedAt:       portfolio.updated_at,
        repos,
      },
    });
  } catch (err) {
    console.error('[portfolios] get error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch portfolio.' } });
  }
});

// POST /api/portfolios/:id/generate-narrative — trigger AI narrative generation
router.post('/:id/generate-narrative', authMiddleware, generationLimiter, async (req, res) => {
  const { id: userId } = req.user;
  const { id } = req.params;

  try {
    const portfolioResult = await pool.query(
      `SELECT id, content_json FROM portfolios WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (!portfolioResult.rows[0]) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Portfolio not found.' } });
    }

    const portfolio = portfolioResult.rows[0];
    const repositoryIds = portfolio.content_json?.repository_ids || [];

    if (repositoryIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_REPOS', message: 'Portfolio has no repositories.' },
      });
    }

    const reposResult = await pool.query(
      `SELECT r.name, r.description, r.primary_language,
              a.skills_json, a.summary_json,
              da.inference_json, da.intelligence_json, da.code_intelligence_json
       FROM repositories r
       LEFT JOIN LATERAL (
         SELECT skills_json, summary_json
         FROM analyses
         WHERE repository_id = r.id AND status = 'completed'
         ORDER BY created_at DESC LIMIT 1
       ) a ON true
       LEFT JOIN LATERAL (
         SELECT inference_json, intelligence_json, code_intelligence_json
         FROM deep_analyses
         WHERE repository_id = r.id AND status IN ('completed', 'partial')
         ORDER BY completed_at DESC LIMIT 1
       ) da ON true
       WHERE r.id = ANY($1::uuid[]) AND r.user_id = $2
         AND (a.skills_json IS NOT NULL OR da.intelligence_json IS NOT NULL)`,
      [repositoryIds, userId]
    );

    if (reposResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_ANALYSES', message: 'No completed analyses found for this portfolio. Run deep analysis on your repos first.' },
      });
    }

    // Mark as generating immediately so the frontend can start polling
    const updatedContent = {
      ...portfolio.content_json,
      narrative_status: 'generating',
    };

    await pool.query(
      `UPDATE portfolios SET content_json = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updatedContent), id]
    );

    // Build input for narrative generation — uses deep analysis when available, falls back to basic
    const analyses = reposResult.rows.map(r => ({
      repoName:     r.name,
      whatItDoes:   r.summary_json?.what_it_does
                      || r.intelligence_json?.executiveSummary?.overview
                      || '',
      technologies: r.skills_json
                      || (r.code_intelligence_json?.technologies || []).map(t => ({ name: t, category: 'Other', confidence: 1 })),
      inference:    r.inference_json    || null,
      intelligence: r.intelligence_json || null,
    }));

    // Run generation in background — non-blocking
    setImmediate(async () => {
      try {
        const result = await generatePortfolioNarrative(analyses);

        // Override AI top_skills with deterministic aggregation from code_intelligence_json
        const techMap = new Map();
        for (const row of reposResult.rows) {
          const ci = row.code_intelligence_json;
          for (const t of [...(ci?.technologies || []), ...(ci?.frameworks || [])]) {
            if (!TECH_CATEGORIES[t]) continue;
            const label = TECH_LABELS[t] || (t.charAt(0).toUpperCase() + t.slice(1));
            if (!techMap.has(label)) {
              techMap.set(label, { name: label, category: TECH_CATEGORIES[t], confidence: 0.9 });
            }
          }
        }
        for (const row of reposResult.rows) {
          if (row.primary_language) {
            const lang = row.primary_language;
            if (!techMap.has(lang)) {
              techMap.set(lang, { name: lang, category: 'Languages', confidence: 1.0 });
            }
          }
        }
        result.top_skills = [...techMap.values()].sort((a, b) => b.confidence - a.confidence);

        const completedContent = {
          ...updatedContent,
          narrative:        result,
          narrative_status: 'completed',
        };

        await pool.query(
          `UPDATE portfolios SET content_json = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(completedContent), id]
        );

        console.log(`[portfolios] narrative completed for portfolio ${id}`);
      } catch (err) {
        console.error(`[portfolios] narrative failed for portfolio ${id}:`, err.message);

        const failedContent = { ...updatedContent, narrative_status: 'failed' };
        await pool.query(
          `UPDATE portfolios SET content_json = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(failedContent), id]
        );
      }
    });

    return res.status(202).json({
      success: true,
      data: { portfolioId: id, narrativeStatus: 'generating' },
    });
  } catch (err) {
    console.error('[portfolios] generate-narrative error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to start narrative generation.' } });
  }
});

// PATCH /api/portfolios/:id — update editable fields: narrative content + profile
router.patch('/:id', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { id } = req.params;
  const { headline, narrative, top_skills, projects, profile, repository_ids } = req.body;

  const hasNarrativeField = headline !== undefined || narrative !== undefined
    || top_skills !== undefined || projects !== undefined;
  const hasProfileField    = profile !== undefined;
  const hasRepoIds         = repository_ids !== undefined;

  if (!hasNarrativeField && !hasProfileField && !hasRepoIds) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Provide at least one field to update.' },
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, content_json FROM portfolios WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Portfolio not found.' } });
    }

    const current = result.rows[0].content_json;

    // Deep-merge only the supplied narrative fields — untouched fields are preserved
    const updatedNarrative = {
      ...(current?.narrative || {}),
      ...(headline   !== undefined && { headline }),
      ...(narrative  !== undefined && { narrative }),
      ...(top_skills !== undefined && { top_skills }),
      ...(projects   !== undefined && { projects }),
    };

    // Merge profile — overwrite only supplied keys
    const updatedProfile = hasProfileField
      ? { ...(current?.profile || {}), ...profile }
      : (current?.profile || {});

    const updatedRepoIds = hasRepoIds ? repository_ids : (current?.repository_ids || []);
    const updatedContent = {
      ...current,
      narrative:      updatedNarrative,
      profile:        updatedProfile,
      repository_ids: updatedRepoIds,
    };

    await pool.query(
      `UPDATE portfolios SET content_json = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updatedContent), id]
    );

    return res.status(200).json({
      success: true,
      data: { portfolioId: id, narrative: updatedNarrative, profile: updatedProfile, repository_ids: updatedRepoIds },
    });
  } catch (err) {
    console.error('[portfolios] patch error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update portfolio.' } });
  }
});

// PATCH /api/portfolios/:id/media — save per-repo GIF/image URLs
router.patch('/:id/media', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { id } = req.params;
  const { repoMedia } = req.body; // { [repoId]: { gifUrl: '...' } }

  if (!repoMedia || typeof repoMedia !== 'object') {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'repoMedia must be an object.' } });
  }

  try {
    const result = await pool.query(
      `SELECT id, content_json FROM portfolios WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Portfolio not found.' } });
    }

    const updated = { ...result.rows[0].content_json, repo_media: repoMedia };
    await pool.query(
      `UPDATE portfolios SET content_json = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updated), id]
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[portfolios] media update error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to save media.' } });
  }
});

// PATCH /api/portfolios/:id/publish — publish portfolio and make it public
router.patch('/:id/publish', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const { id } = req.params;

  try {
    const portfolioResult = await pool.query(
      `SELECT id, slug, content_json FROM portfolios WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (!portfolioResult.rows[0]) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Portfolio not found.' } });
    }

    const portfolio = portfolioResult.rows[0];
    const narrativeStatus = portfolio.content_json?.narrative_status;

    if (narrativeStatus !== 'completed') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NARRATIVE_REQUIRED',
          message: 'Narrative generation must be completed before publishing. Current status: ' + (narrativeStatus || 'not started'),
        },
      });
    }

    // Publishing makes this publicly visible — a portfolio can sit as a draft
    // without a name while still being built, but it can't go live without
    // one (pdfGenerator/PublicPortfolio both fall back to the portfolio
    // title, e.g. "My Portfolio", as the displayed person's name otherwise).
    if (!portfolio.content_json?.profile?.fullName?.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PROFILE_INCOMPLETE',
          message: 'Add your name in the profile section before publishing.',
        },
      });
    }

    await pool.query(
      `UPDATE portfolios
       SET status = 'published', visibility = 'public', published_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    return res.status(200).json({
      success: true,
      data: {
        portfolioId: id,
        slug:        portfolio.slug,
        status:      'published',
        visibility:  'public',
        publicUrl:   `${process.env.FRONTEND_URL || 'http://localhost:5173'}/portfolio/${portfolio.slug}`,
      },
    });
  } catch (err) {
    console.error('[portfolios] publish error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to publish portfolio.' } });
  }
});

// POST /api/portfolios/:id/publish-github-repo — publish this portfolio as a
// GitHub repo of markdown (ported from Portfolioforge, see M47.1/M52). One-way
// terminal export only — reuses the user's own GitHub OAuth token (already
// has `repo` scope), never Portfolioforge's separate/retired OAuth flow.
// Idempotent: re-running with the same repoName upserts the same repo/files
// rather than creating a duplicate.
router.post('/:id/publish-github-repo', authMiddleware, generationLimiter, async (req, res) => {
  const { id: userId } = req.user;
  const { id } = req.params;
  const { repoName } = req.body;

  if (!repoName || typeof repoName !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(repoName)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'repoName is required and may only contain letters, numbers, dots, underscores, and hyphens.' },
    });
  }

  try {
    const { github_username: owner, github_access_token: token } = await getGithubInfo(userId);
    if (!owner || !token) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_GITHUB_CONNECTED', message: 'Connect your GitHub account before publishing.' },
      });
    }

    const portfolioResult = await pool.query(
      'SELECT id, content_json FROM portfolios WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (!portfolioResult.rows[0]) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Portfolio not found.' } });
    }

    const narrative = portfolioResult.rows[0].content_json?.narrative;
    if (!narrative) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_NARRATIVE', message: 'Generate the portfolio narrative before publishing.' },
      });
    }
    const profile = portfolioResult.rows[0].content_json?.profile || {};
    if (!profile?.fullName?.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'PROFILE_INCOMPLETE', message: 'Add your name in the profile section before publishing.' },
      });
    }

    const resumeDataForPublish = await getResumeData(userId);
    const resumeSummary  = resumeDataForPublish?.summary  || null;
    const resumeHeadline = resumeDataForPublish?.headline || null;

    // Resolve each project's uploaded media (repo_media, keyed by repo id) to
    // a repoName -> imageUrl map so the README can show real project images,
    // same source PublicPortfolio.jsx already uses for the public page.
    const repositoryIds = portfolioResult.rows[0].content_json?.repository_ids || [];
    const repoMedia = portfolioResult.rows[0].content_json?.repo_media || {};
    let projectImages = {};
    if (repositoryIds.length > 0) {
      const reposResult = await pool.query(
        'SELECT id, name, image_url FROM repositories WHERE id = ANY($1::uuid[])',
        [repositoryIds]
      );
      // Manually-pasted media (repo_media) wins when set; otherwise fall back
      // to the image auto-captured at Colaberry import time (M64.3).
      projectImages = Object.fromEntries(
        reposResult.rows
          .map(r => [r.name, repoMedia[r.id]?.gifUrl || r.image_url || null])
          .filter(([, url]) => url)
      );
    }

    // Resolve per-project case studies (Business Problem/Objective/Workflow/
    // Key Insights/Business Impact) for the project-*/README.md pages (M65).
    // Cached on repositories.case_study_json so republishing an unchanged
    // project doesn't re-call OpenAI every time.
    let caseStudies = {};
    if (repositoryIds.length > 0) {
      const caseStudyRepos = await pool.query(
        `SELECT r.id AS repo_id, r.name, r.provider, r.description AS repo_description,
                r.readme_content, r.case_study_json,
                a.summary_json,
                da.intelligence_json,
                da.code_intelligence_json
         FROM repositories r
         LEFT JOIN LATERAL (
           SELECT summary_json FROM analyses
           WHERE repository_id = r.id AND status = 'completed'
           ORDER BY created_at DESC LIMIT 1
         ) a ON true
         LEFT JOIN LATERAL (
           SELECT intelligence_json, code_intelligence_json FROM deep_analyses
           WHERE repository_id = r.id AND status IN ('completed', 'partial')
           ORDER BY completed_at DESC LIMIT 1
         ) da ON true
         WHERE r.id = ANY($1::uuid[]) AND r.user_id = $2`,
        [repositoryIds, userId]
      );

      await Promise.all(caseStudyRepos.rows.map(async r => {
        // A cached case study only counts as fresh if it was generated by
        // the current prompt version — otherwise treat it the same as
        // missing and regenerate. This is what lets a future prompt change
        // (bumping CASE_STUDY_PROMPT_VERSION) reach every already-published
        // project automatically on its next publish, with no manual
        // backfill script (M65.1).
        if (r.case_study_json && r.case_study_json.version === CASE_STUDY_PROMPT_VERSION) {
          caseStudies[r.name] = r.case_study_json;
          return;
        }
        try {
          const intel = r.intelligence_json;
          const codeIntel = r.code_intelligence_json;
          const caseStudy = await generateProjectCaseStudy({
            repoName: r.name,
            isColaberrySourced: r.provider === 'colaberry',
            readmeContent: r.readme_content || '',
            whatItDoes: r.summary_json?.what_it_does || '',
            hookSentence: intel?.portfolioNarrative?.hookSentence || r.repo_description || '',
            technologies: codeIntel?.technologies || [],
            operationalCapabilities: intel?.businessValue?.operationalCapabilities || [],
            impactStatements: intel?.resume?.impactStatements || [],
            probableDomain: intel?.businessValue?.probableDomain || '',
          });
          if (caseStudy) {
            caseStudies[r.name] = caseStudy;
            await pool.query('UPDATE repositories SET case_study_json = $1 WHERE id = $2', [JSON.stringify(caseStudy), r.repo_id]);
          }
        } catch (err) {
          console.error(`[portfolios] case study generation failed for ${r.name}:`, err.message);
        }
      }));
    }

    const { repoUrl, created, projectsSynced, projectsRemoved } = await publishPortfolioAsGithubRepo({
      token, owner, repoName, narrative, profile, resumeSummary, resumeHeadline, projectImages, caseStudies,
    });

    // Previously only returned once in this response and never persisted —
    // the live public portfolio page (a separate, later request) had no way
    // to know a GitHub repo existed at all, so it could never link to it.
    // Stored here so GET /public/:slug can build per-project "View Full
    // Project" links (see below) any time after this publish, not just in
    // the moment right after clicking the button. See PROGRESS.md M93.
    await pool.query(
      `UPDATE portfolios SET content_json = jsonb_set(content_json, '{github_publish}', $1::jsonb), updated_at = NOW() WHERE id = $2`,
      [JSON.stringify({ owner, repoName }), id]
    );

    return res.status(200).json({ success: true, data: { repoUrl, created, projectsSynced, projectsRemoved } });
  } catch (err) {
    const status = err.response?.status === 422 ? 409 : 500;
    console.error('[portfolios] publish-github-repo error:', err.message);
    return res.status(status).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/portfolios/:id/generate-project-descriptions
// Generates rich 2-4 paragraph descriptions from deep analysis data for each repo in the portfolio.
router.post('/:id/generate-project-descriptions', authMiddleware, generationLimiter, async (req, res) => {
  const { id: userId } = req.user;
  const { id } = req.params;

  try {
    const portfolioResult = await pool.query(
      `SELECT id, content_json FROM portfolios WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (!portfolioResult.rows[0]) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Portfolio not found.' } });
    }

    const portfolio      = portfolioResult.rows[0];
    const repositoryIds  = portfolio.content_json?.repository_ids || [];
    const existingProjects = portfolio.content_json?.narrative?.projects || [];

    const reposResult = await pool.query(
      `SELECT r.id AS repo_id, r.name, r.description AS repo_description,
              a.summary_json,
              da.intelligence_json,
              da.code_intelligence_json,
              da.inference_json
       FROM repositories r
       LEFT JOIN LATERAL (
         SELECT summary_json FROM analyses
         WHERE repository_id = r.id AND status = 'completed'
         ORDER BY created_at DESC LIMIT 1
       ) a ON true
       LEFT JOIN LATERAL (
         SELECT intelligence_json, code_intelligence_json, inference_json
         FROM deep_analyses
         WHERE repository_id = r.id AND status IN ('completed', 'partial')
         ORDER BY completed_at DESC LIMIT 1
       ) da ON true
       WHERE r.id = ANY($1::uuid[]) AND r.user_id = $2`,
      [repositoryIds, userId]
    );

    const updatedProjects = await Promise.all(reposResult.rows.map(async r => {
      const existing  = existingProjects.find(p => p.repoName === r.name) || { repoName: r.name };
      const intel     = r.intelligence_json;
      const codeIntel = r.code_intelligence_json;
      const inference = r.inference_json;

      const projectData = {
        repoName:                 r.name,
        hookSentence:             intel?.portfolioNarrative?.hookSentence || r.repo_description || '',
        whatItDoes:               r.summary_json?.what_it_does || '',
        probableDomain:           intel?.businessValue?.probableDomain || '',
        operationalCapabilities:  intel?.businessValue?.operationalCapabilities || [],
        technologies:             codeIntel?.technologies || [],
        technicalDifferentiation: intel?.portfolioNarrative?.technicalDifferentiation || [],
        impactStatements:         intel?.resume?.impactStatements || [],
        patternsInferred:         inference?.patternsInferred || [],
      };

      // Always generate — repo name alone is enough for a basic description
      let description = existing.description || '';
      try {
        description = await generateProjectDescription(projectData);
      } catch (err) {
        console.error(`[generate-project-descriptions] ${r.name}:`, err.message);
      }

      // Hard safety net behind the prompt's own 100-word instruction — models
      // don't always obey a word count exactly. Truncated once here, at the
      // single point every consumer (public portfolio page, GitHub-published
      // README, the per-project README) reads content_json.narrative.projects
      // from — so all three are guaranteed to show the same capped text
      // rather than each needing its own truncation logic. The full
      // "View Details"/case-study content elsewhere is unaffected.
      return { ...existing, description: truncateWords(description, 100) };
    }));

    const updatedNarrative = {
      ...(portfolio.content_json?.narrative || {}),
      projects: updatedProjects,
    };
    const updatedContent = { ...portfolio.content_json, narrative: updatedNarrative };

    await pool.query(
      `UPDATE portfolios SET content_json = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updatedContent), id]
    );

    console.log(`[portfolios] project descriptions generated for portfolio ${id}`);
    return res.status(200).json({ success: true, data: { projects: updatedProjects } });
  } catch (err) {
    console.error('[portfolios] generate-project-descriptions error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to generate project descriptions.' } });
  }
});

// DELETE /api/portfolios/resume-data — permanently remove the user's stored
// LinkedIn/resume data (M64.2). Single record, so this removes it from every
// portfolio's view in one call — there's nothing left duplicated elsewhere.
router.delete('/resume-data', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  try {
    await deleteResumeData(userId);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[resume-data] delete error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to delete resume data.' } });
  }
});

// POST /api/portfolios/extract-linkedin — upload PDF, extract profile fields, return JSON (no DB save)
router.post('/extract-linkedin', authMiddleware, generationLimiter, upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No PDF file uploaded.' } });
  }
  const originalName = req.file.originalname?.toLowerCase() || '';
  const allowedTypes = ['application/pdf', 'application/octet-stream', 'binary/octet-stream'];
  if (!allowedTypes.includes(req.file.mimetype) && !originalName.endsWith('.pdf')) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_FILE', message: 'Please upload a PDF file.' } });
  }

  let rawText = '';
  try {
    rawText = (await extractPdfText(req.file.buffer)).trim();
  } catch (err) {
    return res.status(422).json({ success: false, error: { code: 'PARSE_FAILED', message: 'Could not read the PDF. Use LinkedIn → Me → Save to PDF.' } });
  }
  if (rawText.length < 50) {
    return res.status(422).json({ success: false, error: { code: 'EMPTY_PDF', message: 'No text found. Use LinkedIn "Save to PDF" from your profile page.' } });
  }

  try {
    const extracted = await extractLinkedInProfile(rawText);
    return res.json({ success: true, data: extracted });
  } catch (err) {
    console.error('[extract-linkedin] OpenAI error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'EXTRACTION_FAILED', message: 'AI extraction failed. Please try again.' } });
  }
});

// POST /api/portfolios/:id/linkedin-pdf — upload LinkedIn PDF, extract and store experience
router.post('/:id/linkedin-pdf', authMiddleware, generationLimiter, upload.single('pdf'), async (req, res) => {
  const { id: userId } = req.user;
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No PDF file uploaded.' } });
  }

  // Accept application/pdf and application/octet-stream (some OS/browsers send the latter for PDFs)
  const allowedTypes = ['application/pdf', 'application/octet-stream', 'binary/octet-stream'];
  const originalName = req.file.originalname?.toLowerCase() || '';
  const isPdf = allowedTypes.includes(req.file.mimetype) || originalName.endsWith('.pdf');
  if (!isPdf) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_FILE', message: 'Please upload a PDF file.' } });
  }

  // ── Step 1: Confirm the portfolio exists and belongs to this user ──────────
  try {
    const result = await pool.query(
      `SELECT id FROM portfolios WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Portfolio not found.' } });
    }
  } catch (err) {
    console.error('[linkedin-pdf] DB load error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Database error loading portfolio.' } });
  }

  // ── Step 2: Parse PDF text ─────────────────────────────────────────────────
  let rawText = '';
  try {
    console.log('[linkedin-pdf] parsing PDF — size:', req.file.size, 'bytes, mimetype:', req.file.mimetype);
    rawText = (await extractPdfText(req.file.buffer)).trim();
    console.log('[linkedin-pdf] extracted text length:', rawText.length, 'chars');
  } catch (err) {
    console.error('[linkedin-pdf] pdf extraction error:', err.message);
    return res.status(422).json({ success: false, error: { code: 'PARSE_FAILED', message: 'Could not read the PDF. Make sure you are uploading a LinkedIn "Save to PDF" file, not the data export ZIP.' } });
  }

  if (rawText.length < 50) {
    return res.status(422).json({ success: false, error: { code: 'EMPTY_PDF', message: 'No readable text found in this PDF. LinkedIn "Save to PDF" (from your profile page) works best. Data export ZIPs are not supported.' } });
  }

  // ── Step 3: Extract structured data with OpenAI ────────────────────────────
  let extracted;
  try {
    extracted = await extractLinkedInProfile(rawText);
    console.log('[linkedin-pdf] OpenAI extraction done — experience:', extracted?.experience?.length ?? 0, 'entries');
  } catch (err) {
    console.error('[linkedin-pdf] OpenAI extraction error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'EXTRACTION_FAILED', message: 'AI extraction failed. Please try again in a moment.' } });
  }

  // ── Step 4: Save to the user's encrypted resume-data record (M64.2) ────────
  // Stored once per user, not per portfolio — every portfolio (this one and
  // any future one) reads the same record via getResumeData(), so uploading
  // here updates it everywhere at once instead of leaving stale copies.
  try {
    await saveResumeData(userId, extracted);
    console.log(`[linkedin-pdf] resume data saved for user ${userId} (uploaded via portfolio ${id})`);
    return res.status(200).json({ success: true, data: extracted });
  } catch (err) {
    console.error('[linkedin-pdf] DB save error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SAVE_FAILED', message: 'Extraction succeeded but failed to save. Please try again.' } });
  }
});

module.exports = router;
