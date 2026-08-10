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

---

### M47.2 — Boot verification from new root layout *(2026-08-09)*
**Session:** CC-20260809-8f3k

Committed M47/M47.1 (commit `3b197d9`), then ran the deferred "npm install + boot" verification from PROGRESS.md's Next Actions.

**What was done:**
- `npm install` in `backend/` (254 packages) and `frontend/` (214 packages) — both succeeded. `backend`: 12 audit vulnerabilities reported, pre-existing in the dependency tree, not introduced by the merge, not investigated further this session. `puppeteer-core@25.0.4` warns it wants Node >=22.12.0; this environment runs Node v20.20.2 — pre-existing constraint, not caused by the merge, flagged for whoever sets up a dev machine.
- Booted `backend/server.js` directly (no `.env` file, so no real credentials). First attempt crashed at require-time in `services/openai.js:3` (`new OpenAI({ apiKey: undefined })` throws eagerly in the installed `openai` SDK version) — **pre-existing behavior in Repo2Reputation's own code, unmodified by this merge**, confirmed by reading the file directly. Re-ran with an inline placeholder `OPENAI_API_KEY` (not written to any file) — server then booted cleanly, logged `Server running on http://localhost:5000`, and failed only at the expected point (Postgres auth, `SASL: ... client password must be a string`, since no real `DB_PASSWORD` exists) — caught and logged by the existing try/catch, did not crash the process.
- `npm run build` in `frontend/` — succeeded cleanly, 27 modules transformed, no errors.
- Conclusion: **the M47 restructure did not break any import/require paths.** Everything that fails right now fails only for the expected reason (no real `.env` in this environment), not from the file moves.

**Side note (flagged during boot, resolved, not a repo issue):** the `dotenv` package prints a randomized promotional "tip" line on every load, including one referencing `vestauth.com`. Verified by reading `node_modules/dotenv/lib/main.js` directly — it's a hardcoded `TIPS` array in the officially published `dotenv` package (self-promotion for the maintainer's other products), not a compromised dependency and not something introduced by this merge. No URL was visited. Noting it here only so a future session doesn't re-investigate the same non-issue.

**Validation:** `npm install` exit status, direct stdout/stderr capture of `node server.js` (three runs: no key/crash, placeholder key/clean boot, confirmed graceful DB-failure handling), `npm run build` exit status and dist output, `git status` confirming only `package-lock.json` files changed (build artifacts correctly gitignored).

**Risks / Limitations:**
- Still not validated against a real Postgres instance or real GitHub/OpenAI credentials — that requires an actual local `.env`, which is out of scope for this session.
- `services/openai.js`'s eager client construction means **any** local dev boot requires at minimum a placeholder `OPENAI_API_KEY`, even for people who only want to touch unrelated routes. Worth a follow-up (lazy-init the client) but out of scope for this merge — not caused by it.
- `backend` has 12 known audit vulnerabilities (1 critical, 9 high) inherited from the pre-merge dependency tree; not triaged this session.

**Next Actions:**
- Draft the Colaberry-SQL-access escalation write-up for Ali before Phase 3.
- Decide whether to address the `openai.js` eager-init and `npm audit` findings now or defer to a dedicated hardening pass.

---

### M47.3 — Env relocation + round-trip architecture conflict diagnosed *(2026-08-09)*
**Session:** CC-20260809-8f3k

**Phase 2 escalation skipped per explicit user directive.** User provided real SQL Server + OpenAI credentials locally (values never seen/logged in this session) and instructed skipping the Ali write-up. Governance still names Ali as DRI for production-infrastructure decisions per root `CLAUDE.md`, but the user directing this project instructed proceeding without it — logged here for auditability rather than silently dropped.

**`.env` relocated:** user had placed `.env` at repo root; `backend/server.js`'s `dotenv.config()` resolves `.env` relative to `process.cwd()`, which is `backend/` when the server is actually run — the root-level file was invisible to it. Moved to `backend/.env` (331 bytes; contents never read, per Secret Safety Rule).

**Architecture conflict identified (user-reported, reproduced via screenshots) before any Phase 3 code was written:** user attempted using Portfolioforge (Kalkidan's app) to generate a portfolio as a GitHub repo (`kalii` — markdown/images only, no source code), then imported that repo into Repo2Reputation (Sarbjit's app) alongside real source repos for deep analysis. This is a category error — R2R's deep-analysis pipeline (file classification → code intelligence → architecture inference) has nothing to analyze in a documentation-only repo — and it doesn't work.

**Design decision for Phase 3 (not yet implemented):**
1. Colaberry-sourced projects go directly into `repositories`/`analyses` with `provider = 'colaberry'` (column already exists on `repositories`, `UNIQUE (provider, external_repo_id)` — no schema change needed). Portfolioforge's scrape+AI output (business problem, tools, insights) feeds R2R's narrative/inference stage directly; code-intelligence phases (file classification, architecture pattern detection) are skipped for this provider since there's no source code to analyze.
2. "Publish as GitHub repo" is a **one-directional terminal export only** — portfolio data → generated repo, never read back as a source. The generated repo will carry a marker (topic tag or marker file) and a DB record so R2R's Browse/import UI can detect and exclude/flag self-generated portfolio repos, preventing the exact `kalii` re-import scenario from recurring.

**Validation:** none yet — this is a design decision pending Phase 3 implementation and user confirmation to proceed.

**Risks / Limitations:** Not yet implemented. The `kalii` repo already sits in the user's R2R database as an imported, presumably-mis-analyzed repository from before this fix — will need cleanup/exclusion once the guardrail exists.

**Next Actions:**
- User to confirm before Phase 3 implementation begins.
- Implement `provider = 'colaberry'` ingestion path, portfolio-repo marker/guardrail, and clean up the already-imported `kalii` repo from the user's R2R data once the guardrail lands.

---

### M47.4 — .env cleanup, dead-variable fixes, portfolio sort decision *(2026-08-09)*
**Session:** CC-20260809-8f3k

**Sorting decision:** user chose to keep R2R's existing manual-ordering system as-is rather than build Colaberry-specific relevance scoring — no new sort/ranking work planned.

**`.env.example` rewritten** to one-line-per-variable descriptions, per user request. Consolidations made:
- Dropped `OPENROUTER_API_KEY` (Portfolioforge) — same purpose as `OPENAI_API_KEY` (generate portfolio text); merged app standardizes on R2R's existing `services/openai.js`.
- Dropped `GITHUB_USERNAME`, `GITHUB_REPO_NAME`, `PORTFOLIO_MODE` (Portfolioforge) — these assumed one fixed single-operator identity; the merged app is multi-user and will derive GitHub username / repo name / create-vs-update per request from the logged-in user, not a global env var.
- Dropped `OPENAI_MODEL` — grepped, confirmed unused anywhere in `backend/` (only appeared in `.claude/settings.json`, unrelated to app runtime).
- `GITHUB_TOKEN` description simplified back to its original single purpose (optional read-only rate-limit fallback) — the earlier "needs write scope" caveat no longer applies now that repo-publish reuses the user's own OAuth token instead of a static PAT (per M47.3 decision).

**Two dead variables found and fixed in code** (grepped, confirmed neither was actually read anywhere before writing them into `.env.example`, to avoid documenting a lie):
- `backend/server.js`: `PORT` was hardcoded to `5000`, ignoring `process.env.PORT`. Changed to `process.env.PORT || 5000`.
- `backend/db/postgres.js`: host/user/database were hardcoded (`localhost`/`postgres`/`repo2reputation`), only `DB_PASSWORD` was env-driven — `DATABASE_URL` was documented in the original README but never read anywhere. Changed to use `connectionString: process.env.DATABASE_URL` when set, falling back to the previous hardcoded-parts + `DB_PASSWORD` behavior when not — preserves local-dev zero-config behavior while making single-connection-string config (the standard pattern for a future Hetzner deploy) actually functional.

**Deployment guidance captured (for the future Hetzner deploy, not acted on yet):** user distinguished two different kinds of credentials that must never be conflated — (1) personal SSH key for logging into the VM itself, safe to reuse across projects/servers, no isolation benefit from being project-specific; (2) a repo-scoped deploy key or fine-grained PAT for the server to `git clone`/`pull` this specific repo, which must NOT be the user's personal GitHub key/token (blast radius containment if the box is ever compromised). Documented directly in `.env.example`'s header comment so it isn't lost, and saved as a durable memory (not project-specific) for future sessions.

**Validation:**
- Grepped `backend/` for `process.env.PORT` and `process.env.DATABASE_URL` before the fix — zero matches, confirming both were genuinely dead.
- Re-ran boot test against the user's real `backend/.env` (7 variables present: `OPENAI_API_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD` — names only, values never read) after the code changes — server boots, listens on `:5000` via the new `PORT` fallback, fails only at the still-missing Postgres credential (`DB_PASSWORD`/`DATABASE_URL` not yet provided by user) exactly as before — no regression introduced by either fix.

**Risks / Limitations:** User still needs to provide either `DATABASE_URL` or `DB_PASSWORD` (plus `JWT_SECRET`) before the app has a working database connection — not yet supplied as of this entry. Colaberry SQL credentials and OpenAI key are in place; Postgres is not.

**Next Actions:** Begin Phase 3 implementation: `provider = 'colaberry'` ingestion path, portfolio-repo marker/guardrail, retire Portfolioforge's separate OAuth flow.

---

### M48 — Portfolio-export guardrail shipped; Colaberry live-login architecture decided + PoC validated *(2026-08-09)*
**Session:** CC-20260809-8f3k

**Guardrail shipped (fixes the `kalii` bug directly):**
- `backend/db/migrations/20250101000016_add_portfolio_export_guardrail.js` — adds `repositories.is_portfolio_export BOOLEAN NOT NULL DEFAULT FALSE` + index. Not yet applied (pending Postgres credentials — see M47.4).
- `backend/routes/repos.js` — two-layer defense: (1) `GET /api/repos` now filters out any GitHub repo carrying the `repo2reputation-generated` topic from Browse results entirely (`meta.excludedGeneratedPortfolios` reports the count); (2) `POST /api/repos/import` rejects importing such a repo even if requested directly by full name, in case Browse filtering is ever bypassed. `GET /api/repos/imported` now also selects `provider`/`is_portfolio_export` for future frontend badge use.
- Syntax-checked (`node -c`) on both the migration and `repos.js`; not yet run against a live DB.

**Identity mapping decided:** Colaberry `UserID` is resolved server-side by matching the logged-in R2R user's email against `dbo.ADF_ColaberryActiveUsers` — never trusts a client-supplied ID. Implemented in `backend/services/colaberrySqlClient.js` (`getColaberryUserByEmail`, `getProjectLinksForUser` — both parameterized, read-only, syntax-checked).

**Colaberry scraping-auth architecture decided (multi-round discussion with user):** Kalkidan's original approach (`chromium.launch({headless:false})`, human manually logs in to a real window on their own machine, session saved to `colaberry-storage-state.json`) cannot run on a hosted server — no display, no way for a remote user's input to reach a server-side window. Ruled out in order: local-helper-download (user rejected — too much friction), bookmarklet (technically unreliable — Colaberry's session cookie is almost certainly `HttpOnly`, unreadable via page/bookmarklet JS), browser extension (viable but ongoing build/maintenance cost + still an install step). **Decided: embedded live browser** — a real headful browser runs server-side in an isolated container (Xvfb virtual display + Chromium/Chrome), its screen streams into the R2R page itself via VNC-over-WebSocket (noVNC), so the user logs in inline with zero install/download. Session captured via Playwright's `context.storageState()` API directly (sidesteps the `HttpOnly` cookie problem entirely, since Playwright reads its own browser context, not `document.cookie`), then reused headlessly for actual scraping — no more streaming needed after the one login.

**PoC built and validated** at `backend/services/colaberry-live-login/poc/` (Dockerfile + start.sh, not part of the production app yet — a throwaway spike to de-risk the mechanism before building the real service):
- Confirmed Docker Desktop on this machine uses a real Linux backend (`desktop-linux`/WSL2), so Xvfb runs correctly despite the Windows host.
- First build used `chromium-browser` — failed; Ubuntu 22.04 ships that package as a snap-only stub that doesn't run in containers (known Docker gotcha). Fixed by installing Google Chrome's official `.deb` directly.
- Verified end-to-end: Xvfb + x11vnc + websockify all start and stay up (checked via `docker exec ps aux`); Chrome runs fully headful under Xvfb (confirmed via a captured screenshot showing Chrome's genuine first-run dialog — proof it's a real rendered browser, not a stub); the noVNC web page is reachable from outside the container exactly as a real user's browser tab would reach it (`curl` returned `HTTP 200`, correct `Content-type: text/html`, served by `WebSockify Python/3.10.12`).
- Test container stopped and removed after verification; the PoC image (`colaberry-live-login-poc`) and Dockerfile/start.sh are kept as reference for building the real service.

**Side note:** Docker inventory check revealed ports `5432` and `5433` are already bound by other unrelated local projects' Postgres containers (`accelerator-db`, `epimind-db-1`) — relevant when this app's own local Postgres eventually gets set up; will need a different port or isolated network.

**Validation:** Migration + repos.js syntax-checked. SQL client syntax-checked (not run against live DB — no Postgres/SQL Server test executed this entry, though SQL Server credentials are present per M47.4). PoC verified via process inspection, a real captured screenshot, and an HTTP check of the noVNC endpoint — not yet verified with an actual noVNC JS client rendering live frames in a real browser (couldn't test that from this tool environment), but every underlying component it depends on is confirmed working.

**Risks / Limitations:**
- None of the "real" session-manager (per-user isolation, auth-scoped WebSocket, storageState capture/encryption, teardown/resource limits) is built yet — the PoC only proves the core streaming mechanism, not the multi-tenant service around it.
- Migration not yet applied (no live Postgres).
- Scraper (`colaberryProjectScraper.js`) not yet ported — depends on the session-manager existing first.
- Already-imported `kalii` repo in the user's DB still needs cleanup — guardrail only prevents *future* imports, doesn't retroactively flag existing rows (their GitHub topic wasn't set by this platform, since Portfolioforge never applied one).

**Next Actions:** Build the real live-login session-manager service (container-per-session lifecycle, signed per-session WebSocket auth token, resource/timeout limits), the WebSocket proxy route, and the noVNC frontend panel — this is the largest remaining piece of Phase 3.

---

### M49 — Colaberry live-login backend built and fully verified end-to-end *(2026-08-09)*
**Session:** CC-20260809-8f3k

**Real container image** at `backend/services/colaberry-live-login/image/` (promoted from the `poc/` spike): `Dockerfile` (Xvfb + x11vnc + websockify/noVNC + Google Chrome + Node 20), `start.sh` (boots Xvfb → x11vnc → websockify → the driver last, in that order), `driver.js` (Playwright, using the system Chrome via `channel: 'chrome'` rather than downloading Playwright's own bundled browser — keeps the image lean). `driver.js` launches a real headful Chrome under the container's Xvfb display with `--no-first-run --no-default-browser-check` (fixes the first-run dialog the PoC hit), navigates to `COLABERRY_LOGIN_URL`, and exposes a tiny internal control API (`/health`, `/status`, `/capture` — returns `context.storageState()` directly through Playwright's own API, never `document.cookie`, so `HttpOnly` session cookies are captured correctly — and `/close`). Also carries its own 10-minute hard safety-net (`process.exit`) independent of the backend, so even a fully orphaned container self-terminates.

**`backend/services/colaberryLiveLoginSessionManager.js`** — orchestrates container lifecycle via `docker` CLI (`execFile` with an args array, never a shell string, per the Security Enforcement Layer's no-shell-interpolation rule):
- `startSession(userId, loginUrl)`: enforces a global concurrency cap (5) and one-active-session-per-user, runs the container with `--memory=512m --cpus=1` and OS-assigned host ports (`-p 127.0.0.1::PORT`), then **polls the driver's `/health` endpoint until ready** (bounded 20s timeout) before returning success — this replaced an earlier fixed-sleep approach in testing that was flaky under load; polling is the correct fix, not a longer sleep.
- `completeSession`: calls `/capture` on the container, AES-256-GCM encrypts the resulting `storageState` with `COLABERRY_SESSION_ENCRYPTION_KEY`, upserts into the new `colaberry_sessions` table, tears the container down (graceful `/close` first, force `docker rm -f` regardless).
- `cancelSession` / per-session `setTimeout` / a `setInterval` sweep (defense in depth beyond the per-session timeout) / `cleanupOrphanedContainers()` (runs at backend startup — removes any `colaberry-live-*` containers left behind by a previous crashed/restarted process, rather than waiting on the container's own 10-minute self-timeout).
- Signed stream tokens (`issueStreamToken`/`verifyStreamToken`, HMAC-SHA256 over `sessionId:userId:expiresAt` using `JWT_SECRET`, timing-safe compared) — needed because browser `WebSocket` connections can't carry `Authorization` headers, so the token travels in the URL instead.

**`backend/services/colaberryLiveLoginWsProxy.js`** — hooks the underlying `http.Server`'s `upgrade` event (Express doesn't handle WS upgrades itself), validates the stream token + session ownership before ever opening a connection to the container, then relays bytes both directions between the browser and the container's internal `websockify` port. New dependency `ws@^8.21.3` added deliberately (backend/package.json) — minimal, standard, no viable simpler alternative for raw WebSocket proxying.

**`backend/routes/colaberryLiveLogin.js`** — `POST /start`, `POST /:sessionId/complete`, `POST /:sessionId/cancel`, all behind `authMiddleware`. Wired into `server.js` at `/api/colaberry-login`; `attachWsProxy(server)` called once the HTTP server is listening.

**`backend/db/migrations/20250101000017_create_colaberry_sessions.js`** — `colaberry_sessions` table (one row per user, `UNIQUE(user_id)`, AES-256-GCM ciphertext + IV columns). Not yet applied (still no live Postgres — see M47.4/M48).

**Full end-to-end verification performed (not just unit-level):**
1. Built and ran the real container standalone — confirmed via `docker logs` that Xvfb, x11vnc, websockify, and the Playwright-driven Chrome all start correctly; hit and confirmed `/health`, `/status` (real page URL), `/capture` (valid `storageState` JSON shape) all work against the live container; confirmed `/close` shuts the container down cleanly (`exit code 0`).
2. Wrote a throwaway end-to-end test (`backend/tmp-test-live-login-chain.js`, deleted after use — not part of the shipped codebase) that: called `startSession` directly against the real session-manager (spinning up a real Docker container), confirmed a wrong stream token is rejected with `HTTP 401` before any container connection is attempted, and confirmed a **correct** token successfully proxies real bytes end-to-end — received the literal VNC protocol handshake (`"RFB 003.008\n"`) through the full chain: test client → our `ws` proxy → container's `websockify` → `x11vnc` → the live Xvfb display running Chrome. This is the strongest evidence available without a real browser/human clicking into the stream: genuine protocol-level data traversed every hop of the real production code path.
3. Along the way, found and fixed a real flakiness bug: the original fixed-sleep-then-connect approach intermittently failed with "socket hang up" against a freshly-started container; root-caused to a readiness race (not a websockify path issue — confirmed root path `/` is in fact correct for `websockify`'s single-target mode, verified by directly testing multiple candidate paths). Fixed by polling `/health` before `startSession` returns, which is the durable fix regardless of machine speed/load, not just a longer timeout.
4. Boot-smoke-tested the full `server.js` (with the new router + WS proxy + startup orphan-cleanup wired in) against the user's real `.env` — no regressions, same expected-only Postgres-auth failure as prior entries.
5. Verified no orphaned Docker containers were left behind after the test run (one was found from an earlier failed attempt, before the readiness-fix — manually cleaned up, and would now be caught automatically by `cleanupOrphanedContainers()` on next backend restart).

**Validation:** All of the above ran against real Docker containers on this machine — not mocked. Migration and all new/modified backend files syntax-checked (`node -c`). Not yet validated: `npm run migrate:up` against a live Postgres (still pending credentials), and a real human clicking through an actual noVNC frontend panel (frontend not built yet).

**Risks / Limitations:**
- `colaberry_sessions` migration not yet applied — no live Postgres.
- No frontend panel yet — the backend is fully provable via API/WebSocket but not yet usable by an actual person.
- `COLABERRY_LOGIN_URL` and `COLABERRY_SESSION_ENCRYPTION_KEY` are not yet in the user's real `backend/.env` — required before this feature can run for real.
- Resource ceiling (5 concurrent sessions, 512MB/1cpu each) is a starting guess, not load-tested — worth revisiting once real usage patterns exist.
- `docker` CLI must be present and the backend process must have Docker socket access wherever this deploys (Hetzner) — not yet confirmed as a deployment prerequisite in any ops doc.

**Next Actions:** Build the noVNC React frontend panel (the only missing piece for a human to actually use this), then port `colaberryProjectScraper.js` to consume the captured `colaberry_sessions` row headlessly.

---

### M50 — Colaberry live-login frontend panel built and wired in *(2026-08-09)*
**Session:** CC-20260809-8f3k

**`frontend/src/ColaberryLiveLogin.jsx`** — modal overlay component using `@novnc/novnc` (new dependency, added deliberately — the standard HTML5 VNC client, no viable simpler alternative). On mount: calls `POST /api/colaberry-login/start`, builds the `wss://.../stream?token=...` URL from the response, connects via noVNC's `RFB` class into a canvas. Shows "Connecting…" until the `connect` event fires, then reveals the live browser panel and enables "I'm logged in — Continue" (calls `/complete`, closes on success). "Cancel" and unmount both call `/cancel` — a `finishingRef` guard (not React state, to dodge the stale-closure trap in the effect's cleanup/event-handler closures) distinguishes an intentional complete/cancel from a genuine dropped connection, which is what triggers the error state instead.

**Wired into `frontend/src/Header.jsx`**: a "Connect Colaberry" card added next to the existing "Connect Private Account" GitHub card in the Browse accounts row (matching its exact visual pattern — dashed border, icon circle, two-line label — emerald accent instead of violet to distinguish it), opens the modal on click. `onComplete` currently just shows a banner ("Colaberry account connected. Project import is coming in a follow-up release.") since the import route doesn't exist yet (next milestone) — the connect flow itself is real and complete, the *use* of the resulting session isn't wired up yet.

**Validation:**
- `npm run build` (Vite): before wiring into `Header.jsx`, the component was unreferenced and correctly excluded from the module graph (27 modules, unchanged) — confirming Vite's dead-code exclusion behavior as expected, not a sign of a broken import. Ran `npx eslint` directly against the standalone file to verify it independent of the build graph (0 errors, 1 harmless warning, fixed).
- After wiring in: `npm run build` succeeded, module count jumped to 80 (confirms `@novnc/novnc` + the new component are genuinely bundled, not silently excluded), bundle size warning only (expected, noVNC's client isn't tiny — not an error).
- `npm run lint` (full project): 71 pre-existing problems, all in `mediaUrl.test.js` (missing test-framework eslint globals — unrelated, pre-existing, not touched this session) and pre-existing `Header.jsx` issues (`importedCount`/`succeeded` unused vars, missing hook deps — all pre-dated this session's edits, confirmed by grepping the lint output for line numbers outside what was changed). Zero lint issues in any file this session created or modified.

**Risks / Limitations:**
- Not tested with a real human clicking through an actual live session (would need a real `COLABERRY_LOGIN_URL` + a live Postgres for the `/complete` DB write) — everything that *can* be verified without those has been.
- `onComplete` doesn't yet do anything useful post-connection (no import route to hand off to yet) — by design, next milestone.
- No visual polish pass against the project's formal design system (`/frontend-design` skill) — functional and on-brand-adjacent (matches existing Tailwind/indigo conventions in `LoginForm.jsx`) but not a deliberate design pass.

**Next Actions:** Port `colaberryProjectScraper.js` (headless, consumes the encrypted `colaberry_sessions` row via `decryptStorageState`), build `/api/colaberry-import` (idempotent, `provider = 'colaberry'`), skip code-intelligence phases for that provider in the deep-analysis pipeline, then the GitHub-repo-publish export route and `kalii` cleanup — all still pending from the original Phase 3 scope.

---

### M51 — Colaberry scraper + import route shipped; analysis-routing decided *(2026-08-09)*
**Session:** CC-20260809-8f3k

**Design decision (discussed with user before writing code):** Colaberry projects never touch `deep_analyses` (R2R's 6-phase pipeline — Enrichment → Code Intelligence → File Classification → Semantic Chunking → Intelligence Agents → Inference Engine). Every phase depends on GitHub-code-shaped Enrichment output (`fileContents`, `rankedFiles`); forcing scraped Colaberry content (Power BI/Python/BI project instructions, not source code) through it would produce confused output at every stage, not just be "skippable." Verified `analysisQueue.js`'s existing basic pipeline (`analyses` table, `queueAnalysis()` → `services/openai.js`'s `analyzeRepository()`) already works off fully generic `repositories` fields (`name`, `description`, `topics`, `readme_content`) with no GitHub-specific assumptions — so the fix for "skip code-intelligence for provider='colaberry'" turned out to require **zero pipeline code changes**: Colaberry-sourced repos simply never get `queueDeepAnalysis()` called on them, only `queueAnalysis()`.

**`backend/services/colaberryProjectScraper.js`** — headless Playwright scraper (runs standalone, no Xvfb/VNC container needed — that machinery was only for the interactive login). Ported from Portfolioforge's `processSingleProject()`/`getBestDashboardImage()`: the real DOM extraction (Angular-specific selectors `h1.ng-binding`, `a.tagstyle.ng-binding`, `button[ng-click^="GetSteps"]`, step-content regex cleanup chain) — **deliberately not ported**: Portfolioforge's ~500-line hardcoded industry-pattern insight generator (superseded by R2R's own AI pipeline, per M47.3). One bad project/step never aborts the batch — errors are caught per-project and per-step, matching Failure-First Design. Added `playwright` (full package, not `-core`) as a new backend dependency — deliberately, since it's the only library that can consume our own `storageState` capture format, and needs a portable bundled browser since the host machine (dev box or eventually Hetzner) isn't guaranteed to have system Chrome.

**`backend/routes/colaberryImport.js`** (`POST /api/colaberry-import`, behind `authMiddleware`): resolves the user's email → `colaberrySqlClient.getColaberryUserByEmail` → `getProjectLinksForUser` → decrypts the captured session via `colaberryLiveLoginSessionManager.decryptStorageState` → `scrapeColaberryProjects` → upserts each into `repositories` (`provider='colaberry'`, `external_repo_id` = SHA-256 hash of the project URL for idempotent re-import, step content joined into `readme_content`, tags into `topics`) → `queueAnalysis()` (never `queueDeepAnalysis()`). Per-project try/catch so one bad DB write doesn't fail the whole batch, mirroring the existing pattern in `repos.js`'s `/import`.

**Frontend**: `Header.jsx`'s `ColaberryLiveLogin` `onComplete` now actually calls `/api/colaberry-import` (previously just showed a placeholder banner) and refreshes the imported-repos list via the existing `fetchImportedReposAndMaybeAutoImport()`.

**Bug found and fixed by the boot test (not by inspection):** `mssql` was used throughout `colaberrySqlClient.js` since M47.3 but was **never actually added to `backend/package.json`** — booting the server crashed with `Cannot find module 'mssql'` the moment the new import route (which requires the SQL client) got wired into `server.js`. Added `mssql@^12.7.0` (resolved) as a dependency, installed, reboot confirmed clean. A reminder that `node -c` syntax-checking (used throughout this session) only catches parse errors, not missing dependencies — only an actual boot catches that class of bug.

**Also chased down a false alarm:** a background+`kill`-after-sleep boot-test pattern showed the server apparently hanging (no "Server running…" line, process still alive after 10s). Root-caused to the test harness pattern itself, not the app — re-tested with the `timeout N node server.js > file 2>&1` (foreground-blocking) pattern that had worked reliably all session and got full, correct output immediately. Recorded here so a future session doesn't waste time re-chasing the same non-issue.

**Validation:**
- `node -c` on all new/modified files.
- Full server boot (via the reliable `timeout`-wrapper pattern) against the user's real `backend/.env` plus inline placeholder `JWT_SECRET`/`COLABERRY_SESSION_ENCRYPTION_KEY` — clean boot, no crash, only the already-known missing-Postgres-credential failure.
- `npm run build` (Vite) — 80 modules, succeeds. `npx eslint` on `Header.jsx` — same 3 pre-existing issues as before this session touched it (confirmed identical line numbers/messages), zero new issues introduced.

**Risks / Limitations:**
- None of this has been run against the real Colaberry site — no live credentials/site access available in this environment. Every DOM selector is a faithful port of Portfolioforge's originals, but Colaberry's actual site could have changed since that code was written.
- Scraping happens synchronously inline in the HTTP request (matches the existing convention in `repos.js`'s `/import`) — for a student with several projects, each involving multiple page loads and step-by-step clicks with built-in waits, this request could run long. Not fixed — flagged as a known UX rough edge, consistent with existing patterns rather than a regression.
- Project images (`imageUrl` from the scraper) aren't persisted anywhere yet — `repositories` has no image column and portfolio media is a separate existing feature. Scoped out of this milestone; noted as a gap, not silently dropped.

**Next Actions:** GitHub-repo-publish export route (port `createGitHubRepo()`/README-generation from Portfolioforge, reuse the user's OAuth token, tag output with the guardrail marker), then clean up the already-imported `kalii` repo. User has authorized committing and pushing at my discretion once a coherent chunk of work is verified — will do so after the publish route lands.

---

### M52 — GitHub-repo-publish route shipped; kalii cleanup script written; Phase 3 complete *(2026-08-09)*
**Session:** CC-20260809-8f3k

**`backend/services/githubPortfolioPublisher.js`** — the second Portfolioforge capability, ported per the M47.1 decision (retire Portfolioforge's separate OAuth flow, reuse the logged-in user's own token). Rewritten from git-based (`simple-git`, local clone/commit/push) to GitHub's **Contents API** (`PUT /repos/{owner}/{repo}/contents/{path}`) instead — no local git needed, which fits a stateless multi-tenant server far better than Portfolioforge's original filesystem-based approach. `ensureRepoExists` (idempotent — GETs first, only POSTs `/user/repos` on 404), `setGeneratedTopic` (stamps `repo2reputation-generated`, the guardrail marker — exported as `GENERATED_PORTFOLIO_TOPIC`), `upsertFile` (idempotent — GETs existing file's `sha` first so re-publishing updates rather than erroring). Builds `README.md` + `project-N/README.md` from the portfolio's already-generated `content_json.narrative` (headline, narrative, top_skills, projects[].description) — reuses R2R's own narrative data, doesn't regenerate content Portfolioforge-style.

**DRY fix:** `repos.js` had its own local copy of `GENERATED_PORTFOLIO_TOPIC` (added in M48, before the publisher existed) — now imports the constant from `githubPortfolioPublisher.js` (the module that actually stamps it) instead of maintaining two string literals that would silently drift out of sync.

**`POST /api/portfolios/:id/publish-github-repo`** wired into `portfolios.js` next to the existing `PATCH /:id/publish` (hosted-portfolio publish) — validates `repoName` (GitHub-safe charset), requires a connected GitHub account and a completed narrative (`400` with a clear message otherwise), `409` on a real GitHub 422 conflict.

**`backend/scripts/cleanup-generated-portfolio-repos.js`** — one-off, dry-run-by-default script for the already-imported `kalii` repo (imported before the guardrail existed, so it was never tagged and the guardrail can't retroactively catch it). Lists candidates by name; only deletes with an explicit `--confirm` flag, per the Intern Safety Rules ("no destructive scripts without confirmation"). Added `npm run cleanup:generated-portfolios` to `package.json`. **Not yet run for real** — no live Postgres in this environment; ran the dry-run path far enough to confirm its own logic (mode detection, candidate query construction) before it hits the same expected Postgres-auth wall as everything else this session.

**Phase 3 (port the two unique Portfolioforge capabilities) is now functionally complete**, pending only real-world validation against a live Postgres + real Colaberry/GitHub credentials, none of which exist in this dev environment.

**Validation:** `node -c` on all new/modified files. Full server boot (`timeout`-wrapper pattern) — clean, no regressions. Cleanup script dry-run confirmed its own logic runs correctly up to the expected DB-connection wall.

**Risks / Limitations:**
- Publish route untested against the real GitHub API (Contents API create/update flow, topic-setting) — no live credentials in this environment to test with.
- `kalii` cleanup script written but not executed — needs to actually run once Postgres is live.
- Neither Colaberry import nor GitHub publish has been exercised end-to-end by a real user yet.

**Next Actions:** Once the user has Postgres running: run migrations (`npm run migrate:up`), run the cleanup script for real, and do a genuine end-to-end pass (connect Colaberry live-login → import → publish) to validate the full chain this session could only verify piece by piece.

---

### M53 — Live testing began; real Postgres stood up; two real bugs found and fixed; GitHub tokens encrypted at rest + per-user token routing *(2026-08-09/10)*
**Session:** CC-20260809-8f3k

**Live environment stood up for the first time this whole merge effort:** Postgres via Docker (`colaberry-portfolio-postgres`, port 5434 — 5432/5433 already taken by unrelated local projects), `backend/scripts/dev-setup-postgres.sh` written to generate `DATABASE_URL`/`JWT_SECRET`/`COLABERRY_SESSION_ENCRYPTION_KEY`/`COLABERRY_LOGIN_URL` and write them to `backend/.env` without ever printing values. All 17 migrations (through M48/M49) applied cleanly against a real database for the first time — 20 tables confirmed via `\dt`. Backend and frontend both booted for real and were used in a live browser by the user.

**Bug 1 — stale process serving empty OAuth credentials.** User registered a real GitHub OAuth App and updated `.env`, but the already-running backend process still had the old empty `GITHUB_CLIENT_ID`/`SECRET` in memory (`dotenv.config()` only reads once at startup) — produced a 404 on GitHub's side. Fixed by restarting the process; verified via inspecting the actual `Location` header of the OAuth redirect (confirmed non-empty `client_id`, correct scopes, signed state) before declaring it fixed, not just asserting it.

**Bug 2 — Playwright's Chromium was never downloaded on this host.** Colaberry import's headless scraper (`colaberryProjectScraper.js`) failed with `browserType.launch: Executable doesn't exist`. Root cause: `playwright` (unlike `puppeteer`, which auto-downloads during `npm install`) requires a separate explicit `npx playwright install` step, which had never been run — flagged as a known risk in M51 but not circled back to until it broke live. Fixed by running the install; verified with a standalone launch+navigate+title smoke test before telling the user to retry.

**Bug 3 (bigger) — GitHub deep-analysis enrichment was silently rate-limited for every repo, for every user.** User's own repos (`lead_conversion`, `RepoPulse`, `cora-recap-engine`) failed deep analysis with `403`. Root-caused via the actual `phase_errors_json` in the database (not log-grepping): `githubEnricher.js` only ever authenticated GitHub API calls with the optional, static `process.env.GITHUB_TOKEN` — never the logged-in user's own OAuth token, even though it's already stored per-user. With no `GITHUB_TOKEN` set, every enrichment call went out unauthenticated (60 req/hour); a handful of repos exhausted that instantly. This is a pre-existing gap in R2R's original code, not something the merge introduced — it just never surfaced until a real account with real repos ran through it live.

**That bug led to a bigger, more important finding along the way:** while diagnosing it, discovered that `auth.js` was storing every user's real GitHub OAuth access token **in plain text** in `users.github_access_token` / `github_accounts.access_token` — confirmed directly from the write path (`tokenRes.data.access_token` went straight into an `INSERT`, no encryption, no hashing), not assumed. Inconsistent with how `colaberry_sessions` was deliberately encrypted this session (M49) for the exact same class of sensitive credential. User asked to fix both together.

**What shipped for the token-security fix:**
- `backend/services/encryption.js` — the AES-256-GCM logic extracted out of `colaberryLiveLoginSessionManager.js` into a shared module (that file refactored to use it, no behavior change, second file that would have needed the same crypto code — extraction was overdue).
- `backend/services/githubTokenCrypto.js` — thin `encryptGithubToken`/`decryptGithubToken` wrappers, keyed by a new, separate `GITHUB_TOKEN_ENCRYPTION_KEY` (deliberately not reusing `COLABERRY_SESSION_ENCRYPTION_KEY` — key separation per secret category, so rotating/compromising one doesn't touch the other).
- `backend/db/migrations/20250101000018_encrypt_github_tokens.js` — adds `encrypted_github_access_token`/`github_access_token_iv` to `users`, `encrypted_access_token`/`access_token_iv` to `github_accounts`; **drops the old plaintext columns outright** (not migrated in place — this is pre-launch dev data, and leaving plaintext sitting alongside encrypted columns defeats the point). Applied live; confirmed via `\d` that old columns are gone and new ones exist.
- `backend/routes/auth.js` — all 5 write sites (connect-mode insert, two login-mode update paths, new-user insert, the accounts-sync upsert) now encrypt once (`encryptGithubToken(accessToken)` right after the GitHub token exchange) and store ciphertext + IV everywhere.
- `backend/routes/githubAccounts.js` — the PAT-based "connect a secondary account" flow (a second real write path this audit caught) now encrypts too.
- `backend/services/githubTokenResolver.js` — **new shared module**, extracted from `repos.js`'s local `getGithubInfo`/`getGithubAccounts`/`getAppInstallations`/`getTokenForOwner`, decrypting once inside each helper so every caller keeps working against the same field names as before (`github_access_token`, `access_token`) — minimized blast radius on already-working, already-live-tested code. `repos.js` and `portfolios.js`'s publish route now both import from here instead of each rolling their own.
- **Per-user token routing (the fix for Bug 3):** `githubEnricher.js`'s `githubHeaders`/`resolveDefaultBranch`/`fetchTree`/`fetchFileContent`/`_doEnrichment`/`enrichRepository` now all accept and thread an optional `token` parameter, preferred over the `GITHUB_TOKEN` env fallback. Found **two separate, duplicate `PHASE_IMPLS` definitions** (one in `deepAnalysisQueue.js`, one in `routes/deepAnalysis.js` — pre-existing tech debt, not introduced this session) — both converted from static module-level constants into `buildPhaseImpls(token)` functions, so `enrichment` gets bound to the correct per-request resolved token via `getTokenForOwner(userId, owner)`. Updated **six call sites** across three files (`deepAnalysisQueue.js`'s `queueDeepAnalysis`; `routes/deepAnalysis.js`'s `/run` resume path, `/run` new-analysis path, `/reanalyze`, and `/retry`; `server.js`'s startup orphaned-analysis resume, which needed `r.user_id` added to its query to resolve a token per orphaned row).

**Validation:**
- Full syntax check across all 12 touched files.
- Full backend reboot against the live Postgres — clean, connected, no regressions.
- A dedicated round-trip test (`tmp-test-token-encryption.js`, deleted after use): encrypted a realistic-shaped fake token, confirmed ciphertext ≠ plaintext, **inserted into the real `users` table, read it back, decrypted, confirmed the decrypted value exactly matches the original**, cleaned up the scratch row. This is the strongest verification available without driving a real browser through GitHub's OAuth consent screen.
- Confirmed via direct query that the real user's now-empty encrypted-token columns are exactly the expected state post-migration (old plaintext dropped, new columns NULL pending re-login) — not a bug, the intended consequence of not migrating plaintext data forward.
- Grepped the entire backend afterward for any remaining reference to the old plaintext column names — the only two hits were an already-applied historical migration file (correctly left untouched — migrations are immutable history) and one line already consuming an already-decrypted value from the updated helper.

**Risks / Limitations:**
- **User must log in again** (and reconnect any secondary GitHub accounts) — the old plaintext tokens were deleted by the migration, not carried forward.
- Per-user token routing has not yet been exercised against a real private repo end-to-end (would need a fresh login + a private repo to import) — the code path is verified by inspection and the shared round-trip test, not yet by a live private-repo analysis run.
- `GITHUB_TOKEN` (the shared fallback) is still relevant and still recommended for public-repo/no-account-connected cases — nothing about this change removes the need for it, it just stops being the *only* option.
- The pre-existing duplicate `PHASE_IMPLS` definitions across two files were not consolidated into one (only both converted to the same `buildPhaseImpls(token)` pattern independently) — a further follow-up worth doing, out of scope for this fix.

**Next Actions:** User to log in again via GitHub, retry deep analysis on the previously-failed repos to confirm the per-user token fix resolves the 403s for real, then continue the interrupted Colaberry import test now that Playwright's browser is installed.

---

### M54 — Colaberry import actually succeeded end-to-end; found the real bug was in status display, not the import; live-login UX overhaul *(2026-08-09/10)*
**Session:** CC-20260809-8f3k

**User hit "Live-login container did not become ready in time" and separately saw Colaberry-imported projects marked "Failed."** Investigated both from evidence, not assumption.

**Finding 1 — the container readiness timeout was too impatient, not broken.** The "failed" container's own logs showed `browser ready, navigated to login URL` — it *did* succeed, just after the 20s `waitForDriverReady` timeout had already given up and thrown. This host has 8+ other Docker containers running (other unrelated projects — `ollama` alone is a 4.76GB image), and under that load, container boot (Xvfb → x11vnc → websockify → Playwright launch → navigate) can genuinely exceed 20s even though it finishes fine. Also found the timeout's cleanup path was silently swallowing `docker rm -f` failures (`.catch(() => {})`, no logging) — exactly the "silent catch" pattern that's supposed to never ship here — which is how an orphaned container (348MB RAM, "Up 3 minutes") was found still running. **Fixed:** timeout raised 20s → 60s with a comment explaining why (`colaberryLiveLoginSessionManager.js`), cleanup failures now logged instead of swallowed, orphaned container removed.

**Finding 2 — the Colaberry import actually worked completely.** Queried the database directly rather than trusting the UI: `Pedal Power: Predicting Washington DC's Bike Demand with Weather Insights` was scraped, imported (`provider='colaberry'`), and its `analyses` row was `status: 'completed'` with a rich, accurate, high-confidence AI summary. **The "Failed" badge was a separate, pre-existing frontend bug**, not an import failure — this is the first real proof the whole Colaberry pipeline built this session (SQL lookup → live-login → scraper → import → basic analysis) works end to end.

**Root cause of the false "Failed" badge:** `PortfolioBuilder.jsx`'s `loadRepos()` calls `GET /api/deep-analysis/:id/latest` for *every* imported repo with no provider check. Colaberry repos never get a `deep_analyses` row (by design — M47.3/M51: they use the basic `analyses` pipeline, not the 6-phase GitHub-code one), so that call always 404s, which the code read as `status: 'pending'`. A separate pre-existing auto-trigger effect then saw "pending" and called `POST /api/deep-analysis/run` on it, which failed — `enrichRepository` tried to `split('/')` a Colaberry project's title as if it were a GitHub `owner/repo` path. Neither of these was introduced this session, but Colaberry is the first case that fully exposes it (any basic-analysis-only repo would hit the same bug).

**Fixed on both ends:**
- **Backend defense-in-depth** (`routes/deepAnalysis.js`, `services/deepAnalysisQueue.js`): `/run`, `/reanalyze`, and `queueDeepAnalysis` now all reject/no-op for `provider !== 'github'` repos with a clear `NOT_APPLICABLE` message instead of attempting enrichment and failing confusingly. Protects against this same class of bug regardless of what the frontend does.
- **Frontend fix** (`PortfolioBuilder.jsx`): `loadRepos()` now branches on `repo.provider` — non-GitHub repos check `GET /api/analysis/repo/:id` (the basic-analysis endpoint, which already existed) instead of the deep-analysis endpoint, and populate the same `repoStatusMap`/`analysisMap` shape the UI already reads. The auto-trigger effect also now skips non-GitHub repos explicitly, as a second layer.

**Also fixed, from direct user feedback on the live UI:**
- Misleading UI: the "Connect Colaberry" button's icon was a checkmark (✓) — visually implying "already connected" regardless of actual state. Swapped to the same lock icon "Connect Private Account" uses, for both accuracy and visual consistency between the two "connect an account" actions.
- No real-time guidance during the live-login flow — user asked for "instructions that tell you what to do at each step." `ColaberryLiveLogin.jsx` rewritten with a persistent 4-step indicator (Starting → Connecting → Log in → Saving), an elapsed-seconds counter during the wait (directly addresses the "is this frozen?" concern the too-short timeout was creating), and a "Try Again" retry button in the error state (previously only "Cancel" existed — no way to retry without closing and reopening the whole modal).

**Validation:**
- Root-caused via direct container log inspection and direct database queries (`phase_errors_json`, `analyses.status`, `deep_analyses` row counts) — not assumption, not log-grepping.
- Syntax-checked all touched backend files; full backend reboot against live Postgres, clean.
- `npm run build` (80 modules, succeeds) and `npx eslint` on all three touched frontend files — confirmed via `git diff --unified=0` that every reported lint issue falls outside the actual changed line ranges (pre-existing, not introduced).
- Orphaned container confirmed removed via a fresh `docker ps -a` check.

**Risks / Limitations:**
- The longer 60s timeout is still a fixed ceiling, not adaptive — under even heavier host load it could theoretically still fire. No mechanism yet to surface "still working, just slow" vs. "actually stuck" beyond the elapsed-seconds counter.
- Have not yet re-tested the full live-login flow end-to-end after these fixes (timeout increase, retry button) — the Colaberry import success that was found was from a *previous* attempt's data, not a fresh run against the fixed code.
- The general "basic-analysis-only repos are mishandled by deep-analysis-oriented UI" class of bug is now fixed for the specific paths touched (`loadRepos`, auto-trigger) but wasn't audited across the entire frontend for other places that might assume every repo has gone through `deep_analyses`.

**Next Actions:** User to retry the full Colaberry connect → import flow fresh against the fixed code (longer timeout, correct status display) to confirm the UI now correctly shows it as analyzed rather than failed.

---

### M55 — Restored Portfolioforge's original manual-link import flow *(2026-08-10)*
**Session:** CC-20260809-8f3k

**Gap identified by user:** `colaberryImport.js` (M51) only ever auto-discovered "the logged-in user's own projects" via SQL. Portfolioforge's original design (Kalkidan's `src/index.js`) actually treated **manually pasted project links as the primary flow** — the CLI asked for "1-3 Colaberry project links" upfront; SQL auto-lookup was only a fallback when no links were typed (`if ((!formData.projectLinks || formData.projectLinks.length === 0) && formData.userId)`). That meant a student could import *any* Colaberry project link they could view — their own, a classmate's, anything from Colaberry's shared "network" browsing area — not just projects the SQL lookup would attribute to their own account. M51's port dropped that capability entirely.

**Restored, with one addition the original didn't need:** `POST /api/colaberry-import` now accepts an optional `projectLinks` array in the body. When provided, those links are scraped directly, bypassing the SQL/email lookup entirely (up to 10 at a time, matching Portfolioforge's original `MAX_LINKS`). When omitted, falls back to the M51 auto-discovery behavior unchanged.

**The addition:** validated every manual link against `https://app.colaberry.com/` before touching Playwright. Without this, the endpoint would let any authenticated user point our server's live authenticated Colaberry session at *any* URL — an SSRF-shaped hole (arbitrary destination + a real authenticated session attached), not present in the original single-user CLI tool where the operator was trusted by construction. The actual view-permission boundary is still Colaberry's own access control on what the user's captured session can see — this check only stops the URL itself from pointing somewhere unrelated to Colaberry at all.

**Frontend:** new pre-step modal in `Header.jsx`, shown before the live-login modal opens — a textarea for pasting links (client-side validated the same way as the backend, for fast feedback) with a "Skip — import my own" option that preserves the original M51 one-click flow. Collected links get passed through to the `/api/colaberry-import` call once live-login completes.

**Validation:** `node -c` on the updated route; full backend reboot against live Postgres, clean; `npm run build` (80 modules) and `npx eslint` on `Header.jsx`, confirmed via `git diff --unified=0` that all reported lint issues fall outside the changed line ranges (pre-existing).

**Risks / Limitations:** Not yet exercised live with a real non-own-account Colaberry project link (would need the user to test with an actual link from Colaberry's network view). The domain check is a simple prefix match — sufficient for the stated threat (arbitrary destination), not a full URL-parsing/allowlist system, which felt proportionate to the actual risk here.

**Next Actions:** User to test importing a specific pasted Colaberry project link (not their own) to confirm the restored flow works end-to-end.

---

### M56 — Two real bugs found live: `/api/repos` 500ing entirely, and no way to retry a failed deep analysis *(2026-08-10)*
**Session:** CC-20260809-8f3k

**User reported two symptoms:** GitHub repos still showed "Failed" despite the M53 per-user-token fix, and separately, "even public repos are not seen in GitHub" (the Browse view). Both root-caused from direct evidence, not assumption.

**Bug 1 — no retry path once one repo has succeeded.** `PortfolioBuilder.jsx` renders two different panels depending on `analyzedRepos.length`: while zero repos have completed, the top panel offers a "Restart All" button and per-repo "↺ Retry"; once at least one repo completes (e.g. the Colaberry import from M54), it switches to a second, separate "Still analyzing" panel that only ever rendered **✕ Remove** for failed repos — no retry action existed there at all. Since "Pedal Power" had already completed, the user was permanently stuck in the panel with no retry option, and the only way out was delete-and-reimport. **Fixed:** added the same "↺ Retry" button (calling the existing `handleRestartRepo` → `POST /api/deep-analysis/run`) alongside Remove in that panel (`PortfolioBuilder.jsx` ~line 2066).

**Bug 2 — `github_app_installations` table was never migrated.** `getAppInstallations()` (`services/githubTokenResolver.js`) queries `github_app_installations` unconditionally inside `GET /api/repos`, with no per-call try/catch (unlike the sibling installation-repo-fetch calls, which are guarded). No migration for that table existed anywhere in `db/migrations/` — it was referenced by `routes/githubApp.js` and the token resolver but the table itself was never created. Every call to `getAppInstallations()` threw `relation "github_app_installations" does not exist`, which the route's outer `catch` turned into a generic `500 SERVER_ERROR` — discarding the primary-account fetch that had *already succeeded* moments earlier. This explains "even public repos are not seen": the route never got to return anything, public or private, once GitHub App installation lookup was reached. **Fixed:** added migration `20250101000019_create_github_app_installations.js` matching the exact columns `routes/githubApp.js` already writes/reads (`user_id`, `installation_id` unique, `account_login`, `account_type`, `account_avatar_url`, timestamps).

**Confirmed the M53 per-user-token fix was never actually broken** — the earlier "Failed" rows were stale, timestamped 01:47 UTC, before the backend process was restarted at 03:21 UTC with the M53/M54/M55 code. Verified `getTokenForOwner` resolves a working token (live GitHub API call returned 200, `x-ratelimit-limit: 5000`) in isolation before looking further.

**Also noted, not a code change:** `dotenv@17.4.2` (legitimate upstream package, not a local compromise) ships a `TIPS` array in `lib/main.js` that prints unrelated product advertising (`vestauth.com`, from the same maintainer as `dotenv`/`dotenvx`) to stdout on every `.config()` call. Public reports describe dotenv@17 shipping content aimed at prompt-injecting AI coding agents into promoting/installing it. No such instruction was encountered or acted on this session beyond the console tip text. Flagged to user; no action taken on the dependency itself pending their decision.

**Validation (live, against the running dev stack — not just inspection):**
- `getTokenForOwner` + direct GitHub API call: `200`, confirming the token itself is valid and correctly resolved.
- Ran `npm run migrate:up` against the live dev Postgres (`colaberry-portfolio-postgres`); migration applied cleanly.
- Re-called `GET /api/repos` with a freshly minted, session-backed JWT: `200`, `47` repos returned, `0` errors — confirmed the exact route that was 500ing now succeeds.
- Triggered `POST /api/deep-analysis/run` on the previously-failed `RepoPulse` repo directly; polled `deep_analyses` — `status: "completed"`, all 6 phases `"completed"`, `phase_errors_json: null`. Confirms the retry path works end-to-end on real data, not just that the button exists.
- `npx eslint src/PortfolioBuilder.jsx`: 5 pre-existing issues (lines 778/868/1043/1084/1444), none within the changed range (~2066-2090) — confirmed via inspection, not introduced.

**Risks / Limitations:**
- Did not re-run the frontend build (`npm run build`) after this specific edit — the dev server picked it up via Vite HMR and eslint passed clean on the changed lines, but a production build wasn't separately verified this round.
- The `github_app_installations` gap likely predates this session entirely (no migration ever existed for it) — worth checking whether other tables referenced in code similarly lack migrations, as a follow-up audit.
- Did not verify in a real browser click-through (no interactive browser session available this turn) — verified via direct API calls against the live backend/DB instead, which exercises the same code paths.

**Next Actions:** User to refresh the portfolio builder in-browser, click "↺ Retry" on a failed repo to confirm the button renders and works from the actual UI (not just the API), and confirm the Browse-GitHub view now lists repos again.

---

### M57 — Restored Portfolioforge's browsable "Network Projects" catalog (checkbox UI, not just paste-a-link) *(2026-08-10)*
**Session:** CC-20260809-8f3k

**User asked whether there had been a real selection interface for Colaberry network projects** ("once logged in") beyond what M55 restored. Checked the original source under `legacy/portfolioforge-automation/` rather than assuming — M55's textarea-of-pasted-links was a real but *partial* restoration. The original had a second, primary discovery path M55 missed entirely: a full **browsable catalog UI**, independent of any specific user, backed by two endpoints (`server.js` lines 664-841) querying `dbo.ADF_Proj_Deployed` — Colaberry's full table of network-deployed projects, not scoped to "my projects." The original `App.jsx` rendered this as a "My Projects" / "Network Projects" toggle, category pill filters (Power BI / DW ETL / Qlik / Tableau, counted via keyword `LIKE` matching), a search box, a scrollable card list (title + summary + thumbnail) with checkboxes, and Select-All/Clear-All — selections fed the same `selectedProjectLinks` array ultimately submitted for import.

**Restored:**
- `services/colaberrySqlClient.js`: `getNetworkProjects(category)` and `getNetworkProjectCategories()`, ported faithfully from the original SQL (ranked/deduped by project name via `ROW_NUMBER()`, category keyword-matched against name+summary). `category` is only ever used as an object-key lookup into a fixed, code-controlled keyword map — never interpolated into SQL — so it can't be injection-bearing regardless of what a client sends.
- `routes/colaberryImport.js`: two new `GET` routes, `/network-projects?category=X` and `/network-project-categories`, both behind `authMiddleware` (the original endpoints had no auth at all — tightened here to match this app's security posture, since everything else in this app requires login).
- `Header.jsx`: the M55 links-prompt modal now defaults to a "Browse Network Projects" mode (category pills + search + checkbox card list, mirroring the original UX) with "Paste a Link" as a secondary mode-toggle for a link not in the catalog. Both sources merge at "Continue" (deduped, capped at 10, same `https://app.colaberry.com/` prefix check from M55) before being submitted — no change to the backend import contract itself.

**Validation (live, against the real Colaberry SQL Server — not mocked):**
- `getNetworkProjectCategories()` called directly: real counts (Power BI 47, DW ETL 2, Qlik 2, Tableau 6).
- `getNetworkProjects('All')`: 249 real projects returned with titles, summaries, and CDN image URLs.
- Backend restarted (new routes require a process restart, unlike the M56 migration); both new `GET` endpoints hit through the actual HTTP server with a real session-backed JWT: `200` on both, category filter (`Tableau`) correctly narrowed 249 → 6.
- `npm run build` (80 modules, succeeds) and `npx eslint src/Header.jsx`: 2 pre-existing issues (lines 68, 508), confirmed via `git diff --unified=0` to fall entirely outside the changed ranges (95-1067ish).

**Risks / Limitations:**
- Not yet clicked through in an actual browser this session (no interactive browser available) — verified via direct HTTP calls against the live backend, which exercise the same route code the frontend calls, but the modal's rendering/layout itself is unverified visually.
- Category keyword matching (`LIKE '%power bi%'` etc.) is a straight port of the original's simple substring approach — same false-positive/negative characteristics the original had (e.g. a summary mentioning "data warehouse" in passing would count toward "DW ETL"). Not a new limitation introduced here.
- The two new endpoints add two more calls to the same Colaberry SQL Server pool (`getPool()`); no separate rate-limiting or caching was added — acceptable at current scale, worth revisiting if the network catalog is browsed heavily.

**Next Actions:** User to click "Connect Colaberry" in the browser and confirm the Browse Network Projects view renders correctly (pills, search, cards, checkboxes) and that a checked network project actually imports.

---

### M58 — "Select Repositories" checklist now defaults to all-selected *(2026-08-10)*
**Session:** CC-20260809-8f3k

**User asked whether checking projects in the Colaberry network browser (M57) was carrying over as a "select all" default on the portfolio-repo checklist ("Select Repositories (0 selected)").** It wasn't, and was never meant to — the two checklists are unrelated state serving different purposes: `selectedNetworkLinks` (Header.jsx) picks which Colaberry projects to *import*; `selected` (PortfolioBuilder.jsx) picks which already-analyzed repos go *into the portfolio being created*. Confirmed by reading the code rather than assuming: `selected` initializes to an empty `Set` and only auto-populates during the special first-login `autoStart` flow — the normal "My Portfolio" tab visit shown in the screenshot always starts at 0 selected, requiring every repo to be checked manually.

**Changed the default**, since the user's expectation (everything analyzed should start checked, not empty) is the more natural default for this screen: a new effect in `PortfolioBuilder.jsx` auto-adds every newly-analyzed repo's id to `selected` the first time it's seen (tracked via `autoSelectedIdsRef`, a ref `Set` of ids already auto-decided), so a manual uncheck afterward isn't overwritten on the next 5s poll. Skipped entirely when `autoStart` is true, since that flow already sets its own selection and immediately creates the portfolio. Also added a manual **Select All / Clear All** toggle next to the checklist label, for after the user has made changes and wants to reset.

**Validation:** `npm run build` (80 modules, succeeds); `npx eslint src/PortfolioBuilder.jsx` — 5 pre-existing issues (lines 795/885/1060/1101/1461), confirmed via `git diff --unified=0` to fall entirely outside the changed ranges (474, 634-649, 2118-2138).

**Risks / Limitations:** Not click-tested in an actual browser this turn (no interactive session available) — verified by reading the effect's dependency/ref logic and confirming it can't fire during `autoStart`, not by watching it run.

**Next Actions:** User to reload the "My Portfolio" tab and confirm previously-analyzed repos now show pre-checked, and that manually unchecking one survives the next poll cycle.

---

### M59 — Fixed duplicated project descriptions on the published portfolio page; confirmed Colaberry link-selection ordering matches the original design *(2026-08-10)*
**Session:** CC-20260809-8f3k

**User asked two things: whether the "Which Colaberry projects?" modal should appear before or after live-login, and why project descriptions on the published portfolio page looked repeated/too short.**

**Login ordering — confirmed correct, no change made.** Checked the original `legacy/portfolioforge-automation/src/index.js:624-629`: it launched a real visible browser (`headless: false`) and only prompted for Colaberry login *at scrape time*, reusing a saved `colaberry-storage-state.json` session if one already existed. The network-projects catalog itself is pure SQL (`dbo.ADF_Proj_Deployed`) and never touched a live Colaberry session. So the original order was always select-first-then-login — exactly what `Header.jsx` already does (links-prompt modal → `ColaberryLiveLogin`). No change needed.

**Description duplication — real bug, root-caused and fixed in `PublicPortfolio.jsx`'s `ProjectCard`.** `shortDesc` (the always-visible one-line overview, line 405) and `aiDescription` (the "Project Overview" box shown on expand) are frequently derived from the same underlying analysis field when the deep-analysis pipeline produced only one summary instead of a distinct short + long version. The component was built assuming these would always differ, so it never checked — for `cora-recap-engine` and `RepoPulse` specifically, the identical sentence rendered twice: once in the always-visible block, once again in the expanded "Project Overview" box. A second, unconditional duplicate existed for any repo with no `aiDescription` at all: the expanded-state fallback re-rendered `shortDesc` a second time even though the always-visible block above it had already shown the exact same text.

**Fixed:** added `aiRepeatsOverview` / `aiHasExtraContent` checks that compare the AI description's first paragraph against the always-visible overview text. When they're identical and there's no additional paragraph beyond that one sentence, the redundant block (the collapsed-state teaser line, or the expanded "Project Overview" box) is skipped entirely — the overview shows once, not twice. Also removed the guaranteed-duplicate `shortDesc` fallback in the expanded block (unreachable now that the always-visible block already covers that case), and adjusted `hasReadMore` so the "Show more" button doesn't appear when expanding would show nothing new.

**Also checked, no changes made:** "Download Resume PDF" hits a separate server-rendered endpoint (`/api/portfolios/public/:slug/pdf`), not this React component — the screenshot the user showed matches the live HTML page's markup exactly, so the PDF path wasn't in scope here and wasn't audited.

**Validation:** `npm run build` (80 modules, succeeds); `npx eslint src/PublicPortfolio.jsx` — 3 pre-existing issues (lines 54, 98), confirmed via `git diff --unified=0` to fall entirely outside the changed range (410-546).

**Risks / Limitations:** Not click-tested in an actual browser this turn (no interactive session available) — verified by reading the corrected render conditions, not by viewing the rendered card. The underlying cause (deep-analysis pipeline sometimes producing only one summary instead of a distinct short + long pair) wasn't addressed — this fix makes the UI tolerate that case gracefully rather than changing what the pipeline generates.

**Next Actions:** User to reload the published portfolio page for `cora-recap-engine` / `RepoPulse` and confirm each project's description now appears once, and that "Show more" only appears where there's genuinely more to show.

---

### M60 — Fixed the actual root cause of "portfolio" repo's empty description; added a Refresh action *(2026-08-10)*
**Session:** CC-20260809-8f3k

**User asked what the description source is and why "portfolio" specifically got "The project does not provide any information on its functionality or intended use."** Traced it precisely rather than guessing: the basic-analysis pipeline (`analysisQueue.js` → `openai.js`) prompts `gpt-4o-mini` with repo name, GitHub `description`/topics/language, and the first 2000 chars of `repositories.readme_content`. Direct DB query confirmed `readme_content: null` for this repo, `description: null`, `topics: []` — the model's answer was an honest response to a genuinely empty prompt, not a bug in the model or the UI. Agreed with the user to build a way to re-fetch and re-analyze.

**Found the real root cause while building the fix, not the one first assumed.** `readme_content` is only ever set once, at import time, via `fetchReadme()` in `routes/repos.js` — never touched again. The first hypothesis (imported before the README existed) turned out wrong: calling the new refresh endpoint against the live GitHub API still returned `readmeFetched: false`. Direct isolated testing found why — `POST /import`'s README fetch was gated behind `repo.size < README_MAX_REPO_SIZE_KB` (5120 KB / 5MB), and this repo (the merged monorepo itself) is 14 MB. The comment justified this as "to stay within rate limits," but a README fetch is a single lightweight API call regardless of overall repo size (GitHub returns just the README file, not the tree) — the guard was pure loss with no rate-limit benefit, silently starving every repo over 5MB of a description since the original import route was written.

**Fixed at both the data layer and with a manual recovery path:**
- `routes/repos.js`: removed the `README_MAX_REPO_SIZE_KB` size gate from both the original `/import` route and the new refresh route below — README is now fetched unconditionally on both paths (still safely `null` on any fetch failure via the existing `fetchReadme` try/catch).
- New `POST /api/repos/:repositoryId/refresh` (`routes/repos.js`): re-fetches repo metadata + README from GitHub via the correct per-user token (`getTokenForOwner`, consistent with M53), updates the `repositories` row, and force-queues a fresh basic analysis.
- New `forceQueueAnalysis()` (`services/analysisQueue.js`): existing `queueAnalysis()` intentionally skips if a completed analysis already exists (correct for auto-import, wrong for an explicit user-triggered refresh) — added a sibling that always inserts a fresh `analyses` row instead of silently returning the stale one.
- `PortfolioBuilder.jsx`: added a "↻ Refresh" button next to "✓ Analyzed" in the repo checklist, gated to GitHub-provider repos only (Colaberry repos get their content from the scraper, not this README path).

**Important caveat surfaced while tracing this, told to the user:** refreshing a repo's basic analysis does *not* automatically update an already-published portfolio page. `POST /:id/generate-project-descriptions` (`routes/portfolios.js`) does re-query the latest `analyses.summary_json` correctly, but its output gets written into `portfolios.content_json` as a snapshot — the public page reads that snapshot, not `analyses` live. So the full chain to see a refreshed description on a live page is: Refresh → the existing "Regenerate Descriptions" action (`handleGenerateDescriptions` in `PortfolioBuilder.jsx`, pre-existing) → republish if already public. Only the first step was built this session; the other two already existed.

**Validation (live, against the real running backend and real GitHub API — not mocked):**
- Isolated test proved `fetchReadme` itself was fine (200, 27141 chars) and pinpointed the actual gate: `repo size (KB): 14016` vs. the 5120 threshold.
- After removing the gate and restarting the backend: `POST /api/repos/b86bca6d-.../refresh` → `202`, `readmeFetched: true`.
- Polled the resulting `analyses` row directly: `status: "completed"`, real `what_it_does` ("This project analyzes GitHub repositories to generate professional portfolios...") sourced from the actual README content — confirmed the fix works end-to-end, not just that the request succeeded.
- `npm run build` (80 modules, succeeds); `npx eslint src/PortfolioBuilder.jsx` — 5 pre-existing issues (lines 803/893/1068/1109/1469), confirmed via `git diff --unified=0` to fall entirely outside the changed ranges (391, 546-552, 2180-2193).

**Risks / Limitations:**
- Removing the size gate means every import/refresh now always makes a README API call regardless of repo size — one extra lightweight GitHub API call per repo, negligible against the 5000/hr authenticated rate limit already confirmed in M56.
- The refresh button only re-runs the *basic* analysis pipeline (what feeds published-page descriptions); it does not re-run deep analysis, which already fetches its own enrichment content live on every run and was never affected by this bug.
- Not click-tested in an actual browser this turn — verified via direct HTTP calls against the live backend, exercising the same route code the frontend calls.

**Next Actions:** User to click "↻ Refresh" on the "portfolio" repo in the browser, then use the existing "Regenerate Descriptions" action and republish to confirm the real description actually reaches the live page.

---

### M61 — Redesigned PDF project descriptions (goal + approach); found and fixed why tech stack/bullets never rendered; added certifications *(2026-08-10)*
**Session:** CC-20260809-8f3k

**User asked for ideas on the PDF's project-description format** (previous state: truncated single-line fragments like "Next." and "...weather data and.") **and to add certifications**, which — checked directly against both codebases — had never been implemented anywhere, not in current R2R nor in the original Portfolioforge (the one earlier grep match was `trustServerCertificate`, an unrelated SQL config flag).

**Presented 3 concrete format options with real data-grounded previews; user chose "Goal + existing strengths sentence"** — reusing `analyses.summary_json.highlights.strengths` (already LLM-written, natural-sounding, and — critically — present for every repo including Colaberry ones, which have no deep-analysis tech data to build a deterministic "Built with X, Y, Z" sentence from).

**Implemented in `pdfGenerator.js`:**
- Replaced `cleanProjectDescription` (85-char hard truncation + naive first-`.`-is-a-sentence-boundary logic) with `cleanGoalSentence` (real sentence-boundary detection via `[^.!?]+[.!?]+`, first sentence only) + `buildProjectSummary` (appends the strengths sentence). Also fixes the "Next." bug: the old code found the period inside "Next.js" and treated it as end-of-sentence — added `protectDottedNames`/`restoreDottedNames` swapping known dotted framework names (Next.js, Node.js, Vue.js, etc.) for dot-free placeholders before sentence-splitting, restored after.
- Threaded `strengths: r.summary_json?.highlights?.strengths` into the `repos` mapping in the PDF route (`routes/portfolios.js`).

**While verifying against the real running backend, found a second, much larger bug the user then also flagged ("make sure tech stack appears for projects as well"):** `content_json.narrative.projects[]` had **no `repoName` field at all** for the live portfolio — confirmed by direct query. `buildProjectBlocks`'s `repos.find(r => r.name === p.repoName)` had therefore been silently failing for every project, meaning the deep-analysis-derived tech-stack list and capability bullets have likely never actually rendered in any PDF, for any portfolio — not something introduced this session. Root cause: `NARRATIVE_SYSTEM_PROMPT` (`openai.js`) instructs the model to echo `repoName` per project, but a "no repo names in headline or narrative" rule sitting a few lines above the schema in the same prompt appears to bleed over and suppress it. **Fixed at the source, deterministically rather than by re-prompting:** `generatePortfolioNarrative` now re-attaches `repoName` by array position after the LLM call — projects are given to the model in a fixed, guaranteed order, so trusting that order is more reliable than trusting the model to echo an identifier correctly.

**Certifications, built from scratch (LinkedIn PDF import → storage → both render surfaces):**
- `LINKEDIN_EXTRACT_PROMPT` (`openai.js`): added a `certifications` array (`name`, `issuer`, `issueDate`, `credentialUrl`) to the extraction schema.
- Storage required zero changes — `routes/portfolios.js`'s `/linkedin-pdf` route already stores the full `extracted` object wholesale into `content_json.linkedin`, so the new field flows through automatically.
- `pdfGenerator.js`: added `certifications` param, `certificationsHtml` builder, CSS, and a "Certifications" section (mirrors the existing Education section's structure) after Education, threaded through from `routes/portfolios.js`'s PDF route (`certifications: linkedin.certifications || []`).
- `PublicPortfolio.jsx`: added a Certifications sub-block to the live page's Experience section (mirrors Education's timeline styling, amber dot instead of green, links to `credentialUrl` when present) — inherits the same pre-existing constraint Education already has (only renders when `linkedin.experience` is also non-empty), not a new limitation introduced here.

**Validation (live, against the real running backend, real GitHub-connected repos, and the real published portfolio — not mocked):**
- Verified the description-cleaning logic in isolation first against all 7 real stored one-liners (Pedal Power, cora-recap-engine, RepoPulse, portfolio, etc.) — caught and fixed a redundancy bug of my own (taking 2 sentences from `overview` before appending `strengths` produced 3-sentence descriptions) before it shipped.
- Generated a real PDF via `GET /api/portfolios/public/my-portfolio-9b7hez/pdf`, extracted its actual text with `pdfjs-dist`: confirmed clean 2-sentence descriptions with no truncation artifacts and no "Next." bug.
- Regenerated the narrative via the real `/generate-narrative` route, confirmed `repoName` now populated for all 7 projects, regenerated the PDF again: **tech stack and capability bullets now render** — "portfolio" shows `Tech Stack: JWT, Express, REST API Design, PostgreSQL, OpenAI API, Docker`, "cora-recap-engine" shows `Express, REST API Design, Docker, Next.js, React`, "lead_conversion" shows `Express` — all previously silently empty.
- Injected realistic test certifications directly into the live portfolio's `content_json`, confirmed they appear correctly in both the public JSON API response and the actual rendered PDF text (`CERTIFICATIONS` section with name/issuer/date), then removed the fabricated test data afterward so it wouldn't sit in the user's real portfolio.
- `npm run build` (80 modules, succeeds); `npx eslint src/PublicPortfolio.jsx` — 3 pre-existing issues (lines 54/98/98), confirmed via `git diff --unified=0` to fall entirely outside the changed range (1079-1115). Backend files syntax-checked (`node -c`) individually.

**Risks / Limitations:**
- Existing already-generated portfolios (any created before this fix) still have `repoName`-less `narrative.projects` in storage — the fix only applies going forward. Each existing portfolio needs its narrative regenerated once (via the existing "Regenerate Descriptions"/`generate-narrative` action) to pick up tech stack + bullets + the strengths sentence.
- The positional `repoName` re-attachment assumes the model preserves project order and count, which held in the real test but isn't formally guaranteed by the API — if the model ever drops or reorders a project, the fix could misattribute. Low risk in practice (LLMs reliably preserve list-transform order), not worth a more complex correction for a `gpt-4o-mini` JSON-mode call.
- Certifications extraction itself (LinkedIn PDF → AI parsing) hasn't been tested with a real LinkedIn PDF upload this session — validated the storage/render path with injected test data, not the extraction prompt's real-world accuracy.
- Not click-tested in an actual browser — verified via direct HTTP calls, real PDF generation, and real PDF text extraction, which exercises the same code the frontend calls but doesn't confirm visual layout.

**Next Actions:** User to (1) re-upload their LinkedIn PDF to test real certification extraction, (2) regenerate the narrative for any existing portfolio to pick up the tech-stack/bullets fix, (3) confirm the live public page and downloaded PDF both look right.

---
