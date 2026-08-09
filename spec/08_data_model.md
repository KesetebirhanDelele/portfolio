Purpose

Define the logical and physical data model for Repo2Reputation including core entities, relationships, ownership boundaries, retention rules, indexing strategy, and scalability considerations.

1. Data Model Principles
PostgreSQL is the system of record.
Each mutable business object must have ownership metadata.
Tenant-aware tables must include tenant_id.
Personally identifiable data must be minimized.
Auditability required for privileged changes.
Search workloads should be offloaded to search index.
Analytics events may use append-only storage.
2. Primary Entities
Entity	Purpose
users	Accounts and identity
tenants	Institutions / organizations
memberships	User-to-tenant roles
sessions	Auth sessions
repositories	Imported source repositories
import_jobs	Repository ingestion jobs
analyses	AI analysis outputs
evidence_refs	Repository evidence links
generations	Narrative generation jobs/results
portfolios	Portfolio drafts/published content
portfolio_versions	Change history
recruiter_accounts	Hiring manager users
shortlists	Saved candidates
events	Product analytics
subscriptions	Billing plans
audit_logs	Privileged actions
3. Core Relational Schema
3.1 users
users
- id (pk, uuid)
- email (unique)
- password_hash (nullable for OAuth-only)
- github_user_id (nullable, unique)
- name
- headline
- avatar_url
- role (student/admin/recruiter)
- status (active/suspended/pending)
- email_verified_at
- last_login_at
- created_at
- updated_at
- deleted_at (nullable)
Notes
Soft delete required for operational recovery.
Email unique case-insensitive.
3.2 tenants
tenants
- id (pk, uuid)
- name
- slug (unique)
- plan (basic/pro/institutional)
- branding_config (jsonb)
- status
- created_at
- updated_at
3.3 memberships
memberships
- id (pk)
- tenant_id (fk tenants.id)
- user_id (fk users.id)
- role (student/admin/counselor)
- status
- created_at
Constraint

Unique (tenant_id, user_id).

3.4 sessions
sessions
- id (pk)
- user_id (fk users.id)
- refresh_token_hash
- ip_address
- user_agent
- expires_at
- revoked_at
- created_at
4. Repository Domain
4.1 repositories
repositories
- id (pk, uuid)
- user_id (fk users.id)
- tenant_id (nullable fk tenants.id)
- provider (github)
- external_repo_id
- name
- full_name
- private
- default_branch
- primary_language
- stars_count
- forks_count
- repo_created_at
- repo_updated_at
- imported_at
- sync_status
- created_at
- updated_at
Constraint

Unique (provider, external_repo_id).

4.2 import_jobs
import_jobs
- id (pk, uuid)
- user_id (fk users.id)
- repository_id (fk repositories.id)
- status (queued/running/succeeded/failed/cancelled)
- progress_pct
- error_code
- error_message
- started_at
- completed_at
- created_at
5. AI Intelligence Domain
5.1 analyses
analyses
- id (pk, uuid)
- repository_id (fk repositories.id)
- model_version
- status
- confidence_score
- skills_json (jsonb)
- domains_json (jsonb)
- summary_json (jsonb)
- created_at
- completed_at
Example skills_json
[
  {"name":"React","confidence":0.94},
  {"name":"Node.js","confidence":0.89}
]
5.2 evidence_refs
evidence_refs
- id (pk)
- analysis_id (fk analyses.id)
- claim_type
- claim_key
- source_path
- source_excerpt_hash
- confidence
- created_at
5.3 generations
generations
- id (pk, uuid)
- user_id (fk users.id)
- analysis_id (fk analyses.id)
- type (summary/projects/resume)
- tone
- status
- model_version
- prompt_version
- content_json (jsonb)
- validation_status
- created_at
- completed_at
6. Portfolio Domain
6.1 portfolios
portfolios
- id (pk, uuid)
- user_id (fk users.id)
- tenant_id (nullable fk tenants.id)
- title
- slug (unique)
- theme
- status (draft/published/archived)
- visibility (private/public/unlisted)
- content_json (jsonb)
- published_at
- created_at
- updated_at
6.2 portfolio_versions
portfolio_versions
- id (pk)
- portfolio_id (fk portfolios.id)
- version_number
- content_json (jsonb)
- created_by_user_id
- created_at
Constraint

Unique (portfolio_id, version_number).

7. Recruiter Domain
7.1 recruiter_accounts
recruiter_accounts
- id (pk)
- user_id (fk users.id)
- company_name
- approved_at
- created_at
7.2 shortlists
shortlists
- id (pk)
- recruiter_user_id (fk users.id)
- candidate_user_id (fk users.id)
- notes
- created_at
Constraint

Unique (recruiter_user_id, candidate_user_id).

8. Billing Domain
8.1 subscriptions
subscriptions
- id (pk)
- tenant_id (nullable fk tenants.id)
- user_id (nullable fk users.id)
- provider
- external_subscription_id
- plan
- status
- renewal_at
- created_at
9. Analytics Domain
9.1 events
events
- id (pk, uuid)
- tenant_id (nullable)
- user_id (nullable)
- anonymous_id (nullable)
- event_type
- entity_type
- entity_id
- metadata_json
- occurred_at
- created_at
Notes

Append-only table or warehouse stream recommended.

10. Governance Domain
10.1 audit_logs
audit_logs
- id (pk, uuid)
- actor_user_id
- tenant_id (nullable)
- action
- target_type
- target_id
- metadata_json
- ip_address
- created_at
11. Relationships
users 1---n repositories
users 1---n portfolios
users 1---n sessions
users n---n tenants (via memberships)

repositories 1---n import_jobs
repositories 1---n analyses

analyses 1---n evidence_refs
analyses 1---n generations

portfolios 1---n portfolio_versions

users n---n users (recruiter shortlists candidates)
12. Indexing Strategy
Required Indexes
Table	Index
users	lower(email) unique
repositories	(user_id, created_at desc)
repositories	(provider, external_repo_id) unique
import_jobs	(status, created_at)
analyses	(repository_id, created_at desc)
portfolios	(user_id, updated_at desc)
portfolios	slug unique
events	(event_type, occurred_at)
memberships	(tenant_id, user_id) unique
audit_logs	(actor_user_id, created_at desc)
13. Partitioning & Scale Guidance
Partition First Candidates
events by month
audit_logs by month
import_jobs by month (high volume)
Archive Candidates
stale sessions
old portfolio versions
completed jobs older than retention target
14. Retention Policy
Data Type	Minimum Policy
Sessions revoked	90 days
Audit logs	1 year
Events raw	13 months
Portfolio versions	1 year
Failed jobs	180 days

Subject to legal/compliance overrides.

15. Privacy Controls
Must Support
User export by user_id
User deletion/anonymization
Tenant scoped export
PII masking in analytics
Tokenized identifiers where possible
16. Search Index Projection

Search index should denormalize:

candidate name
headline
public skills
institution
graduation year
public portfolio summary
recruiter ranking signals

Do not index private drafts.

17. Migration Rules
Forward-only migrations preferred.
Destructive migrations require backup and approval.
Long-running migrations must be chunked.
Zero-downtime schema evolution required.
18. Assumptions

ASSUMPTION: PostgreSQL JSONB sufficient for flexible portfolio content.
Alternative: Separate document store for content bodies.

ASSUMPTION: Search traffic justifies dedicated index.
Alternative: SQL search in early MVP.

19. Definition of Done

Data model complete when:

ERD approved
Primary keys and FKs defined
Indexes reviewed
Retention policy approved
Migration plan documented
Tenant isolation validated