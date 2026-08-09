# PROGRESS.md
**Repo2Reputation — Authoritative Repository Development Ledger**

---

## Project Overview

**Repo2Reputation** is a full-stack SaaS application that converts GitHub repositories into AI-powered recruiter portfolios. It ingests GitHub repos, runs a multi-phase AI analysis pipeline, and produces public portfolio pages, downloadable PDF resumes, and AI-generated README files.

**Target users:** Students and early-career developers at Colaberry who need recruiter-ready portfolios.

**Stack:**
- Frontend: React (Vite), deployed as SPA
- Backend: Node.js / Express, REST API
- Database: PostgreSQL (JSONB-heavy schema)
- AI: OpenAI GPT-4o / GPT-4o-mini
- PDF: Puppeteer (headless Chromium)
- Testing: Vitest (frontend unit tests only)

---

## Repository Phase

**Current Phase: M44 — Auto-Import Flow Complete**

| Layer | Status |
|-------|--------|
| Authentication & User Management | Integrated (GitHub OAuth + multi-account) |
| GitHub Repo Import | Verified |
| Basic AI Analysis Pipeline | Verified |
| Deep Analysis Pipeline (6-phase) | Integrated |
| Portfolio Builder | Integrated |
| Public Portfolio Page | Integrated |
| PDF Resume Download | Integrated |
| Recruiter Search | Integrated |
| README Generator | Partially Implemented |
| Directives (`/directives`) | Planned — directory does not exist |
| Execution scripts (`/execution`) | Planned — directory does not exist |
| Tests (`/tests`) | Partially Implemented — frontend utils only |
| CI/CD | Planned — not configured |

---

## Milestone History

### M1 — Project Scaffolding
- Express backend, React frontend with Vite, PostgreSQL connection
- JWT authentication (register/login)
- Basic user model

### M2 — GitHub Integration
- GitHub username linking (`PATCH /api/users/me/github`)
- Repo listing from GitHub API
- Repo import with `import_jobs` tracking table
- README content fetched on import

### M3 — Basic AI Analysis Engine
- `POST /api/analysis/:repositoryId/start` — async job
- OpenAI GPT-4o-mini extracts skills, summary, highlights, key takeaways
- `analyses` table: `skills_json`, `summary_json`, `confidence_score`
- Frontend polling loop in `AnalysisPanel.jsx`

### M4 + M5 — Portfolio System & Recruiter Search
- `portfolios` table with `content_json` JSONB column
- Portfolio Builder UI (multi-step: narrative, profile, LinkedIn import, repo selection, project media, preview)
- Public portfolio URL: `{FRONTEND_URL}/portfolio/:slug`
- `PublicPortfolio.jsx` — public-facing view
- `POST /api/portfolios/:id/pdf` — Puppeteer PDF download
- Recruiter search (`search` route, `RecruiterSearch.jsx`)
- LinkedIn PDF import via OpenAI — extracts name, headline, location, experience, education

### M6 — Deep Analysis Pipeline
Six-phase async pipeline stored in `deep_analyses` table:
1. **GitHub Enrichment** — `githubEnricher.js`
2. **Code Intelligence** — `codeIntelligence.js` → `intelligence_json`
3. **File Classification** — `fileClassification.js`
4. **Semantic Chunking** — `semanticChunking.js`
5. **Intelligence Agents** — `intelligenceAgents.js` → `inference_json`
6. **Inference Engine** — `inferenceEngine.js` → `code_intelligence_json`

New Analysis Panel tabs: Overview (Executive Intelligence Dashboard), Architecture (System Architecture Canvas), Quality (Portfolio Intelligence Overview).

### M7 — AI Project Descriptions & Public Portfolio Overhaul
- `POST /api/repos/:id/generate-description` — per-repo AI project descriptions
- Public portfolio redesign: sidebar layout, Core Technologies, Engineering Skills sections
- README `docs/images/demo.gif` added

### M8 — PDF Overhaul, AI Insights, Smart Media Upload *(committed: 4abc681)*

**Files modified:**
- `backend/routes/portfolios.js` — PDF route reads `profile` + `linkedin` from `content_json`; passes `experience`, `education`, `name` to `pdfGenerator`; GET route exposes `repoMedia`
- `backend/services/pdfGenerator.js` — full HTML overhaul: personal info header (name, email, location, LinkedIn), Experience section, Education section; section order: Summary → Experience → Education → Skills → Projects
- `frontend/src/PublicPortfolio.jsx` — AI Insights sidebar section (green-dot bullets from `repos[].analysis.highlights.strengths`); removed score bars, "Generated from AI" badge, AI confidence badge, Technical Strengths box; renamed "About Me" → "Professional Summary"
- `frontend/src/PortfolioBuilder.jsx` — `MediaInput` component with auto-convert GitHub blob→raw URL, preview image, validation, error states; `handleEditPortfolio` loads and filters `repoMedia` from DB
- `frontend/src/utils/mediaUrl.js` — `githubToRaw()`, `isSupportedMediaUrl()` utilities *(new file)*
- `frontend/src/utils/mediaUrl.test.js` — 20 Vitest unit tests for both utilities *(new file)*
- `frontend/vite.config.js` — Vitest config added (`globals: true`, `environment: 'node'`)
- `backend/package.json` — Puppeteer added as dependency

### M9 — Deep Analysis Integration, Bug Fixes, LinkedIn Navigation *(committed)*

**Files modified:**
- `backend/routes/repos.js` — `generate-readme` gate now passes if either basic OR deep analysis exists; `row` defaults to `{}` to avoid crash on deep-only repos
- `backend/routes/portfolios.js` — narrative route filter changed from `AND a.skills_json IS NOT NULL` → `AND (a.skills_json IS NOT NULL OR da.intelligence_json IS NOT NULL)`, fixing "No completed analyses found" for deep-analysis-only repos; added `code_intelligence_json` to narrative query; mapping falls back to deep analysis fields for `whatItDoes` and `technologies`
- `frontend/src/PublicPortfolio.jsx` — added `ensureHttps()` helper; applied to all 3 LinkedIn href locations (sidebar, Let's Connect button, mobile section) — fixed LinkedIn button not navigating to correct URL
- `frontend/src/PortfolioBuilder.jsx` — `loadRepos()` now checks ONLY deep analysis (`/api/deep-analysis/:id/latest`); repos with only deep analysis now appear correctly in Portfolio Builder

### M10 — Resume PDF Deep Analysis Integration *(committed)*

**Files modified:**
- `backend/services/pdfGenerator.js` — full rewrite integrating deep analysis data:
  - `TECH_CATEGORIES`, `TECH_LABELS`, `PATTERN_LABELS`, `ROLE_MAP` lookup tables added
  - `inferRoleTitle(repos, careerSignals)` — derives role title from career_signals or patternsInferred
  - `aggregateSkills(repos, topSkills)` — collects languages from primaryLanguage, technologies from code_intelligence_json across repos
  - `buildEngineeringSignals(repos)` — patternsInferred → chips, aiFeatures, strengths
  - `buildProjectBlocks(projects, repos)` — arch patterns, impact bullets, tech stack per repo
  - `buildSummary(narrative, repos)` — used hookSentence (project-focused — known limitation, fixed in M11)
- `backend/routes/portfolios.js` — PDF route LEFT JOIN LATERAL on `deep_analyses` for `intelligence_json`, `inference_json`, `code_intelligence_json`; passes `careerSignals` and per-repo deep analysis to pdfGenerator

**Known issues identified after M10 (addressed in M11):**
- `inferRoleTitle()` returned `careerSignals[0]` directly (the object `{ domain, score }`), causing `[object Object]` below candidate name — because `career_signals` stores objects not strings
- `buildSummary()` used `hookSentence` which is repository-focused ("A Express + Prisma-powered API service…") not developer-focused
- `buildProjectBlocks()` sliced before deduplication; limit was 8 instead of 6; arch patterns used raw `split('_')` instead of canonical labels

### M11 — Resume PDF Quality Overhaul *(2026-06-15)*

**Files modified:**
- `backend/services/pdfGenerator.js` — complete rewrite addressing all identified quality issues:

**P0 — Critical bug fixes:**
- `inferRoleTitle()`: now handles `careerSignals` as `[{domain, score}]` objects AND legacy strings; sorts by `.score` descending, extracts `.domain` — fixes `[object Object]` below candidate name
- `buildProjectBlocks()`: deduplicates technologies before slicing (`[...new Set([...techs, ...frameworks])]`), limit reduced to 6; added `CI_ARCH_LABELS` map for human-readable arch pattern labels (e.g., `rest_api` → "RESTful API" instead of "Rest Api")

**P1 — Person-focused Professional Summary:**
- `buildPersonSummary(repos)` replaces `buildSummary()` entirely
- Sentence 1: `"[Level] [Role] with experience building [context from patternsInferred]"`
- Sentence 2: `"Skilled in [top 5 technologies aggregated across all repos]"`
- Sentence 3: `"Demonstrated expertise in [top 3 PATTERN_LABELS signals]"` or first strength
- Derives `engineeringLevel` (`junior/mid/senior`) from `inference.overallAssessment.engineeringLevel`

**P2 — New "Target Role" section:**
- `buildTargetRoleHtml(repos, careerSignals)` added
- Shows Primary Role (from `careerSignals` highest score `.domain`) + Engineering Level (from `engineeringLevel` → "Entry Level"/"Mid-Level"/"Senior")
- Appears after Professional Summary

**P3 — New "Career Highlights" section:**
- `buildCareerHighlightsHtml(repos, experience)` added
- Calculates years of experience from LinkedIn `experience[].startDate` (earliest date to now)
- Maps `patternsInferred` → highlight labels via `HIGHLIGHT_MAP` (AI/LLM Orchestration, RAG Pipeline, Full Stack Development, etc.)
- Appends AI features not already represented
- Shows at most 7 checkmark bullets

**P4 — New lookup table:**
- `CI_ARCH_LABELS` map: 30 code intelligence architecture pattern keys → human-readable labels (covers REST API, JWT auth, ORM, vector databases, LLM orchestration, CI/CD, etc.)

**Section order (updated):** Header → Professional Summary → Target Role → Career Highlights → Engineering Signals → Experience → Education → Technical Skills → Projects → Footer

---

### M12 — Resume PDF Final Polish *(committed: d6fa426)*

**Files modified:**
- `backend/services/pdfGenerator.js`:
  - Removed `buildTargetRoleHtml()` and Target Role section entirely
  - Moved Engineering Level into Career Highlights as first bullet ("Senior Engineering Level")
  - Extracted `getEngLevel()` and `getYearsExperience()` as shared helpers
  - Expanded `buildPersonSummary()` to 4 sentences; takes `experience` for years in S1
  - ORM tools (`prisma`, `drizzle`, `mongoose`, `sequelize`, `typeorm`, `knex`) moved from `'Databases'` → `'ORM & Data Access'` in `TECH_CATEGORIES`
  - Added `'ORM & Data Access'` to `skillCategoryOrder`
  - Added `jwt: 'JWT'` and `'rest-routes': 'REST API Design'` to TECH_LABELS (fixed Jwt / Rest-routes display bugs)
  - Updated `CI_ARCH_LABELS` with recruiter-friendly labels; added `container_orchestration`, `rest_routing`

### M13 — PDF Resume Redesign to Traditional Format *(committed: 02d1e67)*

**Files modified:**
- `backend/services/pdfGenerator.js` — complete restructuring:
  - Removed Engineering Signals and Career Highlights sections entirely
  - Section order: Summary → Experience → Education → Technical Skills → Projects
  - Rewrote `buildPersonSummary()` with `SPEC_MAP`, `INDUSTRY_HINTS`, and `extractIndustries()` for industry-breadth context
  - Switched project bullets to `technicalDifferentiation` + `operationalCapabilities` + synthesized `buildArchBullets()`
  - Added `cleanProjectDescription()` to strip repo-centric language from project taglines
  - Added implied language/skill inference (SQL if PostgreSQL, JavaScript if TypeScript, LLM/RAG pattern skills)
  - Added `isGenericBullet()` filter to block assessment-style output

---

### M19 — GitHub OAuth Authentication *(2026-06-20)*

Replaced email/password auth with GitHub OAuth 2.0.

**Files created/modified:**
- `backend/db/migrations/20250101000006_add_github_oauth.js` — adds `github_access_token` column
- `backend/routes/auth.js` — complete rewrite: `/github` redirect, `/github/callback` code exchange + user upsert, `/logout` session revocation
- `backend/routes/repos.js` — `getGithubInfo()` reads `github_access_token` from `users`; removed `affiliation` param (422 fix)
- `backend/routes/users.js` — stripped to `GET /me` only (removed `PATCH /me/github`)
- `frontend/src/AuthCallback.jsx` — NEW: handles `/auth/callback?token=` redirect from GitHub
- `frontend/src/LoginForm.jsx` — GitHub OAuth button only; "sign out of GitHub first" tip
- `frontend/src/Header.jsx` — shows avatar + username from `/api/users/me`; no GitHub connect form
- `frontend/src/App.jsx` — imports AuthCallback, fire-and-forget logout
- Deleted: `frontend/src/RegisterForm.jsx`, `backend/middleware/loginRateLimiter.js`
- Uninstalled: `bcrypt`

**Validation:** Manual OAuth flow tested. Login, logout, session revocation verified.

---

### M20 — Multi-GitHub-Account Support *(2026-06-20)*

Allows users to connect multiple GitHub accounts. Repos from all accounts appear in Browse.

**Files created:**
- `backend/db/migrations/20250101000015_create_github_accounts.js` — creates `github_accounts` table, adds `github_account_id` FK to `repositories`, migrates existing `users.github_user_id` data
- `backend/routes/githubAccounts.js` — `GET /api/github-accounts` (list), `DELETE /api/github-accounts/:id` (disconnect secondary)
- `frontend/src/Settings.jsx` — Settings page: connected accounts list with primary badge, "Connect Another GitHub Account" button, disconnect button for secondaries, error/success banners

**Files modified:**
- `backend/routes/auth.js` — `GET /api/auth/github` now accepts `?mode=connect&token=JWT` to link a second account; state is now a signed JWT (prevents spoofing, 10-min TTL); callback handles `mode=connect` path: inserts into `github_accounts`, redirects to `/settings?connected=true`; login path upserts into both `users` and `github_accounts`
- `backend/routes/repos.js` — added `getGithubAccounts(userId)` reading from `github_accounts`; `GET /api/repos` fetches from all connected accounts in parallel (100 per account), merges + sorts by updated date; `POST /api/repos/import` selects token by matching repo owner to account username
- `backend/server.js` — registers `githubAccountsRouter` at `/api/github-accounts`
- `frontend/src/App.jsx` — imports `Settings`, adds `/settings` authenticated route
- `frontend/src/Header.jsx` — adds "Settings" nav link in navbar

**Database changes:**
- New table: `github_accounts` (id, user_id FK, github_user_id UNIQUE, github_username, github_email, access_token, avatar_url, is_primary, connected_at)
- New column: `repositories.github_account_id` (UUID FK, nullable, SET NULL on account delete)
- Migrated: existing users with `github_user_id` set → inserted into `github_accounts` as primary accounts (Sarbjit83, sainisarbjit83-ai)

**Validation:**
- Migration applied directly (node-pg-migrate blocked by pre-existing duplicate `000006` naming conflict)
- All backend files pass `node --check` syntax validation
- DB migration confirmed: `Sarbjit83` and `sainisarbjit83-ai` migrated to `github_accounts`

**Known gaps:**
- `repositories.github_account_id` is not populated on import (set NULL); only new imports after connect will populate it
- No automated tests added
- The `/api/auth/github/connect` flow requires GitHub to prompt the user to log in to a different account; the "sign out of GitHub first" tip on the Settings page covers this

---

### M22 — Browse GitHub Repos Final UX Polish *(2026-06-21)*

Final polish pass on Browse GitHub Repos page. Frontend-only changes to `frontend/src/Header.jsx`.

**What changed:**

1. **Repository summary bar** — 3-column stat strip (`repos.length` Repositories · `allAccounts.length` Connected Accounts · `selected.size` Selected) placed between filter chips and search bar; Selected count turns indigo when >0; hidden while loading

2. **Owner badge upgrade** — replaced plain gray `@username` text with a styled pill: `Owner: @username` in slate-100 background with border; immediately scannable when browsing

3. **Improved empty states** — 3 distinct states with centered icon + heading + subtext:
   - Loading: spinning icon + "Loading your repositories…"
   - No repos at all: box icon + "No repositories found"
   - Account filter active, no match: person icon + "No repositories for this account" + "Show all accounts" link
   - Search query, no match: magnifier icon + `No results for "query"` + "Clear search" button

4. **Onboarding card wording** updated to match spec: "Select repositories" → "Click Import" → "Repo2Reputation analyzes your projects" → "Generate your portfolio"

5. **Account card labels** — "Primary" badge → "Primary Account"; non-primary → "Public Account"; "repos" → "repositories"; avatar initial changes to slate color for public accounts

6. **Remove confirmation** — clicking × on a public account card sets `removeConfirm` state; card turns red-tinted and shows inline "Remove? [Yes] [Cancel]" instead of immediate removal; "Yes" calls `removeExtraUsername`; "Cancel" clears confirm state

7. **Visual hierarchy** — repo name bumped to `text-base font-bold`; owner badge is a pill with visible border; imported badge also uses bordered pill style; topics use muted gray; description stays `text-xs`

**New state:**
- `removeConfirm` — `string | null`, the username pending removal confirmation

**Constraints respected:** No backend API changes, no auth changes, no import logic changes.

---

### M21 — Browse GitHub Repos UX Overhaul *(2026-06-21)*

Comprehensive UX improvements to the Browse GitHub Repos page. No backend changes.

**Files modified:**
- `frontend/src/Header.jsx` — full rewrite of Browse tab UI

**What changed:**

1. **First-time onboarding card** — 4-step guide (Browse → Select → Import → Portfolio) shown above repo list on first visit; dismissed via × button and stored in `localStorage('r2r_onboarding_dismissed')`

2. **Connected accounts summary cards** — displayed above the search bar; each card shows avatar initial, @username, Primary badge (for signed-in account), repo count, and access level ("Public + Private" vs "Public Only"); non-primary accounts have × remove button on the card itself (replaces separate chips section)

3. **"Add Public GitHub Account" input** — moved inline with the account cards; dashed-border input shows "Add" button only when text is entered; helper text below explains public-only limitation

4. **Account-level filter chips** — shown only when 2+ accounts are active; "All Repositories (N)" + per-account "@username (N)" chips; active chip is filled indigo; selecting a chip resets pagination; removed filter is auto-reset to "all"

5. **Owner badge on every repo card** — `@accountUsername` shown on every card always (not just when extras are active)

6. **Public/Private visibility badge** — 🔒 Private (gray) or 🌐 Public (green) badge on every repo card

7. **"✓ Imported" badge** — repos already in `importedRepos` (matched by `full_name`) show a green badge; their checkbox is disabled; card row is not clickable for selection; `toggleSelect()` early-returns if repo is imported

8. **Import button state** — disabled (gray, "Select repositories to import") when nothing is selected; enabled ("Import N Repository/Repositories") when 1+ selected; no styling hack needed — proper disabled state via class switching

9. **Visual hierarchy** — tabs row uses consistent `pb-3 -mb-4` underline style; import success/error banners have × dismiss buttons; pagination shows "X–Y of Z repositories" label; search bar shows "N of M repos" count when repos are loaded

**New state variables:**
- `accountFilter` — `'all' | 'primary' | username` — drives account filter chip selection
- `showOnboarding` — boolean from localStorage, toggled by dismiss button

**New derived values:**
- `importedFullNames` — `Set<string>` of `full_name` from `importedRepos`
- `repoCounts` — `{ [accountUsername]: number }` map built from `repos` array
- `allAccounts` — `[{ username, isPrimary }]` from `githubUsername` + `extraUsernames`
- `accountFiltered` — `repos` pre-filtered by `accountFilter` before search filter applied

**Validation:** Frontend-only change; no backend API changes, no auth changes, no import logic changes.

**Risks / Limitations:**
- Onboarding card is dismissed once per device (localStorage key); no server-side state
- `repoCounts` may show 0 briefly for primary account until `fetchCurrentUser()` completes
- No automated tests added for the new UI logic

---

### M14 — Resume PDF Language & Layout Polish *(2026-06-15)*

**Files modified:**
- `backend/services/pdfGenerator.js`:
  - `SPEC_MAP` values shortened to concise noun phrases (e.g., "LLM orchestration and AI system integration" instead of gerund phrases)
  - `buildPersonSummary()` S4 closing sentence shortened and tightened for all three paths (AI+senior, fullstack+senior, other)
  - `buildArchBullets()` all bullet strings rewritten as short action-first phrases; removed trailing "for [long explanation]" suffixes
  - `cleanProjectDescription()` — now extracts first sentence only, then truncates at 85 characters on a word boundary; prevents multi-sentence documentation-style descriptions from appearing in project headers
  - **CSS overhaul** — skills now use flex layout with `min-width: 155px` label column for aligned columns; section titles changed from `border-bottom` to `border-left: 3px solid #1e3a8a` accent for stronger visual hierarchy; section/project spacing increased; summary line-height tightened to 1.65; body color softened to `#1e293b`

**Validation:**
- Manual browser verification required after PDF re-generation
- No automated tests added

**Known gaps:**
- PDF output not tested against a live deep-analysis repo in this session
- `cleanProjectDescription()` 85-char truncation may clip descriptions that are naturally short (acceptable behavior — truncation only triggers when length exceeds threshold)

---

## Architecture

```
frontend/src/
  App.jsx                  — routing, auth gate
  AnalysisPanel.jsx        — per-repo analysis UI (Overview, Architecture, Quality, Portfolio Report, README tabs)
  PortfolioBuilder.jsx     — multi-step portfolio creation/editing
  PublicPortfolio.jsx      — public recruiter-facing portfolio page
  RecruiterSearch.jsx      — search UI for recruiters
  Header.jsx               — top navigation
  utils/mediaUrl.js        — GitHub blob→raw URL conversion + media validation
  utils/mediaUrl.test.js   — Vitest unit tests (20 tests)

backend/
  server.js                — Express entry point
  routes/
    auth.js                — register, login, JWT
    users.js               — profile, GitHub username linking
    repos.js               — GitHub repo list/import, generate-readme
    analysis.js            — basic AI analysis (start, poll, results)
    deepAnalysis.js        — deep 6-phase pipeline (start, poll, results)
    portfolios.js          — CRUD, PDF download, public portfolio
    search.js              — recruiter full-text search
  services/
    openai.js              — all OpenAI calls (analysis, portfolio narrative, project descriptions, LinkedIn extract, README generation)
    pdfGenerator.js        — Puppeteer HTML→PDF
    deepAnalysisPipeline.js — orchestrates 6 phases
    githubEnricher.js      — phase 1
    codeIntelligence.js    — phase 2
    fileClassification.js  — phase 3
    semanticChunking.js    — phase 4
    intelligenceAgents.js  — phase 5
    inferenceEngine.js     — phase 6
    repoLimits.js          — repo usage limits
    repoIntelligenceScorer.js — scoring
    phaseTracker.js        — pipeline phase state
  db/
    postgres.js            — pg pool
    seed.js                — seed data
  middleware/
    authMiddleware.js      — JWT verify
```

**Database tables (known):**
- `users` — id, email, github_username, created_at
- `repositories` — id, user_id, provider, external_repo_id, name, full_name, primary_language, topics, readme_content, sync_status
- `import_jobs` — id, user_id, repository_id, status, progress_pct, error_message
- `analyses` — id, repository_id, status, skills_json, summary_json, confidence_score
- `deep_analyses` — id, repository_id, status, intelligence_json, inference_json, code_intelligence_json, completed_at
- `portfolios` — id, user_id, title, slug, headline, content_json (JSONB: narrative, profile, linkedin, repo_media), is_public

---

## Testing Status

| Area | Status | Evidence |
|------|--------|----------|
| `mediaUrl.js` utilities | Tested | 20 Vitest unit tests in `mediaUrl.test.js` |
| Backend routes | Not Tested | No test files exist under `/tests` or `backend/` |
| Deep analysis pipeline | Not Tested | No unit or integration tests |
| PDF generation | Not Tested | Manually verified only |
| OpenAI service functions | Not Tested | No mocks or unit tests |
| Public portfolio rendering | Not Tested | Manual browser verification only |
| Auth flow | Not Tested | No Playwright or integration tests |
| Recruiter search | Not Tested | No tests |

**Gap:** The CLAUDE.md contract requires unit tests for all non-trivial execution logic. Only `mediaUrl.js` satisfies this. All backend services, routes, and the deep analysis pipeline are untested.

---

## Structural Gaps vs CLAUDE.md Contract

| Requirement | Status |
|-------------|--------|
| `/directives` directory with SOPs | Missing — directory does not exist |
| `/execution` directory with deterministic scripts | Missing — logic lives in `/services` |
| `/tests` directory mirroring execution | Missing — tests only in `frontend/src/utils/` |
| CI/CD pipeline | Missing — no `.github/workflows/` |
| One-command test execution documented | Missing |
| Integration tests with opt-in env flag | Missing |
| Playwright / E2E tests | Missing |

---

## Known Risks & Technical Debt

1. **No backend tests** — all AI service calls, route handlers, and the 6-phase pipeline have zero test coverage. A bug in `openai.js` or any pipeline phase has no safety net.
2. **README tab partially implemented** — `AnalysisPanel.jsx` has uncommitted README tab changes but verification has not been completed.
3. **`gpt-4o` cost** — README generation upgraded to `gpt-4o`. At scale this is significantly more expensive than `gpt-4o-mini`. No rate limiting or quota guard exists.
4. **Puppeteer in production** — PDF generation requires Chromium. Deployment environments (e.g., Railway, Render free tier) may not support headless Chrome without custom buildpacks.
5. **No error boundary on deep analysis** — if any phase fails mid-pipeline, partial results are stored but the frontend may render incomplete data without clear user indication.
6. **`content_json` is untyped JSONB** — no schema validation on write. Malformed portfolio saves silently corrupt data.
7. **GitHub token optional** — `GITHUB_TOKEN` is optional in `GITHUB_HEADERS`. Unauthenticated requests hit GitHub's 60 req/hr rate limit, which will break import for active users.

---

## Next Recommended Actions

### Immediate (unblock current work)
1. Verify and commit `AnalysisPanel.jsx` README tab — confirm it renders, Generate button calls the route, Copy and Download work
2. Commit all current session changes (`repos.js`, `openai.js`, `AnalysisPanel.jsx`, `Header.jsx`)
3. Update `PROGRESS.md` after commit

### Short-term (quality & stability)
4. Add backend unit tests for `openai.js` — mock OpenAI, test prompt construction and response parsing
5. Add route integration tests for `generate-readme` — test both basic-only, deep-only, and both-present scenarios
6. Add cost guard on `gpt-4o` README calls — enforce max_tokens cap and consider rate limiting per user
7. Document one-command test run in README (`npm test` from root)

### Medium-term (CLAUDE.md compliance)
8. Create `/directives` directory with SOPs for: analysis pipeline, portfolio generation, README generation, PDF export
9. Extract reusable logic from `/services` into `/execution` scripts per CLAUDE.md layer model
10. Add Playwright E2E tests for: login flow, portfolio creation, public portfolio rendering, PDF download
11. Set up GitHub Actions CI running Vitest on every push

---

## Definition of Done Checklist (per CLAUDE.md)

For each feature to be considered complete:
- [ ] Implementation exists and is not scaffolded
- [ ] Relevant unit tests pass
- [ ] Behavior-changing logic updates directives
- [ ] End-to-end impact verified (manual or automated)
- [ ] No secrets introduced
- [ ] PROGRESS.md updated

---

### M15 — PDF Header Redesign *(2026-06-15)*

**Files modified:**
- `backend/services/pdfGenerator.js`:
  - Replaced `ROLE_MAP` with `DOMAIN_TO_TITLE` (career signal domain → professional job title) and `PATTERN_SECONDARY` (pattern → pipe-separated secondary specialization)
  - Replaced `inferRoleTitle()` with `buildProfessionalHeadline()`: composes `"Senior AI Backend Engineer | Full-Stack Development"` format from engineering level + top career signal + secondary specialization; falls back to `profile.headline` if no signals present
  - Added "Portfolio: " label prefix to `profile.website` in contact row
  - CSS: `text-align: center` on `.header`; `.name` 22pt → 24pt; `.role` 11pt → 10.5pt + `letter-spacing: 0.5px`; `.contact` 9pt → 8.5pt + `margin-top: 8px`

**Validation:**
- Manual PDF re-generation required to verify headline output for specific user

**Known gaps:**
- `DOMAIN_TO_TITLE` keys must match exact strings returned by OpenAI in `career_signals[].domain`; any mismatch falls back to raw domain value (acceptable — still readable)

---

### M16 — PDF Traditional Resume Typography & Layout *(2026-06-15)*

**Files modified:**
- `backend/services/pdfGenerator.js`:
  - `font-family` switched from `Arial, Helvetica, sans-serif` to `Georgia, 'Times New Roman', Cambria, serif` — eliminates web-export appearance
  - All Tailwind slate hex colors replaced with neutral print palette: body `#1a1a1a`, headings `#000`, body text `#222`, secondary `#333`/`#444`, muted `#666`
  - `.section-title`: removed `border-left` accent + `color: #1e3a8a` (blue); replaced with `border-bottom: 1px solid #1a1a1a` + `color: #000` — traditional executive resume heading style
  - `.name` font-size 24pt → 26pt; `.role` color `#1e3a8a` → `#222`; `.contact` font-size 8.5pt → 9pt; `.contact a` color `#1e3a8a` → `#1a1a1a` (no blue hyperlink colour in print)
  - Contact separator changed from `&middot;` (·) to `|` (pipe) — matches traditional resume format
  - Section order resequenced: Summary → Experience → Technical Skills → Projects → Education (Education moved from 3rd to last)
  - Added `.resume` container with `max-width: 760px; margin: 0 auto; padding: 36px 40px` for proper page margins

**Validation:**
- Manual PDF re-generation required

---

### M17 — PDF Executive Typography *(2026-06-15)*

**Files modified:**
- `backend/services/pdfGenerator.js`:
  - **DOMAIN_TO_TITLE extended** — added AI variants (`"Artificial Intelligence"`, `"AI/ML Engineering"`, `"AI Development"`, `"AI/ML"`, `"Machine Learning"`), web/software variants (`"Web Development"`, `"Software Development"`, `"Software Engineering"`); total 26 domain mappings
  - **Safe fallback** — `buildProfessionalHeadline()` now returns `"Software Engineer"` instead of null when no career signals are present
  - **ROLE_MAP restored** — was accidentally removed in M15; summary S1 sentence uses it to derive role from `patternsInferred` (separate from `DOMAIN_TO_TITLE` which serves the headline)
  - **CSS — name**: 26pt → 32pt, `letter-spacing: 0.5px`
  - **CSS — headline**: 11pt bold → 13pt regular weight (bold competed with name)
  - **CSS — section titles**: 9.5pt → 13pt, border-bottom 1.5px, padding-bottom 4px, section margin-bottom 14px → 18px
  - **CSS — contact row**: 9pt → 9.5pt, sep margin widened to 8px
  - **Summary trimmed to 3 sentences**: removed S3 (technology list — redundant with Skills section); S2 capped at 2 specialisations joined with "and" instead of comma list; closing sentence tightened for business impact

**Validation:**
- Manual PDF re-generation required to verify 32pt name and 13pt section title proportions

---

---

### M17b — Name/contact size reduction *(2026-06-16)*

**Files modified:**
- `backend/services/pdfGenerator.js`:
  - **CSS — name**: 32pt → 24pt (32pt was visually overwhelming)
  - **CSS — contact row**: 9.5pt → 9pt (prevents wrapping on single-line contact row)

**Validation:**
- Manual PDF verification; name now proportional alongside 13pt section titles

---

### M18 — Deterministic top_skills *(2026-06-17)*

**Problem:** AI-generated `top_skills` in portfolio narrative was non-deterministic — adding more repos caused skill count to drop (10 → 6) because OpenAI synthesizes and selects a subset.

**Solution:** Replaced AI `top_skills` with deterministic aggregation from `code_intelligence_json.technologies` + `code_intelligence_json.frameworks` fields, filtered through the shared `TECH_CATEGORIES` map. Languages from `r.primary_language` are added with confidence 1.0.

**Files created:**
- `backend/services/techMaps.js` — shared `TECH_CATEGORIES` (40+ keys) and `TECH_LABELS` (display-name overrides), used by both pdfGenerator and portfolios route

**Files modified:**
- `backend/services/pdfGenerator.js`:
  - Added `require('./techMaps')` import
  - Removed inline `TECH_CATEGORIES` and `TECH_LABELS` definitions (now in shared module)
- `backend/routes/portfolios.js`:
  - Added `require('../services/techMaps')` import
  - Added `r.primary_language` to SQL SELECT in generate-narrative route
  - After `generatePortfolioNarrative()` resolves, deterministic `techMap` built from all repos' `code_intelligence_json`; `result.top_skills` overridden before saving to DB

**Validation:**
- Adding more repos to a portfolio will now increase or maintain skill count, never decrease it
- Skills shown are exactly what's in the repo's `code_intelligence_json` — auditable, reproducible

**Risks / Limitations:**
- Only technologies in `TECH_CATEGORIES` are included; unknown packages are filtered out (intentional noise reduction)
- Existing portfolios retain old AI-generated `top_skills` until re-generated

---

---

### M19 — GitHub OAuth Authentication *(2026-06-17)*

**Scope:** Replace email/password login with GitHub OAuth. Users authenticate exclusively through GitHub — no registration form, no password.

**Files created:**
- `backend/db/migrations/20250101000006_add_github_oauth.js` — adds `github_access_token` column
- `frontend/src/AuthCallback.jsx` — handles `/auth/callback?token=JWT` redirect from backend

**Files modified:**
- `backend/routes/auth.js` — replaced register/login/refresh with `GET /api/auth/github` (OAuth redirect) and `GET /api/auth/github/callback` (token exchange + user upsert + session create + JWT redirect). Logout changed to revoke session by JWT sessionId rather than refresh token.
- `backend/routes/repos.js` — replaced static `GITHUB_HEADERS` / `getGithubUsername()` with dynamic `makeGithubHeaders(userToken)` / `getGithubInfo()`. When user has `github_access_token`, uses authenticated `GET /api/user/repos` (includes private repos); falls back to `GET /api/users/{username}/repos` with app token.
- `frontend/src/App.jsx` — added `/auth/callback` route, removed register view
- `frontend/src/LoginForm.jsx` — replaced email/password fields with single "Continue with GitHub" button
- `frontend/src/Header.jsx` — removed manual "Connect GitHub" form and state; GitHub username is always set via OAuth
- `backend/.env` — added `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, `FRONTEND_URL`; changed `JWT_EXPIRES_IN` from `1h` to `7d`

**User upsert strategy (3-tier):**
1. Match by `github_user_id` (returning user)
2. Match by email (links existing email/password account to GitHub)
3. Create new user

**Validation:**
- Requires GitHub OAuth App to be created at github.com/settings/developers
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` must be set in `.env` before the flow works
- Manual end-to-end test: click login → authorize → dashboard with repos loaded

**Risks / Limitations:**
- Existing email/password users will be linked on next GitHub OAuth login (by email match)
- Users with private GitHub emails get a generated `{id}+{login}@users.noreply.github.com` address
- `JWT_EXPIRES_IN` in .env is now `7d` but the OAuth callback hardcodes `7d` — both must match if changed
- `RegisterForm.jsx` still exists on disk but is no longer imported or routed

**Environment variables required:**
```
GITHUB_CLIENT_ID=<from GitHub OAuth App>
GITHUB_CLIENT_SECRET=<from GitHub OAuth App>
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback
FRONTEND_URL=http://localhost:5173
```

---

---

### M30–M36 — UI/UX Sprint (Skeleton Loading, Onboarding, Section Nav) *(2026-06-xx)*

**Files modified:** `frontend/src/Skeleton.jsx` (new), `frontend/src/Header.jsx`, `frontend/src/PortfolioBuilder.jsx`, `frontend/src/PublicPortfolio.jsx`

- **Skeleton loading states** — shimmer animation components (`RepoCardSkeleton`, `PortfolioBuilderSkeleton`, `PublicPortfolioSkeleton`) replace plain text spinners
- **Onboarding stepper** — 3-step progress guide shown to first-time users (import → analyze → build); dismissed via localStorage
- **Portfolio Builder section nav** — horizontal jump nav strip (LinkedIn / Profile / Headline / Summary / Skills / Projects / Media) with smooth scroll using `scrollContainerRef`
- **View Live button** — green "🌐 View Live →" button in editor header; green when published, grey when draft
- **Publish label** — "↗ Publish Portfolio" changes to "↗ Re-publish" after first publish

---

### M37 — Top Skills: LinkedIn Chips + Show All Toggle *(2026-07-xx)*

**Files modified:** `frontend/src/PortfolioBuilder.jsx`

- LinkedIn-sourced skills rendered with light blue chip (`#e8f3ff` bg, `#0a66c2` text) and `in` badge to distinguish from AI-detected skills
- Skills capped at 15 with "Show all N skills ↓" / "Show less ↑" toggle
- Footer shows count of LinkedIn-only skills merged in

---

### M38 — README Update: LinkedIn Skills Merge Documentation *(2026-07-xx)*

**Files modified:** `README.md`

- Documented LinkedIn PDF skill extraction and merge behaviour
- Updated `.env` variables, API endpoint list, project structure

---

### M39 — View Live Button in Portfolio Builder *(2026-07-xx)*

**Files modified:** `frontend/src/PortfolioBuilder.jsx`

- "🌐 View Live →" button added to editor header bar
- Green border/text when `portfolio.visibility === 'public'`; grey (disabled) when draft
- `handleEditPortfolio` updated to refresh `portfolio.status` and `portfolio.visibility` so button state reflects DB truth

---

### M40 — Mobile-Responsive Public Portfolio *(2026-07-xx)*

**Files modified:** `frontend/src/PublicPortfolio.jsx`

- CSS `@media (max-width: 768px)` block added via inline `<style>` tag
- Sidebar hides on mobile; mobile profile header (avatar, name, headline, location, skill chips) appears instead
- Nav tabs become horizontally scrollable
- PDF button shows `↓` icon on mobile, full text on desktop
- Stats row (`pp-highlights`) stacks vertically on mobile

---

### M41 — Auto-Import Top 10 Repos on First Login *(2026-07-10)*

**Files modified:** `backend/routes/repos.js`, `frontend/src/Header.jsx`

**What changed:**
- `POST /api/repos/auto-import` — new backend endpoint: checks if user has any imported repos; if not, fetches GitHub repos sorted by `pushed_at`, filters forks, returns top 10 `full_name` values
- `mapGithubRepo()` updated to include `fork` and `pushedAt` fields
- `fetchImportedReposAndMaybeAutoImport()` added to Header — called on mount; if no repos imported, auto-discovers top 10 and calls existing `/api/repos/import`
- Animated "Setting up your portfolio…" loading screen shown during auto-import (pulsing progress bar)
- `cameFromAutoImport` flag set after auto-import completes — passed as `autoStart` prop to PortfolioBuilder
- Error banner shown if auto-import fails; manual Browse tab always available as fallback

**Risk mitigation:** 10-repo cap prevents runaway OpenAI cost; forks filtered to keep only owner's original work

---

### M42 — Auto-Generate Portfolio After Auto-Import *(2026-07-10)*

**Files modified:** `frontend/src/PortfolioBuilder.jsx`, `frontend/src/Header.jsx`

**What changed:**
- `PortfolioBuilder` accepts new `autoStart` prop
- When `autoStart=true`, a `useEffect` fires after repos load: auto-selects all repos, sets title to "My Portfolio", creates portfolio via API, then triggers narrative generation — zero user clicks required
- Repos with `completed` or `partial` analysis status are preferred; falls back to all imported repos if analyses still running
- `autoStartedRef` (useRef) prevents double-triggering across re-renders
- Second `useEffect` watches for `portfolio` to be set then auto-fires `handleGenerateNarrative()`
- "Portfolio created" banner hidden in autoStart mode to reduce noise; generation message updated to "Building your portfolio…"

---

### M43 — LinkedIn Onboarding Prompt During Generation *(2026-07-10)*

**Files modified:** `frontend/src/PortfolioBuilder.jsx`

**What changed:**
- During narrative generation in `autoStart` mode, a LinkedIn upload panel appears below the "Building your portfolio…" spinner
- User can upload LinkedIn PDF while AI writes their summary — parallel tasks reduce total wait time
- Uses same `handleLinkedinUpload` handler as Section 1 (LinkedIn PDF Import in editor)
- Success state shows "✓ LinkedIn added — N skills imported"; error shown inline
- Export instructions included: "Me → Settings → Data Privacy → Get a copy of your data"
- LinkedIn skills are automatically merged when editor opens if PDF was uploaded during generation

---

### M44 — Repo Exclusion and Re-Analyze in Editor *(2026-07-10)*

**Files modified:** `backend/routes/portfolios.js`, `frontend/src/PortfolioBuilder.jsx`

**What changed:**
- **Backend**: `PATCH /api/portfolios/:id` now accepts `repository_ids` array to update which repos power the portfolio without creating a new one
- **Frontend**: "Included Repos" panel added above Project Summaries section in editor
  - Each repo shows name, language, and analysis status badge (⏳ analyzing / ✓ / ✗ failed)
  - **↺ Re-analyze** button triggers fresh deep analysis (grayed out if already running)
  - **✕ Remove** button excludes repo from portfolio without deleting it from the account (grayed out if only 1 repo remains)
  - Footer shows total included count with clarifying note
- `handleExcludeRepo(repoId)` function added to PortfolioBuilder

**Validation:** Build passes, no runtime errors observed. Manual test required.

**Risks / Limitations:**
- Excluding a repo does not regenerate the narrative — user must click Regenerate if they want the AI summary to reflect the change
- No automated tests added

---

## Complete New First-Time User Flow (post M41–M44)

1. User logs in via GitHub OAuth
2. "Setting up your portfolio…" animated screen — silently imports top 10 non-fork repos
3. Analysis queues immediately for all imported repos (basic + deep)
4. "Building your portfolio…" screen — AI generates professional narrative automatically
5. LinkedIn upload panel shown during step 4 — optional, parallel task
6. Editor opens with all sections populated — user reviews and publishes
7. Public portfolio live at `/portfolio/:slug`

Returning users are unaffected — auto-import only runs when zero repos are imported.

---

*Last updated: 2026-07-12 — M41–M45: Auto-import flow, LinkedIn onboarding, repo exclusion in editor, bug fixes, Jupyter notebook analysis.*

---

### M45 — Bug Fixes, Data & Analytics Tech Detection, Jupyter Notebook Analysis *(2026-07-12)*

**Files modified:**
- `backend/server.js`
- `backend/routes/deepAnalysis.js`
- `backend/routes/repos.js`
- `backend/services/codeIntelligence.js`
- `backend/services/githubEnricher.js`
- `backend/services/intelligenceAgents.js`
- `backend/services/techMaps.js`
- `frontend/src/Header.jsx`
- `frontend/src/PortfolioBuilder.jsx`

**Bug Fix 1 — Orphaned analysis recovery on server restart:**
- `setImmediate` jobs are lost when Node.js process exits. DB rows stay as `queued` but nothing processes them.
- `backend/server.js`: on startup, queries `deep_analyses` for rows with `status IN ('queued', 'running')`, resets `running` → `queued`, then fires `setImmediate(() => runDeepAnalysisPipeline(...))` for each.
- `backend/routes/deepAnalysis.js`: `/run` endpoint now re-kicks the pipeline for existing `queued` rows instead of returning early.
- `backend/routes/repos.js`: Added warning log when silent deep analysis queue failure occurs.

**Bug Fix 2 — "A unknown-powered software project" in card summaries:**
- `dominantStack` was the string `"unknown"` (truthy), which bypassed the ternary null-check in template building.
- `backend/services/intelligenceAgents.js` line ~376: now treats `"unknown"` string as null explicitly: `const dominantStack = (typeof v === 'string' && v !== 'unknown') ? v : null`. All downstream templates fall back to "well-engineered" language.

**Bug Fix 3 — Portfolio Title input removed:**
- `frontend/src/PortfolioBuilder.jsx`: Removed the Portfolio Title `<input>` div from Step 1 of portfolio creation. `handleCreate` now always uses `'My Portfolio'` as the default title.

**Bug Fix 4 — Browse/Add More Repos page UI:**
- `frontend/src/Header.jsx`:
  - Tab renamed from "Browse GitHub Repos" → "Add More Repos"
  - Tab button outline fixed (`outline-none` added to remove focus ring artifact)
  - Top-right "Import" button removed
  - Sticky bottom import bar added: appears when repos are selected, shows count + "Import N Repos →" button
  - Avatar initial fix: `(repo.language || repo.name || 'R').slice(0, 2).toUpperCase()` prevents blank/undefined avatars

**Bug Fix 5 — Removed "Included Repos" panel from portfolio editor:**
- `frontend/src/PortfolioBuilder.jsx`: Removed the entire "Included Repos" EditorSection block that was added in M44. User confirmed it was not needed.

**Feature — Data & Analytics technology detection:**
- `backend/services/codeIntelligence.js`: Added "Data & Analytics Platforms" section to `TECH_PATTERNS` with patterns for: `microsoft-fabric`, `power-bi`, `azure-synapse`, `databricks`, `pyspark`, `dbt`, `medallion-architecture`. Added display names to `STACK_LABELS`.
- `backend/services/techMaps.js`: Added all 7 new technologies to `TECH_CATEGORIES` (category: `'Data & Analytics'`) and `TECH_LABELS` (display names). Without `TECH_CATEGORIES` entries, detected technologies are silently dropped by the portfolio aggregation filter.

**Feature — Jupyter Notebook (.ipynb) analysis support (ROOT CAUSE FIX):**
- Root cause: `.ipynb` files were not in `SOURCE_EXT` → classified as `contentType: 'unknown'` by `githubEnricher.js`. `codeIntelligence.js` only analyzes files in `ANALYZABLE_CONTENT_TYPES` (excludes `unknown`) → Microsoft Fabric patterns had zero chance to match.
- `backend/services/githubEnricher.js`: Added `.ipynb` as `notebook` content type (classified in `classifyContent()` before the `unknown` fallback, with `languageHint: 'Python'`).
- `backend/services/codeIntelligence.js`: Added `'notebook'` to `ANALYZABLE_CONTENT_TYPES`. Jupyter notebook content (raw JSON containing code cells) is now passed through all tech pattern matchers.

**Portfolio Builder UX — "Still analyzing" panel:**
- `frontend/src/PortfolioBuilder.jsx`: Added panel above repo selection showing repos that aren't yet `completed/partial`, with per-repo status label and `▶ Analyze` / `✕ Remove` action buttons.
- Added `▶ Analyze` button to the zero-analyzed-repos waiting screen.

**Bug Fix 6 — Card Summary (oneLiner) blank in portfolio editor:**
- `oneLiner` was never set when the AI narrative returned empty `hookSentence` for a repo, and "Generate AI Descriptions" preserves existing fields (including a blank `oneLiner`).
- `frontend/src/PortfolioBuilder.jsx`: Added `seedOneLiner(p)` helper — if `p.oneLiner` is empty but `p.description` (AI long-form text) exists, extracts the first sentence (capped at 200 chars) as a fallback `oneLiner`.
- Applied at all 3 project-loading points: after narrative generation, on `handleEditPortfolio` reload, and after "Generate AI Descriptions" response.
- Field remains user-editable; seeding only fills blanks, never overwrites existing content.

**Validation:**
- Backend restarted and serving on port 5000.
- Frontend hot-reloads automatically via Vite.
- `.ipynb` fix requires re-analysis of affected repos to take effect. Use the `↺ Reanalyze` button in AnalysisPanel for repos containing Jupyter notebooks (e.g., `Retail-fabric-sales-analytics`), then regenerate the portfolio narrative.

**Risks / Limitations:**
- Re-analysis must be manually triggered for existing repos — old `code_intelligence_json` in `deep_analyses` does not change automatically.
- `notebook` content type analysis matches on raw `.ipynb` JSON text; deeply nested cell content is still matched (JSON string representation contains the Python code), but complex import paths inside code cells depend on pattern specificity.
- No automated tests added.

---

### M46 — Private GitHub Account Connect with Auto-Import *(2026-07-13)*

**Files modified:**
- `backend/routes/repos.js`
- `frontend/src/Header.jsx`

**Feature — Connect private GitHub account with auto-import:**

User requested ability to add a second (private) GitHub account that auto-imports and auto-analyzes its top 10 repos, matching the experience of public account auto-import from M41.

**Backend — `POST /api/repos/auto-import-account`:**
- Accepts `{ username, limit }` in request body.
- Looks up the connected GitHub account by username from `github_accounts` table (validates ownership).
- Uses the account's stored OAuth token to call `GET /user/repos` (authenticated, sees private repos).
- Filters out forks, slices to `min(limit, 15)`, returns `{ repoFullNames }`.
- Added to `backend/routes/repos.js` at bottom, before module export.

**Frontend — `Header.jsx`:**

1. **`privateImporting` state** — tracks username currently being auto-imported (shows purple spinner banner).

2. **`autoImportConnectedAccount(username)` function:**
   - Called when `?connected=username` URL param is detected on page load (after OAuth redirect).
   - Calls `POST /api/repos/auto-import-account` → `POST /api/repos/import` → refreshes imported repos.
   - On success: sets `analyzingFullNames` (triggers analysis badges), shows import success banner.
   - On failure: shows fallback connect banner with `@username connected`.
   - Also refreshes connected accounts list and repo list at start.

3. **Startup `useEffect` — `?connected=username` handling updated:**
   - Previously only showed a text banner; now calls `autoImportConnectedAccount(username)`.
   - `window.history.replaceState` clears the URL param before the async work starts.

4. **"Connect Private Account" button card:**
   - Added to the accounts row next to "Add public username" card.
   - Styled with indigo dashed border, lock icon, subtitle "OAuth · auto-imports top 10 repos".
   - Calls `connectGithubAccount()` which redirects to GitHub OAuth with `mode=connect`.
   - On return, `?connected=username` is detected → `autoImportConnectedAccount` fires automatically.

5. **Purple spinner banner** — shown during `privateImporting` state, purple to distinguish from public (indigo).

**Flow end-to-end:**
1. User clicks "Connect Private Account" → GitHub OAuth → redirect to `/?connected=username`
2. Header detects param → calls `autoImportConnectedAccount(username)`
3. Shows purple "Auto-importing top 10 repos from @username (public + private)…" banner
4. Calls backend → gets top 10 non-fork repo full names using OAuth token
5. Calls import endpoint → imports repos → fires analysis queue
6. Shows green "N repos from @username imported — analysis starting" success banner
7. Account card appears in accounts row (fetched via `fetchConnectedAccounts`)

**Validation:**
- Frontend changes hot-reload via Vite.
- Backend requires restart to load new `auto-import-account` endpoint.
- Existing `connectGithubAccount()` OAuth flow already worked; only the post-connect behavior was extended.

**Risks / Limitations:**
- Backend must be manually restarted to pick up the new endpoint.
- If the OAuth token has expired for the connected account, the `GET /user/repos` call will fail with 401; the banner will fall back to a text-only connect banner.
- No automated tests added for this flow.

---

### M47 — Repository Merge: Portfolioforge-automation absorbed into Repo2Reputation *(2026-08-09)*
**Session:** CC-20260809-8f3k

**What changed:**
- This repo (`portfolio`) previously held two separate cloned repos as untracked nested-git subfolders: `Repo2ReputationColaberryProject` (this platform) and `Portfolioforge-automation` (a smaller, separate MVP that scrapes Colaberry's own SQL Server + a student's authenticated Colaberry project pages via Playwright, then auto-generates and publishes a markdown portfolio to a new GitHub repo).
- Decision (user-confirmed): Repo2Reputation is the base platform going forward. Portfolioforge's two capabilities — (1) Colaberry SQL/Playwright import, (2) publish-portfolio-as-GitHub-repo — will be ported in as new modules on top of this codebase in a later milestone, not run as a separate app.
- Removed the nested `.git` folders from both cloned copies (severs their link to the original GitHub remotes — `Kalkidan2129/Portfolioforge-automation` and `sainisarbjit83-ai/Repo2ReputationColaberryProject` — which remain untouched; this repo never had push access to either).
- Promoted Repo2Reputation's contents (`backend/`, `frontend/`, `ai/`, `api/`, `architecture/`, `data/`, `directives/`, `docs/`, `execution/`, `operations/`, `runtime/`, `security/`, `spec/`, `testing/`, `ux/`, `.claude/settings.json`, `PROGRESS.md`, `README.md`) to repo root — this now matches the folder table in root `CLAUDE.md`.
- Moved `Portfolioforge-automation/` wholesale into `legacy/portfolioforge-automation/` as reference source for the upcoming port — not yet wired into the app.
- Dropped Repo2Reputation's own `Claude.md`/`.gitignore` (fully superseded by root `CLAUDE.md` v2 and root `.gitignore`).
- Merged `.gitignore`: appended Node/Playwright/generated-portfolio ignore patterns from both subprojects onto the existing root template.
- Created root `.env.example` cataloguing every environment variable referenced across both codebases (DB, JWT, GitHub OAuth, GitHub App, OpenAI/OpenRouter, and the not-yet-enabled Colaberry SQL Server block), values as placeholders only.

**Secret audit performed (no values ever printed/logged):**
- Scanned both codebases for hardcoded passwords, API keys, tokens, SQL/Postgres connection strings, PEM keys, and `env || 'literal-fallback'` patterns.
- Result: no live secrets were hardcoded in either app — both already read all credentials via `process.env.*`, and no `.env` file existed on disk in either clone. `backend/database.json`'s `password` field uses the `{"ENV": "<var name>"}` indirection convention, not a literal. The only near-misses were README.md documentation placeholders and an 11-character local dev-fixture password in `backend/db/seed.js` (not a live/DB-connection credential).

**Validation:**
- `git status` confirmed both nested repos were fully clean and in sync with their `origin` before their `.git` folders were removed — no uncommitted or unpushed work was discarded.
- Directory listing (`ls`) confirmed all expected paths exist post-move; no file-count loss observed between pre- and post-restructure listings.
- Not yet done: `npm install` / app boot / `tsc --noEmit` in the consolidated `backend/` and `frontend/` — restructuring only moved directories, it did not verify the app still runs from repo root. This is the immediate next action.

**Risks / Limitations:**
- App has **not yet been run** from the new root-level layout — relative paths, `require`/`import` statements, or scripts that assumed the old `Repo2ReputationColaberryProject/` prefix need verification.
- `legacy/portfolioforge-automation/student-profile.json` contains a real student's name/email (Kalkidan Bezabeh) carried over from the original repo — low sensitivity (not a secret) but worth noting since it's now inside a different owner's repo.
- Colaberry SQL Server import (Portfolioforge's core differentiator) is **not enabled** — per CLAUDE.md governance this is a production-infrastructure/compliance boundary and requires a written escalation to Ali (DRI) before it is wired into the merged app. That escalation has not yet been drafted.
- No commit has been made yet — this milestone reflects working-tree state only, pending explicit user go-ahead to commit.

**Next Actions:**
- Run `npm install` + boot backend/frontend from the new root layout; fix any broken relative paths.
- Draft the Colaberry-SQL-access escalation write-up for Ali before Phase 3 (porting the Colaberry import + GitHub-publish features).
- Get explicit user confirmation, then commit this restructure.

---

### M47.1 — Post-merge audit: name-collision check *(2026-08-09)*
**Session:** CC-20260809-8f3k

User asked for a targeted double-check that identical folder/file/secret-key names between the two source apps weren't silently confused or overwritten during M47's restructure.

**What was checked:**
- Both projects' `spec/01_requirements.md` — confirmed genuinely distinct files (different sizes, different MD5 hashes), correctly landed at `spec/` (R2R's) and `legacy/portfolioforge-automation/spec/` (Portfolioforge's) respectively, not overwritten or cross-contaminated.
- Grepped `backend/` and `frontend/` for 3+-level-up relative requires (`../../../`) that could have silently broken when Repo2Reputation's contents were promoted from a subfolder to repo root — none found.
- Root `.claude/settings.json` (moved from R2R) and `settings.local.json` (this session's own) both verified intact post-merge.
- Compared port bindings: Portfolioforge hardcodes `3001`, R2R reads `process.env.PORT` — no collision, and moot regardless since Portfolioforge's routes are intended to become new routes on R2R's single Express app in Phase 3, not a second standalone server.

**Issue found and fixed:** `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` appear in both apps but referred to **two different GitHub OAuth App registrations** with different callback URLs and different scopes (R2R: `/api/auth/github/callback`, `read:user user:email repo`; Portfolioforge: `/auth/github/callback`, `repo` only). The consolidated `.env.example` originally implied a single shared pair, which would have silently supported only one of the two flows. Fixed by documenting the distinction directly in `.env.example` and recording the resolution: R2R's OAuth App already carries `repo` scope, so Portfolioforge's separate OAuth flow is to be **retired**, not ported, in Phase 3 — the GitHub-repo-publish feature will reuse the logged-in R2R user's existing OAuth token.

**Secondary note (documented, not a bug):** `GITHUB_TOKEN` is used by both apps but requires different scope — R2R treats it as an optional read-only rate-limit fallback; Portfolioforge's repo-publish flow requires it to have repo-creation write scope. Documented in `.env.example` so setup doesn't issue an under-scoped token.

**Validation:** MD5 hash comparison (spec files), grep-based structural checks (relative paths), `ls` (settings files), direct code reads (OAuth scope/callback comparison). No secret values were printed or logged during this audit.

**Risks / Limitations:** This was a static-analysis audit (file diffing, grep, code reading) — it has not been validated by actually running both OAuth flows side-by-side, since no `.env` with real credentials exists yet. That validation is deferred to Phase 3 when the GitHub-repo-publish feature is actually wired in.
