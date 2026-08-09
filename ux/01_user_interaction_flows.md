MODE: BUILD
PROGRESS: AI subsystem architecture complete
PATH: UX flows → Search architecture → Portfolio assembly → Governance completion
LOCKS: One file at a time

CURRENT STEP
Goal → Define the canonical user interaction and workflow architecture.
Why → Your original `user_flows.md` likely mixed UX, implementation details, backend logic, and milestone sequencing. We now isolate user journeys into a deterministic interaction layer that Claude can use for frontend, backend, AI, and workflow generation consistently.
Expected Result → A complete interaction architecture covering student, recruiter, admin, and institutional workflows.

---

# File 10

`ux/01_user_interaction_flows.md`

````md id="a4s7pk"
# Repo2Reputation — User Interaction Flows

# Purpose

Define the authoritative interaction architecture and user workflow model
for Repo2Reputation.

This document specifies:

- user journeys
- workflow sequencing
- interaction boundaries
- frontend orchestration
- UX state transitions
- async user feedback behavior
- role-based experiences
- onboarding flows
- portfolio workflows
- recruiter discovery workflows

This file acts as the single source of truth for user interaction behavior.

---

# UX Principles

## MUST

The platform SHALL optimize for:
- rapid onboarding
- low friction
- explainability
- trust
- progressive disclosure
- async clarity

---

## MUST

Users SHALL understand:
- what the system is doing
- why AI generated content
- how confidence is determined
- what remains editable

---

## MUST NOT

The UX SHALL:
- auto-publish content
- hide AI uncertainty
- expose raw infrastructure failures
- overwhelm first-time users

---

# Primary User Types

| User Type | Purpose |
|---|---|
| student | build reputation portfolio |
| recruiter | discover talent |
| admin | platform governance |
| institutional_admin | cohort management |

---

# Core Product Journey

```text id="kwv9lr"
Signup
→ Connect GitHub
→ Browse Repositories
→ Import Repositories
→ AI Analysis
→ Portfolio Draft
→ User Editing
→ Publish Portfolio
→ Recruiter Discovery
````

---

# 1. Student Onboarding Flow

# Goal

Reach first meaningful portfolio draft quickly.

---

# Success Target

## SHOULD

Median user SHOULD reach:

```text id="5m8a9n"
first draft within 15 minutes
```

---

# Onboarding Steps

| Step | User Action              |
| ---- | ------------------------ |
| 1    | register/login           |
| 2    | connect GitHub           |
| 3    | browse repositories      |
| 4    | import repositories      |
| 5    | wait for AI analysis     |
| 6    | review generated content |
| 7    | edit portfolio           |
| 8    | publish                  |

---

# UX Rules

## MUST

The onboarding flow SHALL:

* explain AI generation
* explain imported repo usage
* explain privacy controls

---

## MUST NOT

The user SHALL be forced to:

* understand infrastructure
* configure AI settings
* understand queues/workers

---

# 2. Authentication Flow

# Supported Methods

| Method         | Supported |
| -------------- | --------- |
| email/password | yes       |
| GitHub OAuth   | yes       |

---

# Authentication Flow

```text id="tlp5ki"
Login Screen
→ Credentials/OAuth
→ JWT Issued
→ Session Created
→ Dashboard Redirect
```

---

# Failure UX Rules

## MUST

Authentication failures SHALL:

* remain human-readable
* avoid technical jargon
* provide retry guidance

---

# MUST NOT

Raw auth stack traces SHALL appear in UI.

---

# 3. GitHub Connection Flow

# Purpose

Authorize repository access.

---

# Flow

```text id="dyv3rb"
Connect GitHub
→ OAuth Redirect
→ User Authorization
→ Callback Validation
→ Token Persistence
→ Repository Fetch
```

---

# UX Rules

## MUST

Users SHALL understand:

* what access is requested
* whether private repos included
* how revocation works

---

# MUST

The UI SHALL indicate:

* OAuth connected state
* sync status
* permission issues

---

# 4. Repository Browsing Flow

# Purpose

Allow selective repository import.

---

# Flow

```text id="0f7f93"
Fetch GitHub Repositories
→ Paginated Repo List
→ Select Repositories
→ Queue Import
```

---

# Displayed Metadata

| Field        | Required |
| ------------ | -------- |
| name         | yes      |
| language     | yes      |
| stars        | yes      |
| updated date | yes      |
| visibility   | yes      |
| topics       | yes      |

---

# UX Rules

## MUST

Users SHALL choose repositories explicitly.

---

## MUST NOT

Repositories SHALL auto-import silently.

---

# 5. Repository Import Flow

# Flow

```text id="s2s1wy"
Import Requested
→ Job Queued
→ Processing State
→ Success/Failure Feedback
→ Dashboard Refresh
```

---

# Async UX Rules

## MUST

Async workflows SHALL display:

* loading state
* queued state
* progress indication
* retry messaging

---

# MUST NOT

Long-running imports SHALL freeze UI.

---

# Import Failure UX

| Failure        | UX Response      |
| -------------- | ---------------- |
| GitHub timeout | retry messaging  |
| auth revoked   | reconnect prompt |
| malformed repo | explanation      |

---

# 6. AI Analysis Flow

# Flow

```text id="u7pk1m"
Repository Imported
→ Signals Extracted
→ Skills Inferred
→ Narratives Generated
→ Confidence Validation
→ Draft Ready
```

---

# UX Rules

## MUST

AI-generated content SHALL display:

* editable state
* confidence visibility
* evidence-backed explanation

---

## MUST NOT

AI outputs SHALL appear:

* unquestionable
* final
* locked

---

# 7. Portfolio Editing Flow

# Purpose

Allow students to customize generated output.

---

# Editable Areas

| Area                 | Editable |
| -------------------- | -------- |
| summaries            | yes      |
| section ordering     | yes      |
| project descriptions | yes      |
| visibility           | yes      |

---

# UX Rules

## MUST

Users SHALL:

* override AI content
* regenerate content
* remove sections

---

# MUST NOT

The AI system SHALL permanently overwrite user edits automatically.

---

# 8. Portfolio Publishing Flow

# Flow

```text id="9s9h3r"
Draft
→ Validation
→ User Confirmation
→ Publish
→ Public Portfolio
```

---

# Validation Checks

| Check                | Required |
| -------------------- | -------- |
| visibility settings  | yes      |
| AI validation        | yes      |
| consent confirmation | yes      |
| private repo leakage | blocked  |

---

# UX Rules

## MUST

Publishing SHALL require explicit confirmation.

---

## MUST NOT

The system SHALL auto-publish portfolios.

---

# 9. Recruiter Discovery Flow

# Goal

Allow recruiters to discover technical talent efficiently.

---

# Flow

```text id="75kt7x"
Recruiter Login
→ Search
→ Semantic Matching
→ Portfolio Review
→ Bookmark Candidate
```

---

# Recruiter Search Inputs

| Input              | Supported |
| ------------------ | --------- |
| technologies       | yes       |
| skills             | yes       |
| semantic queries   | yes       |
| portfolio keywords | yes       |

---

# Recruiter UX Rules

## MUST

Search results SHALL:

* remain explainable
* show evidence-backed skills
* show confidence indicators

---

# MUST NOT

Recruiters SHALL see:

* private repositories
* unsupported claims
* protected attributes

---

# 10. Institutional Workflow

# Goal

Support cohort onboarding and administration.

---

# Flow

```text id="m2g7yf"
Institution Setup
→ Invite Students
→ Cohort Assignment
→ Progress Tracking
→ Portfolio Review
```

---

# Institutional Features

| Feature               | Required |
| --------------------- | -------- |
| cohort management     | yes      |
| onboarding visibility | yes      |
| progress analytics    | yes      |

---

# 11. Admin Workflow

# Purpose

Govern platform operations safely.

---

# Admin Actions

| Action           | Allowed |
| ---------------- | ------- |
| suspend accounts | yes     |
| review abuse     | yes     |
| manage tenants   | yes     |
| inspect queues   | yes     |

---

# Admin UX Rules

## MUST

Privileged actions SHALL:

* require confirmation
* generate audit logs
* remain traceable

---

# 12. Notification UX Flow

# Notification Types

| Type          | Example             |
| ------------- | ------------------- |
| success       | import complete     |
| warning       | low-confidence AI   |
| failure       | GitHub disconnected |
| informational | portfolio published |

---

# UX Rules

## MUST

Notifications SHALL:

* remain actionable
* remain concise
* avoid infrastructure jargon

---

# 13. Mobile UX Rules

## MUST

Core flows SHALL support:

* mobile login
* repo browsing
* portfolio viewing
* editing basics

---

# MUST NOT

Critical workflows SHALL depend on desktop-only behavior.

---

# 14. Accessibility Rules

## MUST

The platform SHALL support:

* keyboard navigation
* readable contrast
* semantic labeling
* screen-reader compatibility

---

# MUST

Critical workflows SHALL remain accessible.

---

# 15. Error UX Rules

## MUST

Errors SHALL provide:

* actionable next steps
* retry guidance
* human-readable messaging

---

# MUST NOT

Users SHALL see:

* raw stack traces
* SQL errors
* internal queue failures

---

# 16. Async State UX Model

# Async States

| State      | UX                |
| ---------- | ----------------- |
| queued     | waiting indicator |
| processing | progress state    |
| completed  | success feedback  |
| failed     | retry path        |

---

# MUST

Async operations SHALL remain resumable visually.

---

# 17. Privacy UX Rules

## MUST

Users SHALL control:

* visibility
* discoverability
* repository selection
* publication state

---

# MUST

Private repository handling SHALL remain clearly communicated.

---

# 18. AI Explainability UX

## MUST

AI-generated insights SHALL support:

* evidence visibility
* confidence visibility
* regeneration
* editing

---

# Example Explainability

```text id="rq0x67"
“Detected Docker usage from docker-compose.yml and Dockerfile”
```

---

# 19. UX State Invariants

The following SHALL always remain true:

1. No auto-published portfolios
2. No hidden AI generation
3. No private repo exposure publicly
4. No unexplained failures
5. No blocking async workflows
6. No unsupported recruiter-visible claims
7. No destructive actions without confirmation
8. No inaccessible critical workflows

---

# 20. Definition of UX Readiness

A workflow is considered production-ready only when:

* states defined
* loading behavior defined
* failure behavior defined
* accessibility validated
* mobile compatibility validated
* async behavior validated
* explainability included
* privacy controls included
* user confirmation paths included
* observability hooks included

```
```
