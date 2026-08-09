MODE: BUILD
PROGRESS: Architecture consolidation underway
PATH: Directives → Domain Models → Workflows → AI → Infrastructure
LOCKS: One file at a time

CURRENT STEP
Goal → Generate the canonical domain model specification file.
Why → Your previous architecture likely scattered entities across multiple docs. We need one authoritative source for all platform entities before workflows/services are generated.
Expected Result → A single normalized domain/entity definition file that aligns with the new directives and removes redundancy later.

---

# File 2

`architecture/02_domain_model.md`

```md
# Repo2Reputation — Canonical Domain Model

# Purpose

Define the authoritative domain entities, ownership boundaries, relationships,
and lifecycle responsibilities for the Repo2Reputation platform.

This file acts as the single source of truth for:

- Database entity planning
- Service boundaries
- API ownership
- Event ownership
- AI pipeline inputs
- Portfolio generation flows
- Multi-tenant enforcement

This file intentionally replaces fragmented entity definitions previously spread across:
- schema docs
- API docs
- AI docs
- onboarding docs
- workflow specs

---

# Domain Principles

## MUST

Each domain:

- owns its persistence
- owns its validation
- owns its business rules
- exposes stable interfaces
- emits domain events

## MUST NOT

Domains SHALL NOT directly manipulate another domain’s database tables.

---

# High-Level Domain Map

| Domain | Responsibility |
|---|---|
| Identity | Authentication & accounts |
| Tenant | Multi-tenant isolation |
| Repository | GitHub ingestion & metadata |
| AI Analysis | Repository intelligence |
| Portfolio | Public portfolio generation |
| Recruiter | Talent discovery |
| Organization | Institutional onboarding |
| Workflow | Async orchestration |
| Notification | Email & alerts |
| Audit | Compliance & activity history |
| Billing | Subscription management |
| Search | Search indexing & retrieval |
| Analytics | Product insights |

---

# 1. Identity Domain

## Responsibility

Handles:

- authentication
- authorization
- sessions
- role management
- GitHub identity linking

---

## Entities

### User

| Field | Type |
|---|---|
| id | uuid |
| tenant_id | uuid nullable |
| email | string |
| password_hash | string nullable |
| role | enum |
| github_username | string nullable |
| github_user_id | string nullable |
| github_access_token_encrypted | text nullable |
| created_at | timestamp |
| updated_at | timestamp |
| deleted_at | timestamp nullable |

---

### Session

| Field | Type |
|---|---|
| id | uuid |
| user_id | uuid |
| refresh_token_hash | text |
| expires_at | timestamp |
| revoked_at | timestamp nullable |
| created_at | timestamp |

---

## Events

- user.created
- user.updated
- github.connected
- github.disconnected
- session.created
- session.revoked

---

# 2. Tenant Domain

## Responsibility

Handles logical multi-tenant isolation.

---

## Entities

### Tenant

| Field | Type |
|---|---|
| id | uuid |
| name | string |
| slug | string |
| plan_type | enum |
| created_at | timestamp |

---

### TenantMembership

| Field | Type |
|---|---|
| id | uuid |
| tenant_id | uuid |
| user_id | uuid |
| role | enum |
| created_at | timestamp |

---

## Events

- tenant.created
- tenant.member_added

---

# 3. Repository Domain

## Responsibility

Handles:

- GitHub synchronization
- repository imports
- metadata persistence
- README ingestion
- dependency extraction

---

## Entities

### Repository

| Field | Type |
|---|---|
| id | uuid |
| tenant_id | uuid nullable |
| owner_user_id | uuid |
| provider | enum |
| external_repo_id | string |
| name | string |
| full_name | string |
| private | boolean |
| description | text nullable |
| default_branch | string |
| primary_language | string nullable |
| stars_count | integer |
| forks_count | integer |
| repo_created_at | timestamp |
| repo_updated_at | timestamp |
| imported_at | timestamp |
| sync_status | enum |
| created_at | timestamp |

---

### RepositoryTopic

| Field | Type |
|---|---|
| id | uuid |
| repository_id | uuid |
| topic | string |

---

### RepositoryReadme

| Field | Type |
|---|---|
| id | uuid |
| repository_id | uuid |
| content | text |
| fetched_at | timestamp |

---

### RepositoryDependency

| Field | Type |
|---|---|
| id | uuid |
| repository_id | uuid |
| ecosystem | string |
| package_name | string |
| version | string nullable |

---

### RepositoryImportJob

| Field | Type |
|---|---|
| id | uuid |
| repository_id | uuid nullable |
| user_id | uuid |
| status | enum |
| started_at | timestamp nullable |
| completed_at | timestamp nullable |
| error_message | text nullable |

---

## Events

- repo.import.requested
- repo.import.completed
- repo.sync.started
- repo.sync.completed
- repo.readme.fetched
- repo.dependencies.extracted

---

# 4. AI Analysis Domain

## Responsibility

Handles AI-driven repository intelligence.

---

## Entities

### RepositoryAnalysis

| Field | Type |
|---|---|
| id | uuid |
| repository_id | uuid |
| analysis_version | string |
| confidence_score | decimal |
| status | enum |
| generated_at | timestamp |

---

### SkillInference

| Field | Type |
|---|---|
| id | uuid |
| repository_analysis_id | uuid |
| skill_name | string |
| confidence_score | decimal |
| evidence | text |

---

### NarrativeGeneration

| Field | Type |
|---|---|
| id | uuid |
| repository_analysis_id | uuid |
| narrative_type | enum |
| content | text |
| approved | boolean |
| generated_at | timestamp |

---

## Events

- ai.analysis.requested
- ai.analysis.completed
- ai.narrative.generated
- ai.analysis.failed

---

# 5. Portfolio Domain

## Responsibility

Handles student-facing portfolio generation and publishing.

---

## Entities

### Portfolio

| Field | Type |
|---|---|
| id | uuid |
| user_id | uuid |
| slug | string |
| visibility | enum |
| headline | string nullable |
| summary | text nullable |
| published_at | timestamp nullable |
| created_at | timestamp |

---

### PortfolioProject

| Field | Type |
|---|---|
| id | uuid |
| portfolio_id | uuid |
| repository_id | uuid |
| display_order | integer |

---

### PortfolioSection

| Field | Type |
|---|---|
| id | uuid |
| portfolio_id | uuid |
| section_type | enum |
| content | jsonb |

---

## Events

- portfolio.created
- portfolio.updated
- portfolio.published
- portfolio.unpublished

---

# 6. Recruiter Domain

## Responsibility

Handles recruiter discovery workflows.

---

## Entities

### RecruiterProfile

| Field | Type |
|---|---|
| id | uuid |
| user_id | uuid |
| company_name | string |
| created_at | timestamp |

---

### CandidateBookmark

| Field | Type |
|---|---|
| id | uuid |
| recruiter_user_id | uuid |
| candidate_user_id | uuid |
| created_at | timestamp |

---

## Events

- recruiter.profile.created
- candidate.bookmarked

---

# 7. Organization Domain

## Responsibility

Handles institutional onboarding and administration.

---

## Entities

### Organization

| Field | Type |
|---|---|
| id | uuid |
| tenant_id | uuid |
| name | string |
| created_at | timestamp |

---

### Cohort

| Field | Type |
|---|---|
| id | uuid |
| organization_id | uuid |
| name | string |
| start_date | date |
| end_date | date nullable |

---

## Events

- organization.created
- cohort.created

---

# 8. Workflow Domain

## Responsibility

Tracks async orchestration jobs.

---

## Entities

### WorkflowJob

| Field | Type |
|---|---|
| id | uuid |
| job_type | enum |
| status | enum |
| payload | jsonb |
| attempts | integer |
| started_at | timestamp nullable |
| completed_at | timestamp nullable |

---

## Events

- workflow.started
- workflow.completed
- workflow.failed

---

# 9. Notification Domain

## Responsibility

Handles outbound communications.

---

## Entities

### Notification

| Field | Type |
|---|---|
| id | uuid |
| user_id | uuid |
| type | enum |
| channel | enum |
| payload | jsonb |
| sent_at | timestamp nullable |

---

## Events

- notification.queued
- notification.sent
- notification.failed

---

# 10. Audit Domain

## Responsibility

Tracks compliance-sensitive actions.

---

## Entities

### AuditLog

| Field | Type |
|---|---|
| id | uuid |
| actor_user_id | uuid nullable |
| tenant_id | uuid nullable |
| action | string |
| entity_type | string |
| entity_id | uuid nullable |
| metadata | jsonb |
| created_at | timestamp |

---

# 11. Billing Domain

## Responsibility

Handles subscription lifecycle management.

---

## Entities

### Subscription

| Field | Type |
|---|---|
| id | uuid |
| tenant_id | uuid |
| provider | enum |
| external_subscription_id | string |
| plan_type | enum |
| status | enum |
| current_period_end | timestamp |

---

# 12. Search Domain

## Responsibility

Handles indexed recruiter discovery.

---

## Entities

### SearchDocument

| Field | Type |
|---|---|
| id | uuid |
| entity_type | string |
| entity_id | uuid |
| searchable_content | text |
| indexed_at | timestamp |

---

# 13. Analytics Domain

## Responsibility

Tracks product and engagement metrics.

---

## Entities

### AnalyticsEvent

| Field | Type |
|---|---|
| id | uuid |
| tenant_id | uuid nullable |
| user_id | uuid nullable |
| event_name | string |
| payload | jsonb |
| created_at | timestamp |

---

# Shared Enumerations

## UserRole

- student
- recruiter
- admin
- institutional_admin

---

## RepositoryProvider

- github

---

## PortfolioVisibility

- private
- unlisted
- public

---

## SyncStatus

- pending
- syncing
- synced
- failed

---

## WorkflowStatus

- pending
- running
- completed
- failed

---

# Cross-Domain Relationships

| Source | Relationship | Target |
|---|---|---|
| User | owns | Portfolio |
| User | imports | Repository |
| Repository | generates | RepositoryAnalysis |
| RepositoryAnalysis | generates | NarrativeGeneration |
| Portfolio | references | Repository |
| Recruiter | bookmarks | User |
| Tenant | contains | Users |

---

# Domain Ownership Rules

## MUST

Every database table SHALL belong to exactly one domain.

## MUST

Only the owning domain may:

- mutate records
- enforce invariants
- emit lifecycle events

---

# Future Expansion Areas

Reserved future domains:

- Recommendation Engine
- Interview Readiness
- Resume Generation
- AI Coaching
- Marketplace
- Team Collaboration
- Certification Verification
- Skill Benchmarking

---

# Definition of Domain Completion

A domain is considered production-ready only when it includes:

- entities
- validation rules
- migrations
- tests
- events
- observability
- authorization rules
- failure handling
- audit support
```
