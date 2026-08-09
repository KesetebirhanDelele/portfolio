MODE: BUILD
PROGRESS: Architecture corpus formally completed
PATH: Post-completion hardening → Implementation acceleration → Claude execution optimization
LOCKS: One file at a time

CURRENT STEP
Goal → Create the canonical Claude implementation execution playbook.
Why → The architecture is now complete, but Claude still needs one final operational playbook describing exactly how implementation generation should occur across the repository without causing architectural drift, hidden coupling, or unsafe generation behavior.
Expected Result → A deterministic AI-assisted implementation execution framework.

---

# File 36

`directives/03_claude_implementation_execution_playbook.md`

````md id="8v2m4q"
# Repo2Reputation — Claude Implementation Execution Playbook

# Purpose

Define the authoritative execution workflow,
generation constraints,
implementation discipline,
and operational behavior
for Claude-assisted development inside Repo2Reputation.

This document specifies:

- Claude execution workflow
- implementation sequencing
- architecture loading behavior
- generation boundaries
- runtime safety expectations
- governance preservation rules
- anti-drift generation controls
- incremental implementation discipline
- validation expectations
- contributor/Claude coordination rules

This file acts as the single source of truth for Claude-assisted implementation execution.

---

# Execution Philosophy

```text id="5m7x1q"
Claude is an implementation assistant,
not an architecture owner.
````

---

# Core Objectives

The Claude execution system exists to:

1. preserve architectural integrity
2. reduce generation drift
3. stabilize implementation quality
4. preserve runtime safety
5. preserve observability
6. improve contributor control
7. prevent uncontrolled generation

---

# 1. Canonical Claude Workflow

# Required Workflow

```text id="8x2m4v"
Load Manifest
→ Load Directives
→ Load Architecture
→ Load Runtime
→ Analyze Ownership
→ Analyze Dependencies
→ Generate Incrementally
→ Validate Alignment
→ Validate Observability
→ Validate Rollback Safety
```

---

# MUST

Claude SHALL:

* understand ownership before generating
* understand runtime boundaries before modifying
* understand async orchestration before implementing

---

# MUST NOT

Claude SHALL:

* invent architecture
* bypass directives
* redefine ownership
* bypass observability requirements

---

# 2. Mandatory Loading Order

# Phase 1 — Governance

| Priority | File                                                      |
| -------- | --------------------------------------------------------- |
| 1        | docs/00_architecture_manifest.md                          |
| 2        | directives/01_system_directives.md                        |
| 3        | directives/02_ai_generation_governance.md                 |
| 4        | directives/03_claude_implementation_execution_playbook.md |

---

# Phase 2 — Core Architecture

| Priority | File                                    |
| -------- | --------------------------------------- |
| 5        | architecture/02_domain_model.md         |
| 6        | architecture/03_service_boundary_map.md |
| 7        | runtime/01_runtime_orchestration.md     |

---

# Phase 3 — Subsystem Docs

Load only subsystem-specific documents relevant to implementation.

---

# MUST NOT

Claude SHALL:

* load unrelated architecture unnecessarily
* modify unrelated modules
* redefine subsystem ownership

---

# 3. Implementation Scope Governance

# MUST

Every Claude implementation SHALL:

* define scope boundaries
* define affected modules
* define runtime impact
* define rollback considerations

---

# MUST NOT

Claude SHALL:

* perform giant uncontrolled rewrites
* modify unrelated systems
* introduce hidden coupling

---

# Scope Definition Template

```text id="7q1m5r"
Objective
Affected Modules
Runtime Impact
Migration Impact
Observability Impact
Rollback Strategy
```

---

# 4. Incremental Generation Rules

# MUST

Claude SHALL:

* implement incrementally
* validate after each step
* preserve runtime stability

---

# MUST NOT

Claude SHALL:

* generate entire platforms at once
* bypass testing phases
* collapse modular boundaries

---

# Required Generation Strategy

```text id="4v8m2x"
One subsystem
→ One implementation step
→ One validation cycle
```

---

# 5. Runtime Safety Governance

# MUST

Runtime-impacting changes SHALL validate:

* queue behavior
* retries
* replay safety
* worker isolation
* telemetry

---

# MUST NOT

Claude SHALL:

* introduce synchronous AI blocking
* bypass queues
* weaken observability

---

# Runtime Validation Workflow

```text id="9m1x4q"
Modify Runtime
→ Validate Queue Behavior
→ Validate Metrics
→ Validate Recovery
→ Validate Rollback
```

---

# 6. Observability Preservation Rules

# MUST

All generated runtime systems SHALL emit:

* logs
* metrics
* trace identifiers

---

# MUST NOT

Claude SHALL:

* create opaque runtime flows
* suppress errors silently
* omit telemetry

---

# Required Observability Targets

| Target           | Required |
| ---------------- | -------- |
| API logs         | yes      |
| queue metrics    | yes      |
| worker telemetry | yes      |
| request tracing  | yes      |

---

# 7. API Generation Governance

# MUST

Generated APIs SHALL:

* validate schemas
* validate auth
* preserve tenant isolation
* remain version-aware

---

# MUST NOT

Claude SHALL:

* expose stack traces
* bypass RBAC
* trust frontend authorization

---

# API Validation Workflow

```text id="2x7m4v"
Define Contract
→ Validate Auth
→ Validate Tenant Boundaries
→ Validate Observability
→ Validate Rollback Compatibility
```

---

# 8. AI Implementation Governance

# MUST

AI-related generation SHALL preserve:

* explainability
* confidence scoring
* moderation
* evidence mapping

---

# MUST NOT

Claude SHALL:

* auto-publish AI outputs
* fabricate unsupported claims
* bypass moderation safeguards

---

# AI Generation Checklist

| Requirement        | Required |
| ------------------ | -------- |
| confidence scoring | yes      |
| evidence mapping   | yes      |
| moderation         | yes      |
| explainability     | yes      |

---

# 9. Frontend Generation Governance

# MUST

Frontend generation SHALL preserve:

* accessibility
* async UX states
* visibility controls
* runtime-safe error handling

---

# MUST NOT

Claude SHALL:

* tightly couple frontend to backend internals
* expose secrets
* bypass auth flows

---

# Frontend Validation Targets

| Validation     | Required |
| -------------- | -------- |
| loading states | yes      |
| auth handling  | yes      |
| error handling | yes      |
| accessibility  | yes      |

---

# 10. Database & Migration Governance

# MUST

Generated migrations SHALL:

* remain sequential
* remain reviewable
* support rollback when possible

---

# MUST NOT

Claude SHALL:

* generate destructive migrations blindly
* bypass migration ordering
* mutate schemas manually

---

# Migration Workflow

```text id="5r1m8q"
Schema Change
→ Migration Creation
→ Rollback Analysis
→ Validation
→ Runtime Verification
```

---

# 11. Queue & Worker Governance

# MUST

Workers SHALL:

* remain isolated
* remain observable
* remain replay-safe

---

# MUST NOT

Claude SHALL:

* couple workers to APIs
* bypass dead-letter handling
* create hidden orchestration

---

# Worker Validation Checklist

| Validation          | Required |
| ------------------- | -------- |
| queue metrics       | yes      |
| retries             | yes      |
| dead-letter support | yes      |
| replay safety       | yes      |

---

# 12. Security Preservation Rules

# MUST

Generated code SHALL preserve:

* RBAC
* tenant isolation
* auditability
* least privilege

---

# MUST NOT

Claude SHALL:

* hardcode secrets
* bypass auth validation
* weaken visibility enforcement

---

# 13. Testing Governance

# MUST

Generated functionality SHALL include:

* unit tests
* integration validation
* runtime validation
* auth validation

---

# MUST NOT

Claude SHALL:

* skip testing guidance
* bypass runtime validation
* weaken observability

---

# 14. Documentation Governance

# MUST

Architectural changes SHALL update:

* manifest
* ownership docs
* runtime docs
* operational docs

---

# MUST NOT

Claude SHALL:

* introduce undocumented ownership
* bypass manifest updates
* create hidden dependencies

---

# 15. Contributor Coordination Rules

# MUST

Claude SHALL assume:

* human review required
* contributor retains ownership
* implementation remains reviewable

---

# MUST NOT

Claude SHALL:

* act autonomously
* perform silent rewrites
* bypass approval workflows

---

# 16. Anti-Drift Generation Rules

# MUST

Generated code SHALL preserve:

* modularity
* ownership boundaries
* runtime boundaries
* observability

---

# MUST NOT

Claude SHALL:

* duplicate architecture
* redefine subsystem ownership
* introduce hidden runtime behavior

---

# 17. Recovery & Rollback Awareness

# MUST

Claude SHALL preserve:

* rollback capability
* recovery traceability
* queue replay safety

---

# MUST NOT

Generated systems SHALL:

* become unrecoverable
* corrupt queue integrity
* suppress incident visibility

---

# 18. Recommended Claude Execution Pattern

# Standard Execution Flow

```text id="6m2x5v"
Read Architecture
→ Define Scope
→ Implement Small Change
→ Validate Runtime
→ Validate Observability
→ Validate Rollback
→ Continue Incrementally
```

---

# 19. Claude Execution Invariants

The following SHALL always remain true:

1. No implementation before ownership analysis
2. No runtime changes without telemetry
3. No AI generation without moderation
4. No migrations without rollback analysis
5. No hidden dependencies
6. No governance bypass
7. No unsupported recruiter-visible claims
8. No unobservable runtime systems

---

# 20. Definition of Claude Execution Readiness

Claude-assisted implementation is considered governance-ready only when:

* manifest loaded
* directives loaded
* ownership understood
* runtime boundaries understood
* observability preserved
* rollback capability preserved
* AI safeguards preserved
* testing expectations preserved
* contributor oversight preserved
* architecture drift prevented

```
```
