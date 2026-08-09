MODE: BUILD
PROGRESS: API governance complete
PATH: Service boundaries → Infrastructure convergence → Execution blueprint → Final architecture cleanup
LOCKS: One file at a time

CURRENT STEP
Goal → Define the canonical service boundary and modular architecture specification.
Why → You now have many subsystem documents. This file becomes the “assembly map” that tells Claude how modules interact, where ownership lives, and how future microservice extraction remains possible without duplication.
Expected Result → A deterministic modular monolith architecture with explicit service boundaries and extraction strategy.

---

# File 14

`architecture/03_service_boundary_map.md`

````md id="y8r5vc"
# Repo2Reputation — Service Boundary Map

# Purpose

Define the authoritative module boundaries, service ownership,
cross-domain communication rules, extraction strategy,
and internal architecture topology for Repo2Reputation.

This document specifies:

- module ownership
- service boundaries
- dependency rules
- internal communication
- extraction readiness
- async coordination
- domain encapsulation
- modular monolith structure
- future microservice migration paths

This file acts as the single source of truth for architectural boundaries.

---

# Architecture Principles

## MUST

The system SHALL use:
```text id="2z7r4a"
modular monolith architecture
````

for initial production deployment.

---

## MUST

Domains SHALL remain:

* isolated
* encapsulated
* independently testable
* extraction-ready

---

## MUST NOT

Modules SHALL:

* bypass ownership boundaries
* directly manipulate another module’s persistence
* create circular dependencies

---

# High-Level System Topology

```text id="2j0n1g"
Frontend
    ↓
API Layer
    ↓
Domain Modules
    ↓
Async Runtime Layer
    ↓
Persistence / AI / Search
```

---

# Architectural Layers

| Layer          | Responsibility      |
| -------------- | ------------------- |
| presentation   | API/frontend        |
| application    | orchestration       |
| domain         | business logic      |
| infrastructure | DB/external systems |
| async runtime  | workers/queues      |

---

# Core Domain Modules

| Module       | Responsibility         |
| ------------ | ---------------------- |
| identity     | auth/sessions          |
| tenant       | multi-tenant isolation |
| repository   | GitHub ingestion       |
| ai           | intelligence pipelines |
| portfolio    | publishing             |
| recruiter    | search/discovery       |
| organization | cohort management      |
| workflow     | async orchestration    |
| notification | messaging              |
| audit        | compliance             |
| analytics    | telemetry              |
| billing      | subscriptions          |
| search       | indexing/ranking       |

---

# 1. Identity Module

# Responsibilities

Handles:

* authentication
* authorization
* JWT lifecycle
* GitHub OAuth
* session management

---

# Owned Entities

| Entity  |
| ------- |
| User    |
| Session |

---

# Public Interfaces

| Interface        | Purpose        |
| ---------------- | -------------- |
| authenticateUser | login          |
| validateToken    | JWT validation |
| revokeSession    | security       |

---

# MUST NOT

Other modules SHALL NOT:

* validate JWTs independently
* manipulate session persistence directly

---

# 2. Tenant Module

# Responsibilities

Handles:

* tenant isolation
* memberships
* access scope

---

# Owned Entities

| Entity           |
| ---------------- |
| Tenant           |
| TenantMembership |

---

# MUST

Tenant enforcement SHALL occur:

* middleware layer
* service layer
* query layer

---

# MUST NOT

Modules SHALL bypass tenant filters.

---

# 3. Repository Module

# Responsibilities

Handles:

* GitHub integration
* imports
* metadata extraction
* sync lifecycle

---

# Owned Entities

| Entity               |
| -------------------- |
| Repository           |
| RepositoryImportJob  |
| RepositoryTopic      |
| RepositoryDependency |

---

# Public Interfaces

| Interface         | Purpose          |
| ----------------- | ---------------- |
| importRepository  | queue import     |
| syncRepository    | refresh metadata |
| fetchRepositories | GitHub browsing  |

---

# MUST NOT

The repository module SHALL:

* perform AI generation
* publish portfolios
* expose secrets

---

# 4. AI Module

# Responsibilities

Handles:

* classification
* embeddings
* scoring
* narrative generation
* validation

---

# Owned Entities

| Entity              |
| ------------------- |
| RepositoryAnalysis  |
| SkillInference      |
| NarrativeGeneration |

---

# Public Interfaces

| Interface          | Purpose       |
| ------------------ | ------------- |
| analyzeRepository  | inference     |
| generateNarratives | AI generation |
| validateOutput     | grounding     |

---

# MUST NOT

The AI module SHALL:

* publish portfolios
* bypass validation
* manipulate recruiter rankings directly

---

# 5. Portfolio Module

# Responsibilities

Handles:

* portfolio assembly
* publishing
* visibility
* exports

---

# Owned Entities

| Entity           |
| ---------------- |
| Portfolio        |
| PortfolioProject |
| PortfolioSection |

---

# Public Interfaces

| Interface        | Purpose        |
| ---------------- | -------------- |
| buildDraft       | generate draft |
| publishPortfolio | visibility     |
| exportPortfolio  | PDF/share      |

---

# MUST NOT

The portfolio module SHALL:

* bypass AI validation
* expose hidden repositories

---

# 6. Recruiter Module

# Responsibilities

Handles:

* recruiter workflows
* bookmarks
* recruiter access

---

# Owned Entities

| Entity            |
| ----------------- |
| RecruiterProfile  |
| CandidateBookmark |

---

# Public Interfaces

| Interface         | Purpose        |
| ----------------- | -------------- |
| searchCandidates  | discovery      |
| bookmarkCandidate | recruiter save |

---

# MUST NOT

Recruiter systems SHALL:

* access hidden portfolios
* expose unsupported claims

---

# 7. Organization Module

# Responsibilities

Handles:

* institutions
* cohorts
* onboarding workflows

---

# Owned Entities

| Entity       |
| ------------ |
| Organization |
| Cohort       |

---

# 8. Workflow Module

# Responsibilities

Handles:

* queues
* retries
* orchestration
* runtime coordination

---

# Owned Entities

| Entity      |
| ----------- |
| WorkflowJob |

---

# MUST

All async orchestration SHALL route through:

```text id="x8g7ta"
Workflow Module
```

---

# MUST NOT

Business modules SHALL directly orchestrate queues independently.

---

# 9. Notification Module

# Responsibilities

Handles:

* emails
* alerts
* outbound communication

---

# Owned Entities

| Entity       |
| ------------ |
| Notification |

---

# MUST NOT

Notification failures SHALL block:

* imports
* publishing
* AI workflows

---

# 10. Audit Module

# Responsibilities

Handles:

* audit logs
* compliance tracing
* privileged action history

---

# Owned Entities

| Entity   |
| -------- |
| AuditLog |

---

# MUST

Critical actions SHALL emit audit events.

---

# MUST NOT

Audit logs SHALL be mutable.

---

# 11. Analytics Module

# Responsibilities

Handles:

* product telemetry
* engagement analytics
* operational metrics

---

# MUST

Analytics SHALL remain:

* append-only
* privacy-aware
* tenant-safe

---

# 12. Billing Module

# Responsibilities

Handles:

* subscriptions
* entitlements
* payment lifecycle

---

# MUST NOT

Billing outages SHALL:

* break authentication
* hide portfolios

---

# 13. Search Module

# Responsibilities

Handles:

* embeddings
* semantic retrieval
* ranking
* indexing

---

# MUST

Search SHALL respect:

* visibility
* tenant boundaries
* moderation rules

---

# MUST NOT

Search SHALL expose:

* deleted portfolios
* hidden repositories

---

# Internal Communication Rules

# Allowed Communication

| Mechanism          | Allowed |
| ------------------ | ------- |
| service interfaces | yes     |
| domain events      | yes     |
| async workflows    | yes     |

---

# Forbidden Communication

| Pattern                         | Forbidden |
| ------------------------------- | --------- |
| direct DB access across modules | yes       |
| circular dependencies           | yes       |
| hidden side effects             | yes       |

---

# Event-Driven Coordination

# Core Events

| Event                 | Producer     |
| --------------------- | ------------ |
| repo.import.completed | repository   |
| ai.analysis.completed | ai           |
| portfolio.published   | portfolio    |
| notification.sent     | notification |

---

# MUST

Events SHALL remain:

* immutable
* versioned
* traceable

---

# Dependency Direction Rules

# MUST

Dependency flow SHALL move inward:

```text id="4s8u9e"
Presentation
→ Application
→ Domain
→ Infrastructure
```

---

# MUST NOT

Infrastructure SHALL own business rules.

---

# Async Runtime Boundaries

# MUST

Heavy operations SHALL execute through:

* workers
* queues
* workflow orchestration

---

# MUST NOT

API controllers SHALL:

* run AI generation
* clone repositories
* block on exports

---

# Module Extraction Strategy

# Purpose

Enable future migration toward microservices.

---

# Extraction Candidates

| Module       | Extraction Priority |
| ------------ | ------------------- |
| AI           | high                |
| Search       | high                |
| Workflow     | medium-high         |
| Billing      | medium              |
| Notification | medium              |

---

# Extraction Triggers

| Trigger               | Example           |
| --------------------- | ----------------- |
| scaling pressure      | AI throughput     |
| team ownership        | separate teams    |
| deployment bottleneck | worker isolation  |
| compliance            | billing isolation |

---

# Shared Infrastructure Rules

# Shared Services

| Service       | Shared |
| ------------- | ------ |
| PostgreSQL    | yes    |
| Redis         | yes    |
| observability | yes    |

---

# MUST

Ownership SHALL remain logical even when infrastructure shared.

---

# Testing Boundary Rules

# MUST

Modules SHALL support:

* isolated unit tests
* integration tests
* contract validation

---

# MUST NOT

Tests SHALL depend on:

* hidden shared state
* unrelated modules

---

# Security Boundary Rules

# MUST

Sensitive operations SHALL remain isolated:

* auth
* billing
* admin actions
* tenant enforcement

---

# MUST

Secrets SHALL remain infrastructure-scoped.

---

# Observability Boundary Rules

# MUST

All modules SHALL emit:

* logs
* metrics
* traces
* audit hooks where required

---

# Deployment Boundary Rules

# MUST

Modules SHALL remain deployable together initially.

---

# SHOULD

Future extraction SHOULD avoid:

* tight coupling
* shared transactional assumptions

---

# Architecture Invariants

The following SHALL always remain true:

1. No cross-module DB manipulation
2. No circular dependencies
3. No hidden async orchestration
4. No auth bypass outside identity module
5. No tenant bypass outside enforcement layers
6. No search indexing of hidden content
7. No AI publishing without validation
8. No module ownership ambiguity

---

# Definition of Boundary Readiness

A module boundary is considered production-ready only when:

* ownership defined
* interfaces defined
* events defined
* dependencies constrained
* async behavior defined
* observability enabled
* security boundaries enforced
* extraction path documented
* tests isolated
* failure handling defined

```
```
