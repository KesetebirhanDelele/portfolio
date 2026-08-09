MODE: BUILD
PROGRESS: Execution roadmap complete
PATH: Final governance convergence → Delivery operations → Repository standards → Claude generation stabilization
LOCKS: One file at a time

CURRENT STEP
Goal → Define the canonical repository structure and code organization standard.
Why → You now have the complete architectural blueprint, but Claude still needs deterministic physical folder structure guidance to prevent chaotic file placement, duplicated modules, mixed ownership, and inconsistent scaling patterns.
Expected Result → A production-ready repository organization standard aligned with modular monolith architecture and future extraction readiness.

---

# File 16

`architecture/04_repository_structure_standard.md`

````md id="4w7qpx"
# Repo2Reputation — Repository Structure Standard

# Purpose

Define the authoritative repository organization,
folder structure, module layout,
code ownership boundaries,
and physical architecture standards
for Repo2Reputation.

This document specifies:

- repository layout
- backend structure
- frontend structure
- worker structure
- shared conventions
- module organization
- infrastructure directories
- testing organization
- AI pipeline organization
- extraction readiness patterns

This file acts as the single source of truth for physical repository organization.

---

# Repository Organization Principles

## MUST

The repository SHALL remain:
- modular
- discoverable
- scalable
- extraction-ready
- ownership-oriented

---

## MUST NOT

The repository SHALL:
- mix unrelated responsibilities
- centralize all business logic
- create hidden coupling
- duplicate domain ownership

---

# High-Level Repository Layout

```text id="5v9m1c"
repo2reputation/
├── frontend/
├── backend/
├── workers/
├── shared/
├── infrastructure/
├── scripts/
├── tests/
├── docs/
└── directives/
````

---

# Top-Level Directory Responsibilities

| Directory      | Responsibility             |
| -------------- | -------------------------- |
| frontend       | React/Vite UI              |
| backend        | API + domain modules       |
| workers        | async execution            |
| shared         | shared contracts/utilities |
| infrastructure | deployment/runtime         |
| scripts        | operational tooling        |
| tests          | system-level testing       |
| docs           | architecture docs          |
| directives     | governance directives      |

---

# 1. Frontend Structure

# Purpose

Contains all user-facing UI systems.

---

# Frontend Layout

```text id="0v7y4u"
frontend/
├── src/
│   ├── app/
│   ├── features/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── hooks/
│   ├── state/
│   ├── utils/
│   ├── styles/
│   └── types/
├── public/
└── tests/
```

---

# Frontend Organization Rules

## MUST

Frontend features SHALL organize by:

* business capability
* user workflow
* domain ownership

---

# Example Feature Layout

```text id="8m2n7r"
features/
├── auth/
├── repositories/
├── portfolio/
├── recruiter/
└── admin/
```

---

# MUST NOT

Frontend organization SHALL:

* centralize all API logic globally
* mix unrelated features
* tightly couple pages to backend contracts

---

# 2. Backend Structure

# Purpose

Contains modular monolith API system.

---

# Backend Layout

```text id="7t5x2z"
backend/
├── src/
│   ├── modules/
│   ├── middleware/
│   ├── infrastructure/
│   ├── shared/
│   ├── runtime/
│   ├── config/
│   ├── app/
│   └── server/
├── db/
├── tests/
└── scripts/
```

---

# Backend Module Layout

```text id="2g4q8f"
modules/
├── identity/
├── tenant/
├── repository/
├── ai/
├── portfolio/
├── recruiter/
├── workflow/
├── notification/
├── analytics/
├── audit/
├── billing/
└── search/
```

---

# Internal Module Structure

```text id="6y1m3j"
module/
├── controllers/
├── services/
├── domain/
├── repositories/
├── schemas/
├── events/
├── workers/
├── tests/
└── utils/
```

---

# Module Ownership Rules

## MUST

Each module SHALL own:

* business logic
* validation
* persistence
* tests
* events

---

## MUST NOT

Modules SHALL:

* manipulate another module’s DB logic
* bypass service boundaries
* create circular dependencies

---

# 3. Worker Structure

# Purpose

Contains async runtime execution systems.

---

# Worker Layout

```text id="3r7q2v"
workers/
├── import-worker/
├── ai-worker/
├── notification-worker/
├── analytics-worker/
└── shared/
```

---

# Worker Rules

## MUST

Workers SHALL remain:

* isolated
* queue-owned
* independently scalable

---

## MUST NOT

Workers SHALL:

* contain frontend logic
* own business rules outside domains
* duplicate API validation

---

# 4. Shared Package Structure

# Purpose

Contains reusable cross-runtime contracts.

---

# Shared Layout

```text id="1x5v8q"
shared/
├── types/
├── contracts/
├── enums/
├── validation/
└── utilities/
```

---

# Shared Rules

## MUST

Shared packages SHALL contain only:

* reusable contracts
* generic utilities
* shared schemas

---

## MUST NOT

Shared packages SHALL contain:

* domain business logic
* persistence logic
* runtime side effects

---

# 5. Infrastructure Structure

# Purpose

Contains deployment/runtime definitions.

---

# Infrastructure Layout

```text id="8j0k5m"
infrastructure/
├── docker/
├── nginx/
├── monitoring/
├── deployment/
├── scripts/
└── environments/
```

---

# Infrastructure Rules

## MUST

Infrastructure configs SHALL remain:

* environment-scoped
* reproducible
* observable

---

## MUST NOT

Infrastructure configs SHALL:

* contain secrets
* duplicate runtime ownership

---

# 6. Database Structure

# Database Layout

```text id="2f4r7x"
backend/db/
├── migrations/
├── seeds/
├── fixtures/
└── schemas/
```

---

# Migration Rules

## MUST

Migrations SHALL remain:

* sequential
* reversible where possible
* audited

---

## MUST NOT

Destructive migrations SHALL deploy unvalidated.

---

# 7. Runtime Structure

# Purpose

Contains orchestration/runtime systems.

---

# Runtime Layout

```text id="3v2m9k"
runtime/
├── queues/
├── events/
├── orchestration/
├── retries/
└── telemetry/
```

---

# Runtime Rules

## MUST

Runtime systems SHALL:

* remain observable
* remain replay-safe
* remain idempotent

---

# 8. AI Structure

# Purpose

Contains AI-specific systems.

---

# AI Layout

```text id="6w1p3n"
modules/ai/
├── prompts/
├── pipelines/
├── evaluators/
├── embeddings/
├── scoring/
├── validation/
└── datasets/
```

---

# AI Rules

## MUST

AI systems SHALL support:

* versioned prompts
* evaluation datasets
* rollback
* observability

---

# MUST NOT

AI prompts SHALL:

* contain secrets
* bypass validation
* hardcode provider assumptions

---

# 9. Frontend State Structure

# Purpose

Manage predictable UI state.

---

# State Layout

```text id="7p3y5u"
state/
├── auth/
├── repositories/
├── portfolio/
├── recruiter/
└── ui/
```

---

# MUST

State SHALL organize by:

* feature ownership
* workflow boundaries

---

# MUST NOT

Global state SHALL become:

* unbounded
* domain-ambiguous
* tightly coupled

---

# 10. Testing Structure

# Global Test Layout

```text id="8n1k4x"
tests/
├── unit/
├── integration/
├── e2e/
├── resilience/
├── ai/
└── fixtures/
```

---

# MUST

Tests SHALL:

* remain deterministic
* remain isolated
* mirror architecture ownership

---

# MUST NOT

Test fixtures SHALL:

* expose secrets
* depend on production systems

---

# 11. API Contract Structure

# Purpose

Centralize API contracts safely.

---

# Contract Layout

```text id="4j7v9r"
shared/contracts/
├── auth/
├── repositories/
├── portfolios/
├── recruiter/
└── ai/
```

---

# MUST

Contracts SHALL remain:

* versioned
* typed
* backward-aware

---

# 12. Configuration Structure

# Config Layout

```text id="1g8m4u"
config/
├── environments/
├── runtime/
├── feature-flags/
└── validation/
```

---

# MUST

Configs SHALL:

* validate at startup
* remain environment-scoped
* avoid hardcoded secrets

---

# 13. Script Organization

# Script Layout

```text id="9v3t6q"
scripts/
├── setup/
├── migrations/
├── maintenance/
├── observability/
└── deployment/
```

---

# MUST

Scripts SHALL:

* remain idempotent
* remain documented
* remain environment-safe

---

# 14. Documentation Structure

# Docs Layout

```text id="2m6r1p"
docs/
├── architecture/
├── runtime/
├── ai/
├── operations/
├── onboarding/
└── api/
```

---

# MUST

Documentation SHALL:

* remain version-aware
* remain architecture-aligned
* avoid duplication

---

# 15. Future Extraction Readiness

# Extraction Candidates

| Module   | Extraction Likelihood |
| -------- | --------------------- |
| ai       | high                  |
| search   | high                  |
| workflow | medium-high           |
| billing  | medium                |

---

# MUST

Physical organization SHALL support:

* future extraction
* ownership isolation
* runtime isolation

---

# MUST NOT

Module layouts SHALL assume:

* permanent monolith deployment
* shared mutable ownership

---

# 16. Naming Conventions

# MUST

Naming SHALL remain:

* predictable
* explicit
* ownership-oriented

---

# Examples

| Type    | Convention      |
| ------- | --------------- |
| modules | kebab/singular  |
| APIs    | plural          |
| tables  | plural          |
| events  | dotted notation |

---

# Event Naming Examples

```text id="0q8w5r"
repo.import.completed
portfolio.published
ai.analysis.failed
```

---

# 17. Code Ownership Rules

# MUST

Each subsystem SHALL have:

* explicit ownership
* isolated tests
* observability hooks

---

# MUST NOT

Cross-cutting utilities SHALL:

* become dumping grounds
* absorb business rules

---

# 18. Repository Security Rules

# MUST

Sensitive data SHALL remain:

* environment-scoped
* excluded from Git
* excluded from logs

---

# MUST NOT

The repository SHALL contain:

* plaintext secrets
* production credentials
* hardcoded tokens

---

# 19. Repository Structure Invariants

The following SHALL always remain true:

1. No cross-module persistence ownership
2. No circular dependencies
3. No AI prompts outside governed directories
4. No worker/business logic duplication
5. No frontend/backend contract drift
6. No hidden infrastructure configs
7. No unowned runtime systems
8. No undocumented extraction assumptions

---

# 20. Definition of Repository Readiness

A repository structure is considered production-ready only when:

* ownership boundaries defined
* module layouts standardized
* runtime directories organized
* tests isolated
* observability integrated
* extraction readiness preserved
* security boundaries enforced
* contracts versioned
* configs validated
* documentation aligned

```
```
