<div align="center">

# Repo2Reputation

### Transform GitHub repositories into recruiter-ready portfolios using AI-powered repository intelligence.

![Repo2Reputation Workflow](docs/images/repo2reputation-workflow.png)

> AI-powered workflow: GitHub Repository → Deep Analysis → Skill Inference → Portfolio Generation → Recruiter Search

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=flat-square&logo=openai&logoColor=white)](https://openai.com)

</div>

---

## The Problem

Students and early-career developers often have strong GitHub profiles but struggle to:

- **Explain technical complexity** — a repository alone doesn't communicate architecture decisions or engineering depth
- **Showcase real skills** — commit history doesn't translate to a recruiter-friendly skill narrative
- **Build professional portfolios** — most tools require manual writing, not derived intelligence from actual code
- **Communicate project value** — what a project does and what engineering it demonstrates are two different things

---

## The Solution

Repo2Reputation reads your GitHub repositories and does the work for you.

```
GitHub Repositories (any account — public or private)
        ↓
  AI Repository Analysis
  (technology detection, architecture signals, code patterns)
        ↓
  Deep Intelligence Pipeline
  (capabilities, business value, resume impact statements)
        ↓
  Portfolio Generation
  (narrative, headline, project descriptions, skills)
        ↓
  Recruiter-Ready Public Portfolio
  (shareable URL + downloadable PDF resume)
```

---

## Why Repo2Reputation?

Most portfolio builders ask developers to manually write project descriptions and skills.

Repo2Reputation analyzes actual repository code, architecture, technologies, and engineering patterns to generate portfolio content grounded in evidence rather than self-reported skills.

This creates a more accurate and recruiter-friendly representation of a developer's capabilities.

---

## What the Platform Generates

✓ Professional Headline  
✓ About Me Narrative  
✓ Engineering Strengths  
✓ Project Descriptions  
✓ Public Portfolio  
✓ PDF Resume  
✓ Recruiter Search Profile  

---

## Product Demo

![End-to-end Demo](docs/images/demo.gif)

**End-to-end flow:**
GitHub Import → Background Analysis → Portfolio Builder → LinkedIn PDF Auto-fill → Published Portfolio → PDF Resume

---

## Product Features

### Repository Analysis

The AI analysis pipeline inspects each repository and surfaces:

- **Technology detection** — frameworks, languages, and tools with confidence scoring
- **Architecture insights** — patterns inferred from code structure and file organization
- **What it does** — plain-language summary from an end-user perspective
- **Deep intelligence** — business domain, operational capabilities, engineering strengths

---

### Portfolio Builder

A structured editor that lets developers review and refine AI-generated content:

- **LinkedIn PDF auto-fill** — Step 1: upload your LinkedIn PDF to auto-fill name, headline, location, email, experience, and education; extracted skills are automatically merged into the Top Skills section
- **Headline generation** — professional title derived from repository signals
- **About Me narrative** — first-person summary written from capability signals, not project names
- **Project descriptions** — 2–4 paragraph project overviews drawn from deep analysis data
- **Publish controls** — one click to go live with a public URL

---

### Public Portfolio

A clean, recruiter-facing profile that communicates engineering depth at a glance:

- **Skills sidebar** — technologies grouped by category (Frontend, Backend, DevOps, AI, etc.) shown as green chips
- **Project cards** — title, one-line summary, always-visible first paragraph, and "Show more" for full AI analysis
- **Experience timeline** — work history and education from LinkedIn
- **PDF resume download** — Puppeteer-rendered resume from the same data
- **Shareable URL** — `yoursite.com/portfolio/<slug>`

---

## How It Works

### Stage 1 — Basic Analysis

> Routes: `/api/analysis`  ·  Service: `openai.js`

GPT-4o-mini inspects repository metadata and README content to extract:

| Signal | Description |
|---|---|
| Technology stack | Frameworks, languages, tools with confidence scores |
| What it does | End-user summary in plain language |
| Key takeaways | Positive signals and gaps (e.g. no tests detected) |
| Confidence label | High / Medium / Low based on evidence strength |

---

### Stage 2 — Deep Analysis Pipeline

> Routes: `/api/deep-analysis`  ·  Service: `deepAnalysisPipeline.js`

A multi-phase pipeline that goes beyond metadata. **Analysis runs automatically in the background after import** — no manual trigger required.

```
Phase 1 — File Classification + Semantic Chunking
  Classify every file by type. Chunk README and source files for analysis.

Phase 2 — Code Intelligence
  Detect architecture patterns, API design, data models, and code complexity.

Phase 3 — Inference Engine
  Infer engineering capabilities from observed patterns. What can this developer build?

Phase 4 — Intelligence Agents
  Extract business domain, operational capabilities, resume impact statements,
  and portfolio narrative hooks.
```

**Analysis UX:**
- Live elapsed timer ("Running for 45s…") turns amber after 2 minutes
- Stop, Retry, and Restart All controls available on both Browse and Portfolio tabs
- Auto-clearing "Analyzing…" badge disappears when analysis completes

---

### Stage 3 — Portfolio Generation

> Routes: `/api/portfolios`  ·  Service: `openai.js`

Two separate GPT calls produce the final portfolio content:

**Narrative generation** — produces the About Me section:
- First-person professional narrative (never mentions repo names)
- Professional headline
- Engineering strengths list
- Top skills ranked by evidence weight

**Project description generation** — produces per-project overviews:
- 2–4 prose paragraphs per repository
- Grounded in deep analysis signals only
- Describes architecture, capabilities, and impact

---

## Multi-Account GitHub Access

Repo2Reputation supports connecting multiple GitHub accounts — personal accounts, organizations, and accounts with private repositories.

**Primary account** — signed in via GitHub OAuth. All public and private repos are accessible.

**Additional accounts** — install the Repo2Reputation GitHub App on any account you own. The App grants read access to all repos on that account (public and private) without OAuth session conflicts.

**Install flow:**
```
Settings → "Install GitHub App on Another Account"
        ↓
GitHub App installer (pick account + repos)
        ↓
Redirect back to app → account card appears in Browse
        ↓
Repos from all accounts visible in one place
```

All connected accounts appear as filter cards in Browse GitHub Repos with a "Public + Private" badge.

---

## Key Benefits

### For Developers & Students

- Turn a GitHub profile into a professional portfolio in minutes
- Browse repos from multiple GitHub accounts (personal + org + private)
- Auto-fill portfolio with LinkedIn PDF — one upload fills name, headline, location, email, and skills
- Get AI-written project descriptions grounded in your actual code
- Download a formatted PDF resume at any time
- Share a public portfolio URL with recruiters

### For Recruiters & Hiring Managers

- Browse a clean portfolio that surfaces engineering depth, not just a list of repos
- Understand technology strengths without reading code
- Search developers by skill, technology stack, or domain
- Evaluate candidates at a glance — always-visible project overview, expandable full analysis

---

## Example Output

**Input:** A GitHub repository for a TypeScript + Express + OpenAI API service

**Output:**

> **Headline:** AI Application Developer · Full Stack Engineer
>
> **About Me:** An engineer with a strong foundation in backend architecture and AI integration, building production-ready API services that combine structured data pipelines with LLM-powered capabilities. Demonstrated expertise in TypeScript, Express, and OpenAI API consumption across multiple projects spanning enterprise tooling and developer productivity.
>
> **Engineering Strengths:** AI/ML integration using OpenAI · Production infrastructure defined as code · Enterprise-level backend development
>
> **Project Overview (always visible):**
> This platform delivers an AI-powered API service designed for enterprise workflow automation, combining a RESTful Express backend with OpenAI integration to process and respond to structured business inputs. The architecture follows a layered service pattern with Sequelize as the ORM layer over PostgreSQL, enabling clean separation between routing, business logic, and data access.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)              │
│  Header  Settings  PortfolioBuilder  PublicPortfolio     │
│  RecruiterSearch  AnalysisPanel                          │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────────┐
│                   Backend (Express 5)                    │
│  /api/auth         /api/repos        /api/analysis       │
│  /api/deep-analysis                  /api/portfolios     │
│  /api/github-accounts                /api/github-app     │
│  /api/search                         /api/users          │
└─────┬──────────────┬───────────────┬────────────────────┘
      │              │               │
┌─────▼─────┐  ┌─────▼──────┐  ┌────▼──────────────────┐
│ PostgreSQL │  │  OpenAI    │  │  GitHub API / App      │
│ (pg pool) │  │  GPT-4o    │  │  OAuth + App installs  │
└───────────┘  └────────────┘  └────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL 14+ |
| Migrations | node-pg-migrate |
| AI | OpenAI API (GPT-4o-mini) |
| Auth | GitHub OAuth (JWT sessions) |
| GitHub App | RS256 JWT, installation tokens |
| PDF Generation | Puppeteer |
| PDF Parsing | pdfjs-dist |
| File Uploads | Multer |

---

## Project Structure

```
Repo2Reputation/
├── backend/
│   ├── db/
│   │   ├── migrations/               # PostgreSQL migrations (node-pg-migrate)
│   │   ├── postgres.js               # DB connection pool
│   │   └── seed.js
│   ├── middleware/
│   │   └── authMiddleware.js         # JWT verification
│   ├── routes/
│   │   ├── auth.js                   # GitHub OAuth login
│   │   ├── users.js                  # User profile
│   │   ├── repos.js                  # GitHub repo import + delete
│   │   ├── githubAccounts.js         # Connected OAuth accounts
│   │   ├── githubApp.js              # GitHub App install flow + installations
│   │   ├── analysis.js               # Basic AI analysis
│   │   ├── deepAnalysis.js           # Deep analysis pipeline + cancel/restart
│   │   ├── portfolios.js             # Portfolio CRUD, narrative, PDF, LinkedIn extract
│   │   └── search.js                 # Recruiter search
│   ├── services/
│   │   ├── openai.js                 # GPT prompts: analysis, narrative, descriptions, LinkedIn
│   │   ├── githubApp.js              # GitHub App JWT auth + installation tokens
│   │   ├── deepAnalysisPipeline.js   # Multi-phase deep analysis orchestrator
│   │   ├── deepAnalysisQueue.js      # Background analysis queue
│   │   ├── analysisQueue.js          # Basic analysis queue
│   │   ├── codeIntelligence.js       # Code-level signal extraction
│   │   ├── inferenceEngine.js        # Pattern and capability inference
│   │   ├── intelligenceAgents.js     # Business value and portfolio signals
│   │   ├── githubEnricher.js         # GitHub API enrichment
│   │   ├── semanticChunking.js       # README / file chunking
│   │   ├── fileClassification.js     # Repo file type classification
│   │   ├── repoIntelligenceScorer.js # Confidence scoring
│   │   ├── phaseTracker.js           # Deep analysis phase progress
│   │   ├── repoLimits.js             # Per-user repo quotas
│   │   └── pdfGenerator.js           # Puppeteer PDF renderer
│   └── server.js
├── frontend/
│   └── src/
│       ├── App.jsx                   # Route handling (SPA)
│       ├── Header.jsx                # Authenticated app shell + Browse tab
│       ├── Settings.jsx              # Account management + GitHub App installs
│       ├── PortfolioBuilder.jsx      # Portfolio editor (LinkedIn, narrative, projects, media)
│       ├── PublicPortfolio.jsx       # Public recruiter-facing portfolio page
│       ├── RecruiterSearch.jsx       # Developer search interface
│       ├── AnalysisPanel.jsx         # Analysis status + results view
│       ├── ProfileCard.jsx
│       └── api.js                    # Authenticated fetch helper + BASE_URL
├── docs/
│   ├── images/
│   └── media/
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- OpenAI API key
- GitHub OAuth App (for login)
- GitHub App (for multi-account private repo access)

### 1. Clone the repo

```bash
git clone <repo-url>
cd Repo2Reputation_Colaberry_Project
```

### 2. Create a GitHub OAuth App

1. Go to `github.com/settings/developers` → **New OAuth App**
2. Set **Authorization callback URL** to `http://localhost:5000/api/auth/github/callback`
3. Copy the **Client ID** and **Client Secret**

### 3. Create a GitHub App (for multi-account access)

1. Go to `github.com/settings/apps` → **New GitHub App**
2. Set **Setup URL** to `http://localhost:5000/api/github-app/installed`
3. Check **"Redirect on update"**
4. Under Permissions → Repository → **Contents: Read-only**
5. Generate and download a **private key** (.pem file)
6. Copy the **App ID** and **App slug**

### 4. Backend setup

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:

```env
# Database
DATABASE_URL=postgres://user:password@localhost:5432/repo2reputation

# Server
PORT=5000

# Auth
JWT_SECRET=your_jwt_secret

# GitHub OAuth (for login)
GITHUB_CLIENT_ID=your_oauth_client_id
GITHUB_CLIENT_SECRET=your_oauth_client_secret

# GitHub App (for multi-account private repo access)
GITHUB_APP_ID=your_app_id
GITHUB_APP_SLUG=your-app-slug
GITHUB_APP_PRIVATE_KEY_BASE64=<base64-encoded contents of the .pem file>

# OpenAI
OPENAI_API_KEY=sk-...

# URLs (used for OAuth redirects and CORS)
FRONTEND_URL=http://localhost:5173
```

To base64-encode the private key:

```bash
# macOS / Linux
base64 -w 0 your-app.private-key.pem

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("your-app.private-key.pem"))
```

Run database migrations:

```bash
npm run migrate:up
```

Start the backend:

```bash
npm start
# Runs on http://localhost:5000
```

### 5. Frontend setup

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

---

## Key API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/github` | Initiate GitHub OAuth login |
| `GET` | `/api/auth/github/callback` | OAuth callback — returns JWT |

### Repositories
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/repos` | List all repos (primary + connected + App) |
| `GET` | `/api/repos/imported` | List imported repositories |
| `POST` | `/api/repos/import` | Import repos from GitHub |
| `DELETE` | `/api/repos/:id` | Delete imported repo + all analysis data |

### GitHub Accounts
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/github-accounts` | List connected OAuth accounts |
| `DELETE` | `/api/github-accounts/:id` | Disconnect an OAuth account |

### GitHub App (Multi-Account)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/github-app/install` | Redirect to GitHub App installer |
| `GET` | `/api/github-app/installed` | Callback after App installation |
| `GET` | `/api/github-app/installations` | List user's App installations |
| `DELETE` | `/api/github-app/installations/:id` | Remove an installation |

### Analysis
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/analysis/repo/:id` | Run basic AI analysis |
| `POST` | `/api/deep-analysis/run` | Queue deep analysis for a repo |
| `GET` | `/api/deep-analysis/:id/latest` | Poll deep analysis status |
| `POST` | `/api/deep-analysis/cancel-pending` | Stop all pending analyses |

### Portfolios
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/portfolios` | Create portfolio from repos |
| `GET` | `/api/portfolios/:id` | Load saved portfolio |
| `POST` | `/api/portfolios/:id/generate-narrative` | AI-generate portfolio narrative |
| `POST` | `/api/portfolios/:id/generate-project-descriptions` | AI-generate per-project overviews |
| `POST` | `/api/portfolios/extract-linkedin` | Extract LinkedIn PDF (no portfolio ID needed) |
| `POST` | `/api/portfolios/:id/linkedin-pdf` | Extract + save LinkedIn PDF to portfolio |
| `PATCH` | `/api/portfolios/:id/save` | Save edits |
| `PATCH` | `/api/portfolios/:id/publish` | Publish portfolio publicly |
| `GET` | `/api/portfolios/public/:slug` | Public portfolio data (no auth) |
| `GET` | `/api/portfolios/public/:slug/pdf` | Download PDF resume (no auth) |

### Search
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/search` | Recruiter developer search |

---

## Public URLs

| Page | URL |
|---|---|
| Developer portfolio | `http://localhost:5173/portfolio/<slug>` |
| Recruiter search | `http://localhost:5173/search` |
| Settings | `http://localhost:5173/settings` |

---

## Database Migrations

```bash
# Apply all pending migrations
npm run migrate:up

# Roll back the last migration
npm run migrate:down

# Create a new migration file
npm run migrate:create <migration-name>
```

Key tables:
- `users` — user accounts (GitHub OAuth)
- `github_connected_accounts` — additional OAuth-connected accounts
- `github_app_installations` — GitHub App installations per user
- `repositories` — imported repos
- `analyses` — basic AI analysis results
- `deep_analyses` — deep analysis pipeline results
- `portfolios` — portfolio content, narrative, and publish state

---

## License

MIT
