directives/01_system_directives.md

# Purpose

Define the authoritative behavioral rules, operational directives, orchestration constraints, interaction policies, and system-wide execution rules for Repo2Reputation.

This document acts as the primary behavioral source of truth across:

* Frontend applications
* Backend APIs
* Async workers
* AI pipelines
* Portfolio publishing
* Multi-tenant enforcement
* Security enforcement
* Operational workflows

This file intentionally consolidates fragmented directives previously spread across architecture, AI, security, operational, and requirements documents.

---

# Scope

Applies to:

* Student workflows
* Recruiter workflows
* Institutional workflows
* Platform administration
* AI generation pipelines
* Repository ingestion systems
* Runtime orchestration
* Data handling behavior
* Deployment behavior

---

# Directive Classification

Each directive uses one of the following levels:

| Level    | Meaning                    |
| -------- | -------------------------- |
| MUST     | Non-negotiable requirement |
| SHOULD   | Strong recommendation      |
| MAY      | Optional behavior          |
| MUST NOT | Prohibited behavior        |

---

# 1. Core Platform Directives

## 1.1 System Architecture Directive

### MUST

The platform SHALL use:

* Modular monolith backend architecture
* Separate async worker execution layer
* Docker-based containerized deployment
* Hetzner-hosted infrastructure for initial production deployment

### MUST

The following workloads SHALL execute asynchronously:

* Repository imports
* GitHub synchronization
* AI analysis
* Narrative generation
* PDF export
* Bulk onboarding
* Analytics aggregation
* Search indexing

### MUST NOT

Long-running jobs SHALL NOT execute on request-response API threads.

---

## 1.2 Service Boundary Directive

### MUST

Each domain module SHALL own:

* its database access logic
* validation logic
* business rules
* tests
* service interfaces

### MUST NOT

Modules SHALL NOT directly manipulate another module’s persistence layer.

### MUST

Cross-module communication SHALL occur through:

* internal service interfaces
* domain events
* orchestrated workflows

---

## 1.3 Stateless API Directive

### MUST

API services SHALL remain stateless.

### MUST

User session state SHALL be stored in:

* JWT access tokens
* refresh token persistence
* Redis session acceleration layer (optional MVP)

### MUST NOT

Session state SHALL NOT exist in server memory.

---

# 2. Authentication & Identity Directives

## 2.1 Authentication Methods

### MUST

The platform SHALL support:

* email/password authentication
* GitHub OAuth authentication
* JWT access tokens
* refresh token rotation

### MUST

Passwords SHALL use:

* bcrypt OR
* Argon2

### MUST NOT

Plaintext passwords SHALL NEVER be stored or logged.

---

## 2.2 Session Security

### MUST

Sessions SHALL be revoked when:

* password changes
* logout occurs
* account suspension occurs
* credential compromise suspected

### SHOULD

Users SHOULD be able to view active sessions/devices.

---

## 2.3 Role Enforcement

### MUST

All protected routes SHALL enforce RBAC validation.

### Supported Roles

* student
* recruiter
* admin
* institutional_admin

### MUST NOT

Unauthorized access SHALL NEVER silently succeed.

### MUST

Unauthorized requests SHALL return:

* HTTP 401 for unauthenticated requests
* HTTP 403 for forbidden requests

---

# 3. Multi-Tenant Directives

## 3.1 Tenant Isolation

### MUST

Tenant-scoped records SHALL include:

```text
tenant_id
```

### MUST

Tenant scope enforcement SHALL occur:

* at middleware layer
* at service layer
* at query layer

### MUST NOT

Cross-tenant joins SHALL occur unless explicitly authorized.

---

## 3.2 Shared Database Strategy

### MUST

Initial deployment SHALL use:

```text
Shared PostgreSQL database
with logical tenant isolation
```

### MUST

Isolation enforcement SHALL be testable automatically.

---

# 4. Repository Ingestion Directives

## 4.1 Repository Support

### MUST

The platform SHALL support:

* public repositories
* private repositories

### MUST

Private repository access SHALL require explicit OAuth consent.

---

## 4.2 Metadata-First Ingestion

### MUST

The ingestion pipeline SHALL prioritize:

* README content
* dependency manifests
* repository metadata
* file structure metadata
* topics/tags
* commit summaries
* deployment configs
* CI/CD configs

### MUST NOT

Full repository source code SHALL be stored by default.

### MAY

Small targeted snippets MAY be temporarily processed for analysis.

---

## 4.3 Secret Detection

### MUST

The ingestion pipeline SHALL attempt to detect:

* API keys
* tokens
* credentials
* secrets

### MUST

Potential secrets SHALL be excluded from:

* prompts
* logs
* analytics
* generated content

---

## 4.4 Import Reliability

### MUST

Transient GitHub failures SHALL retry automatically.

### Retry Policy

| Attempt | Delay       |
| ------- | ----------- |
| 1       | immediate   |
| 2       | exponential |
| 3       | exponential |

### MUST

Import jobs SHALL be idempotent.

### MUST NOT

Duplicate imports SHALL create duplicate repository records.

---

# 5. AI System Directives

## 5.1 Evidence Grounding

### MUST

All meaningful AI-generated claims SHALL be evidence-backed.

### Evidence Sources

* README
* dependency manifests
* repository metadata
* file structures
* commit summaries
* detected technologies

### MUST NOT

AI SHALL fabricate:

* employment history
* measurable achievements
* protected characteristics
* unsupported skills

---

## 5.2 Confidence Scoring

### MUST

AI outputs SHALL include confidence scoring.

### Thresholds

| Score     | Meaning           |
| --------- | ----------------- |
| >= 0.85   | High confidence   |
| 0.70–0.84 | Medium confidence |
| < 0.70    | Needs Review      |

### MUST

Low-confidence outputs SHALL display:

```text
Needs Review
```

---

## 5.3 Multi-Model Routing

### MUST

The AI layer SHALL use cost-aware routing.

| Task                 | Model Tier          |
| -------------------- | ------------------- |
| Classification       | Low-cost            |
| Skill extraction     | Lightweight         |
| Narrative generation | Premium             |
| Validation           | Deterministic/cheap |

---

## 5.4 Prompt Governance

### MUST

All prompts SHALL be version controlled.

### MUST

Prompt changes SHALL be traceable.

### MUST

Poor-performing prompts SHALL support rollback.

---

## 5.5 Human Approval Directive

### MUST

Users SHALL approve generated content before publication.

### MUST NOT

The platform SHALL NEVER auto-publish AI output.

---

# 6. Portfolio Directives

## 6.1 Editing Rights

### MUST

Students SHALL be able to:

* edit AI-generated content
* reorder sections
* regenerate content
* unpublish portfolios

---

## 6.2 Visibility Control

### Supported Visibility Modes

* private
* unlisted
* public

### MUST

Users SHALL control discoverability.

---

## 6.3 Public Portfolio Safety

### MUST NOT

Private repository source code SHALL appear publicly.

### MUST

Generated content SHALL pass validation before publishing.

---

# 7. Runtime Orchestration Directives

## 7.1 Queue-Based Execution

### MUST

The following events SHALL use queue orchestration:

* repo.import.requested
* repo.import.completed
* ai.analysis.requested
* ai.analysis.completed
* narrative.generate.requested
* portfolio.publish.requested
* email.send.requested

---

## 7.2 Worker Isolation

### MUST

Workers SHALL execute separately from frontend/API runtime containers.

### MUST

Worker scaling SHALL be independent from API scaling.

---

## 7.3 Idempotency

### MUST

All async consumers SHALL be idempotent.

### MUST

Duplicate event processing SHALL NOT corrupt state.

---

# 8. API Directives

## 8.1 API Standards

### MUST

All APIs SHALL:

* use HTTPS
* use JSON
* support request tracing
* validate schemas
* validate authorization

---

## 8.2 Versioning

### MUST

Public APIs SHALL be versioned.

### Initial Version

```text
/v1
```

---

## 8.3 Error Standards

### MUST

Errors SHALL return structured responses.

### Required Fields

* success
* error.code
* error.message

---

# 9. Security Directives

## 9.1 Infrastructure Security

### MUST

Production systems SHALL use:

* Docker containers
* isolated networking
* encrypted traffic
* environment-based secrets

### MUST NOT

Secrets SHALL exist in source control.

---

## 9.2 Admin Protection

### MUST

Admin accounts SHALL require MFA.

### MUST

Privileged actions SHALL generate audit logs.

---

## 9.3 Rate Limiting

### MUST

Rate limits SHALL exist for:

* authentication
* AI generation
* recruiter search
* admin APIs

---

# 10. Privacy Directives

## 10.1 Consent

### MUST

Users SHALL explicitly consent before:

* public publishing
* recruiter discoverability
* private repository analysis

---

## 10.2 Data Minimization

### MUST

Only necessary repository data SHALL persist.

### MUST NOT

Sensitive repository content SHALL persist unnecessarily.

---

## 10.3 Deletion Rights

### MUST

The platform SHALL support:

* account deletion
* portfolio removal
* data export
* consent withdrawal

---

# 11. Operational Directives

## 11.1 Observability

### MUST

All services SHALL emit:

* structured logs
* metrics
* traces
* request IDs

---

## 11.2 Incident Severity

| Severity | Meaning                |
| -------- | ---------------------- |
| Sev1     | Security breach/outage |
| Sev2     | Major degradation      |
| Sev3     | Partial feature issue  |
| Sev4     | Informational          |

---

## 11.3 Backup Rules

### MUST

Backups SHALL occur daily minimum.

### MUST

Restore validation SHALL occur quarterly.

---

# 12. UX & Interaction Directives

## 12.1 First Value Directive

### SHOULD

Students SHOULD reach first portfolio draft within:

```text
15 minutes median
```

---

## 12.2 Failure UX Directive

### MUST

Failures SHALL provide:

* actionable guidance
* retry paths
* non-technical messaging

### MUST NOT

Raw infrastructure errors SHALL be exposed to users.

---

## 12.3 Mobile Compatibility

### MUST

Core student workflows SHALL support mobile browsers.

---

# 13. Evolution Directives

## 13.1 Growth Strategy

### MUST

Architecture SHALL support future extraction into microservices.

### Extraction Triggers

* independent scaling needs
* team ownership splits
* deployment bottlenecks
* compliance isolation requirements

---

## 13.2 Backward Compatibility

### MUST

Breaking API changes SHALL require:

* versioning
* migration strategy
* deprecation notice

---

# 14. Definition of Done Directives

A feature SHALL be considered complete only when:

* requirements implemented
* validation tests pass
* authorization enforced
* logging exists
* errors handled
* observability added
* documentation updated
* security reviewed
* mobile UX validated
* rollback path exists

---

# 15. Global System Invariants

The following invariants SHALL always remain true:

1. No cross-tenant unauthorized access
2. No AI-generated fabricated achievements
3. No auto-publication of generated content
4. No plaintext secret storage
5. No blocking async workloads on API threads
6. No publication without user consent
7. No privileged action without audit logging
8. No unsupported recruiter-visible claims
9. No source-control secrets
10. No silent authorization failures
