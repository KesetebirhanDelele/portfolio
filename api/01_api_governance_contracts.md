MODE: BUILD
PROGRESS: Portfolio architecture complete
PATH: API governance → Service boundaries → Final system convergence → Execution readiness
LOCKS: One file at a time

CURRENT STEP
Goal → Define the canonical API governance and contract architecture.
Why → Your system now has frontend apps, async workers, AI pipelines, recruiter workflows, portfolio systems, and multi-tenant orchestration. Without a centralized API governance file, endpoints, auth, schemas, and versioning drift over time.
Expected Result → A deterministic API architecture governing REST contracts, auth, versioning, pagination, async orchestration, errors, and tenant enforcement.

---

# File 13

`api/01_api_governance_contracts.md`

````md id="4f6s9x"
# Repo2Reputation — API Governance & Contracts

# Purpose

Define the authoritative API governance, contract,
schema, versioning, orchestration, authorization,
and integration standards for Repo2Reputation.

This document specifies:

- API standards
- endpoint conventions
- auth rules
- schema governance
- async orchestration patterns
- pagination
- filtering
- versioning
- tenant enforcement
- error contracts
- observability requirements

This file acts as the single source of truth for API behavior.

---

# API Principles

## MUST

All APIs SHALL:
- remain versioned
- remain authenticated appropriately
- remain observable
- remain deterministic
- remain schema-validated

---

## MUST NOT

APIs SHALL:
- expose internal stack traces
- leak tenant data
- expose secrets
- block on long-running AI jobs

---

# API Architecture

```text id="9u8xq3"
Frontend
    ↓
REST API Layer
    ↓
Domain Services
    ↓
Async Orchestration
    ↓
Persistence / AI / Search
````

---

# API Categories

| Category     | Purpose             |
| ------------ | ------------------- |
| auth         | identity/session    |
| repositories | GitHub ingestion    |
| AI           | analysis access     |
| portfolios   | portfolio workflows |
| recruiter    | discovery/search    |
| admin        | governance          |
| analytics    | metrics             |
| system       | health/runtime      |

---

# 1. API Versioning Strategy

# MUST

Public APIs SHALL use:

```text id="k8u2s4"
/api/v1
```

---

# MUST

Breaking changes SHALL require:

* new version
* migration plan
* deprecation timeline

---

# MUST NOT

Breaking schema changes SHALL silently deploy.

---

# Version Lifecycle

| State      | Meaning        |
| ---------- | -------------- |
| active     | supported      |
| deprecated | sunset pending |
| retired    | unsupported    |

---

# 2. Authentication & Authorization

# Supported Authentication

| Method           | Supported |
| ---------------- | --------- |
| JWT access token | yes       |
| refresh token    | yes       |
| GitHub OAuth     | yes       |

---

# MUST

Protected APIs SHALL validate:

* JWT validity
* tenant scope
* role permissions

---

# MUST NOT

Unauthorized access SHALL:

* succeed silently
* bypass tenant enforcement

---

# Standard Auth Responses

| Status | Meaning         |
| ------ | --------------- |
| 401    | unauthenticated |
| 403    | unauthorized    |

---

# 3. Multi-Tenant API Rules

# MUST

Tenant-scoped APIs SHALL:

* enforce tenant boundaries
* filter cross-tenant data
* validate memberships

---

# MUST NOT

Cross-tenant data SHALL appear in:

* responses
* pagination metadata
* search results

---

# Tenant Context Sources

| Source             | Allowed |
| ------------------ | ------- |
| JWT claims         | yes     |
| server-side lookup | yes     |

---

# 4. REST Resource Conventions

# Resource Naming

## MUST

Resources SHALL:

* use plural nouns
* remain predictable
* avoid verbs where possible

---

# Examples

| Resource     | Example       |
| ------------ | ------------- |
| repositories | /repositories |
| portfolios   | /portfolios   |
| recruiters   | /recruiters   |

---

# MUST

Nested resources SHALL remain shallow.

---

# Example

```text id="h2u3kc"
/portfolios/:id/projects
```

---

# 5. Standard Response Contracts

# Success Contract

```json id="7q2m3d"
{
  "success": true,
  "data": {},
  "meta": {}
}
```

---

# Error Contract

```json id="x7k5pa"
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Readable explanation"
  }
}
```

---

# MUST

Errors SHALL include:

* machine-readable code
* human-readable message
* traceability metadata

---

# MUST NOT

Responses SHALL expose:

* stack traces
* SQL errors
* secrets

---

# 6. Pagination Standards

# MUST

Collection endpoints SHALL support:

* pagination
* sorting
* filtering

---

# Standard Query Parameters

| Parameter | Purpose    |
| --------- | ---------- |
| page      | pagination |
| limit     | page size  |
| sort      | ordering   |
| search    | filtering  |

---

# Standard Pagination Response

```json id="3f6z0q"
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

---

# MUST

Pagination SHALL remain deterministic.

---

# 7. Filtering & Search Standards

# MUST

Search APIs SHALL support:

* keyword search
* semantic search
* filtering
* sorting

---

# Search Parameters

| Parameter    | Example        |
| ------------ | -------------- |
| q            | React engineer |
| technologies | Docker         |
| visibility   | public         |

---

# MUST NOT

Search SHALL expose:

* hidden portfolios
* private repositories
* deleted entities

---

# 8. Async API Orchestration

# Purpose

Prevent blocking request-response workflows.

---

# Async Workflow Pattern

```text id="6n7k4y"
Request
→ Job Created
→ Queue Dispatch
→ Immediate Response
→ Status Polling/WebSocket
```

---

# MUST

Long-running workflows SHALL return:

* job ID
* status endpoint
* retry-safe identifiers

---

# Example Async Response

```json id="3m1q8n"
{
  "success": true,
  "jobId": "uuid",
  "status": "queued"
}
```

---

# MUST NOT

The following SHALL block synchronously:

* AI generation
* repository imports
* exports
* embeddings

---

# 9. Repository API Standards

# Core Repository APIs

| Endpoint                   | Purpose        |
| -------------------------- | -------------- |
| GET /repositories          | browse repos   |
| POST /repositories/import  | import repos   |
| GET /repositories/imported | imported repos |

---

# MUST

Repository APIs SHALL:

* support pagination
* support retries
* remain idempotent

---

# MUST NOT

Duplicate imports SHALL create corruption.

---

# 10. Portfolio API Standards

# Portfolio APIs

| Endpoint                     | Purpose         |
| ---------------------------- | --------------- |
| GET /portfolios              | list portfolios |
| POST /portfolios             | create          |
| POST /portfolios/:id/publish | publish         |

---

# MUST

Portfolio APIs SHALL:

* validate visibility
* validate publication rules
* enforce ownership

---

# MUST NOT

Publishing SHALL bypass validation.

---

# 11. Recruiter Search APIs

# Recruiter APIs

| Endpoint        | Purpose           |
| --------------- | ----------------- |
| GET /search     | search portfolios |
| POST /bookmarks | save candidates   |

---

# MUST

Recruiter APIs SHALL:

* enforce visibility
* enforce tenant boundaries
* support explainability

---

# MUST NOT

Recruiter APIs SHALL expose:

* unsupported claims
* hidden/private content

---

# 12. AI API Standards

# AI APIs

| Endpoint          | Purpose    |
| ----------------- | ---------- |
| GET /analysis/:id | analysis   |
| POST /generation  | narratives |

---

# MUST

AI APIs SHALL:

* expose confidence
* expose evidence references
* support retries

---

# MUST NOT

AI APIs SHALL:

* imply certainty falsely
* expose raw prompts publicly

---

# 13. Validation Standards

# MUST

All APIs SHALL validate:

* schemas
* auth
* tenant scope
* enum values
* pagination bounds

---

# Validation Failure Example

```json id="5v3k8z"
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Validation failed"
  }
}
```

---

# 14. Observability Standards

# MUST

Every request SHALL emit:

* request ID
* trace ID
* latency metrics
* auth context

---

# MUST

Critical APIs SHALL support:

* audit logging
* failure tracing
* replay investigation

---

# 15. Rate Limiting Standards

# MUST

Rate limits SHALL exist for:

* auth endpoints
* AI generation
* recruiter search
* exports

---

# Example Responses

| Status | Meaning   |
| ------ | --------- |
| 429    | throttled |

---

# 16. API Security Rules

# MUST

APIs SHALL enforce:

* HTTPS
* JWT validation
* RBAC
* tenant isolation

---

# MUST NOT

APIs SHALL:

* trust client-side role claims
* expose internal queue payloads

---

# 17. Webhook Standards

# Purpose

Handle external async callbacks safely.

---

# MUST

Webhooks SHALL:

* validate signatures
* remain idempotent
* support retries

---

# Supported Webhooks

| Provider         | Purpose              |
| ---------------- | -------------------- |
| GitHub           | sync events          |
| billing provider | subscription updates |

---

# 18. API Evolution Rules

# MUST

API evolution SHALL support:

* backward compatibility
* deprecation warnings
* migration paths

---

# SHOULD

Deprecated APIs SHOULD provide:

```text id="1n5j7y"
sunset timeline
```

---

# 19. API Governance Invariants

The following SHALL always remain true:

1. No cross-tenant API leakage
2. No async blocking on API threads
3. No unvalidated payload persistence
4. No unsupported recruiter-visible claims
5. No hidden private repository exposure
6. No unaudited privileged actions
7. No silent auth bypass
8. No non-versioned public APIs

---

# 20. Definition of API Readiness

An API subsystem is considered production-ready only when:

* versioned
* authenticated
* tenant-safe
* observable
* documented
* rate-limited
* validated
* retry-safe
* async-safe
* rollback-compatible

```
```
