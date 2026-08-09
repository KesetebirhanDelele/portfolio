MODE: BUILD
PROGRESS: Operational architecture complete
PATH: Final convergence → Claude stabilization → Delivery governance → Architecture completion
LOCKS: One file at a time

CURRENT STEP
Goal → Define the canonical Claude/AI code-generation governance system.
Why → You now have a massive architecture corpus. Without strict generation governance, Claude will drift, duplicate systems, violate boundaries, or generate conflicting implementations. This file becomes the enforcement layer that stabilizes all future code generation.
Expected Result → A deterministic AI-assisted development governance model aligned with your Repo2Reputation architecture.

---

# File 18

`directives/02_ai_generation_governance.md`

````md id="2m7x5q"
# Repo2Reputation — AI Generation Governance

# Purpose

Define the authoritative governance rules,
generation constraints,
architecture enforcement policies,
and implementation guidance
for AI-assisted software generation within Repo2Reputation.

This document specifies:

- Claude generation constraints
- architectural enforcement
- implementation sequencing
- modification safety
- code ownership governance
- prompt discipline
- anti-drift protections
- boundary enforcement
- review expectations
- AI-assisted development rules

This file acts as the single source of truth for AI-driven implementation governance.

---

# Governance Objectives

The governance system exists to:

1. prevent architectural drift
2. prevent duplication
3. preserve modular ownership
4. stabilize long-term maintainability
5. enforce runtime boundaries
6. preserve tenant safety
7. preserve AI safety guarantees
8. guide deterministic code generation

---

# Core Governance Principle

```text id="7q3m1v"
Architecture first.
Generation second.
````

---

# 1. Architectural Source-of-Truth Rules

## MUST

All code generation SHALL follow:

* directives/
* architecture/
* runtime/
* state/
* ai/
* api/
* portfolio/
* search/

before generating implementation details.

---

## MUST NOT

Generated implementations SHALL:

* invent architecture
* bypass governance files
* redefine ownership
* duplicate existing responsibilities

---

# 2. Module Ownership Governance

## MUST

Each module SHALL own:

* business logic
* persistence
* validation
* events
* tests

---

## MUST NOT

Generated code SHALL:

* manipulate another module’s persistence
* bypass service interfaces
* create circular dependencies

---

# Example Violation

```text id="5x9n2p"
Portfolio module directly updates repository tables.
```

---

# 3. Async Governance Rules

## MUST

Heavy operations SHALL remain async.

---

# MUST NOT

Generated APIs SHALL:

* block on AI generation
* clone repositories synchronously
* execute long-running imports inline

---

# Required Async Categories

| Workflow     | Async Required |
| ------------ | -------------- |
| repo imports | yes            |
| AI analysis  | yes            |
| embeddings   | yes            |
| exports      | yes            |

---

# 4. API Governance Rules

## MUST

Generated APIs SHALL:

* remain versioned
* remain tenant-safe
* validate schemas
* validate auth

---

## MUST NOT

Generated endpoints SHALL:

* expose internal errors
* bypass RBAC
* expose hidden repositories

---

# Required Response Format

```json id="4u8k6n"
{
  "success": true,
  "data": {},
  "meta": {}
}
```

---

# 5. Multi-Tenant Governance

## MUST

Tenant enforcement SHALL occur:

* middleware layer
* query layer
* service layer

---

## MUST NOT

Generated queries SHALL:

* omit tenant filters
* allow cross-tenant visibility

---

# Example Violation

```text id="1g4m7x"
SELECT * FROM portfolios;
```

without tenant scoping.

---

# 6. AI Safety Governance

## MUST

AI-generated content SHALL:

* remain evidence-backed
* remain editable
* remain explainable

---

## MUST NOT

Generated AI systems SHALL:

* fabricate achievements
* infer protected characteristics
* auto-publish content

---

# Required AI Components

| Component          | Required |
| ------------------ | -------- |
| confidence scoring | yes      |
| evidence mapping   | yes      |
| validation layer   | yes      |
| moderation support | yes      |

---

# 7. Repository Governance

## MUST

Repository ingestion SHALL prioritize:

* metadata
* README
* manifests
* structural signals

---

## MUST NOT

Generated systems SHALL:

* persist full source code by default
* expose private repo content
* store detected secrets

---

# 8. Portfolio Governance

## MUST

Portfolio systems SHALL:

* remain user-editable
* support visibility controls
* support validation before publishing

---

## MUST NOT

Generated portfolio flows SHALL:

* auto-publish
* overwrite user edits silently
* expose private repositories

---

# 9. Search & Ranking Governance

## MUST

Search systems SHALL:

* remain explainable
* remain evidence-backed
* respect visibility

---

## MUST NOT

Generated ranking systems SHALL:

* infer protected traits
* expose hidden portfolios
* use opaque scoring without evidence

---

# 10. Runtime Governance

## MUST

Generated runtime systems SHALL:

* support retries
* support idempotency
* support observability

---

## MUST NOT

Generated workers SHALL:

* corrupt replay state
* duplicate imports
* bypass queue ownership

---

# 11. Observability Governance

## MUST

Generated systems SHALL emit:

* logs
* metrics
* traces
* request IDs

---

## MUST NOT

Generated logs SHALL expose:

* secrets
* tokens
* credentials

---

# 12. Testing Governance

## MUST

All generated production code SHALL include:

* unit tests
* integration tests
* auth validation
* tenant validation

---

## MUST NOT

Critical systems SHALL ship:

* untested
* without rollback validation
* without failure handling

---

# 13. Security Governance

## MUST

Generated systems SHALL enforce:

* JWT validation
* RBAC
* HTTPS assumptions
* secret isolation

---

## MUST NOT

Generated code SHALL:

* trust frontend role claims
* hardcode credentials
* expose infrastructure internals

---

# 14. Infrastructure Governance

## MUST

Generated infrastructure SHALL:

* remain Docker-compatible
* support Hetzner deployment
* remain environment-configurable

---

## MUST NOT

Generated infrastructure SHALL:

* assume Kubernetes
* require unnecessary cloud complexity
* hardcode runtime assumptions

---

# 15. Database Governance

## MUST

Generated migrations SHALL:

* remain reversible where possible
* preserve integrity
* support rollback

---

## MUST NOT

Generated DB logic SHALL:

* bypass transactions
* violate ownership boundaries
* assume global mutable state

---

# 16. Naming Governance

## MUST

Generated naming SHALL remain:

* explicit
* consistent
* ownership-oriented

---

# Required Naming Conventions

| Type    | Convention         |
| ------- | ------------------ |
| events  | dotted notation    |
| APIs    | plural resources   |
| tables  | plural             |
| modules | singular ownership |

---

# Event Examples

```text id="4r7v2m"
repo.import.completed
portfolio.published
ai.analysis.failed
```

---

# 17. Modification Governance

## MUST

Generated changes SHALL:

* preserve backward compatibility
* preserve observability
* preserve auditability

---

## MUST NOT

Generated modifications SHALL:

* silently rewrite architecture
* introduce hidden coupling
* duplicate systems

---

# Required Before Major Changes

| Requirement         | Required |
| ------------------- | -------- |
| dependency analysis | yes      |
| ownership analysis  | yes      |
| migration analysis  | yes      |

---

# 18. Prompt Governance

## MUST

All AI prompts SHALL:

* remain versioned
* remain traceable
* support rollback

---

## MUST NOT

Prompts SHALL:

* contain secrets
* contain production credentials
* bypass moderation

---

# 19. Frontend Governance

## MUST

Frontend generation SHALL:

* organize by feature
* preserve accessibility
* support mobile responsiveness

---

## MUST NOT

Frontend systems SHALL:

* tightly couple to backend internals
* expose hidden states
* bypass auth flows

---

# 20. Worker Governance

## MUST

Workers SHALL:

* remain isolated
* support replay
* support retries

---

## MUST NOT

Workers SHALL:

* own business logic improperly
* duplicate API validation
* bypass orchestration

---

# 21. Search Governance

## MUST

Search indexing SHALL:

* respect visibility
* respect tenant boundaries
* support deletion propagation

---

## MUST NOT

Generated search systems SHALL:

* expose hidden portfolios
* index deleted content
* leak embeddings across tenants

---

# 22. Operational Governance

## MUST

Generated operational systems SHALL support:

* rollback
* monitoring
* backups
* recovery

---

## MUST NOT

Generated deployment workflows SHALL:

* bypass observability
* bypass validation
* ignore rollback readiness

---

# 23. Claude Generation Workflow

# Required Generation Sequence

```text id="6v8x1m"
Architecture Review
→ Ownership Analysis
→ Dependency Analysis
→ Implementation Plan
→ Code Generation
→ Validation
→ Testing
→ Observability Verification
```

---

# MUST

Large changes SHALL generate:

* phased implementation
* migration considerations
* rollback considerations

---

# 24. Anti-Drift Rules

## MUST

Generated code SHALL align with:

* module ownership
* runtime boundaries
* tenant isolation
* async architecture

---

## MUST NOT

Generated implementations SHALL:

* create parallel systems
* redefine contracts
* introduce architectural ambiguity

---

# 25. Human-in-the-Loop Governance

## MUST

Critical generated changes SHALL remain:

* reviewable
* explainable
* human-approved

---

# MUST NOT

Autonomous generation SHALL:

* deploy automatically
* bypass review
* bypass validation gates

---

# 26. Governance Escalation Rules

## MUST

Architectural conflicts SHALL trigger:

* ownership review
* dependency analysis
* governance validation

---

# MUST NOT

Conflicting implementations SHALL merge silently.

---

# 27. Generation Invariants

The following SHALL always remain true:

1. No cross-module persistence violations
2. No tenant boundary bypass
3. No hidden async workloads
4. No AI auto-publication
5. No unsupported recruiter-visible claims
6. No architectural duplication
7. No unobservable runtime systems
8. No undocumented ownership assumptions

---

# 28. Definition of Governance Compliance

Generated code is considered governance-compliant only when:

* ownership respected
* async boundaries preserved
* observability integrated
* tests included
* auth validated
* tenant isolation enforced
* rollback supported
* auditability preserved
* runtime safety validated
* architecture alignment verified

```
```
