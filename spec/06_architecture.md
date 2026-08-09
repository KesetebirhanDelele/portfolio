Purpose

Define the target production architecture for Repo2Reputation including components, boundaries, data flow, integrations, deployment model, risks, and architectural decisions.

1. Architecture Goals

The system architecture must enable:

Secure GitHub repository ingestion
Scalable AI analysis and content generation
Low-latency user dashboards
Multi-tenant institutional expansion
High availability (99.9%+)
Compliance-ready operations
Cost-controlled AI workloads
2. High-Level Architecture
Users
 ├─ Students
 ├─ Recruiters
 ├─ Institutional Admins
 └─ Platform Admins

        │
        ▼

Frontend Web App (React / Next.js)
        │
        ▼

API Gateway / Backend Services
        │
 ┌──────┼──────────────┬──────────────┬──────────────┐
 ▼      ▼              ▼              ▼              ▼
Auth  Portfolio     Ingestion      Search         Analytics
Svc   Service       Service        Service        Service

        │
        ▼

Async Queue / Event Bus
        │
 ┌──────┼───────────────┬───────────────┐
 ▼      ▼               ▼               ▼
AI Worker   GitHub Sync Worker   Export Worker   Email Worker

        │
        ▼

AI Model Layer / LLM Providers

        │
        ▼

Data Layer
 ├─ PostgreSQL
 ├─ Redis
 ├─ Object Storage
 └─ Search Index
3. Core Components
3.1 Frontend Application
Responsibilities
User authentication flows
GitHub connection UX
Dashboard metrics
Portfolio builder
Recruiter search UI
Institutional admin dashboards
Technology Preference
Next.js
TypeScript
Tailwind or component system
CDN-hosted static assets
Boundary

No direct database access. All actions through APIs.

3.2 API Gateway / Backend
Responsibilities
Route requests
Validate auth tokens
Rate limiting
Request tracing
Aggregate downstream services
Technology Preference
Node.js / TypeScript
REST APIs
OpenAPI contracts
Boundary

No heavy AI processing on request threads.

3.3 Authentication Service
Responsibilities
Email/password auth
GitHub OAuth
JWT issuance
Refresh tokens
MFA for admins
Session revocation
Data Owned
Users
Sessions
Roles
MFA state
3.4 Repository Ingestion Service
Responsibilities
Connect GitHub APIs
Pull metadata
Queue imports
Normalize repository data
Deduplicate repeated imports
Data Owned
Repo records
Import jobs
Sync status
Constraints

Must tolerate API rate limits and transient failures.

3.5 AI Analysis Service
Responsibilities
Tech stack detection
Skill extraction
Domain classification
Confidence scoring
Evidence linking
Technology Preference
Python workers
ML libraries
Model routing layer
Boundary

No direct public internet exposure.

3.6 Narrative Generation Service
Responsibilities
Resume bullets
Portfolio summaries
Project descriptions
Variant generation
Constraints

All material claims must be evidence-grounded.

3.7 Portfolio Service
Responsibilities
Draft storage
Theme/layout settings
Public publishing
PDF export
Version history
3.8 Search Service
Responsibilities
Candidate indexing
Skill filtering
Recruiter queries
Ranking logic
Technology Preference
OpenSearch / Elasticsearch
3.9 Analytics Service
Responsibilities
Event ingestion
Funnel metrics
A/B testing
Institutional reporting
4. Data Layer
4.1 PostgreSQL

Use for:

Users
Tenants
Roles
Portfolios
Billing
Job metadata
Audit references
4.2 Redis

Use for:

Caching
Rate limiting
Session acceleration
Queue state (optional)
4.3 Object Storage

Use for:

Exported PDFs
Profile images
Logs archive
Snapshot artifacts
4.4 Search Index

Use for:

Candidate profiles
Skills lookup
Recruiter search ranking
5. Event / Queue Architecture
Recommended Queues
repo.import.requested
repo.import.completed
ai.analysis.requested
ai.analysis.completed
narrative.generate.requested
portfolio.publish.requested
email.send.requested
Requirements
At-least-once delivery acceptable
Idempotent consumers required
Dead-letter queues mandatory
6. Data Flow
6.1 Student Portfolio Creation
Student signs in
→ Connects GitHub
→ Selects repos
→ Import job queued
→ Repo data processed
→ AI analysis runs
→ Narrative drafts generated
→ User edits content
→ Portfolio published
6.2 Recruiter Search
Recruiter signs in
→ Searches skills/filters
→ Search service returns candidates
→ Opens portfolio
→ Engagement events tracked
6.3 Institutional Onboarding
Admin uploads CSV
→ Validation runs
→ Accounts created
→ Invite emails sent
→ Tenant dashboard updated
7. Multi-Tenant Model
Recommended Approach

Shared application with logical tenant isolation.

Tenant Isolation Controls
tenant_id on scoped records
Policy enforcement middleware
Separate analytics partitions
Tenant branding config
Upgrade Path

Dedicated single-tenant enterprise deployments.

8. Deployment Architecture
Environments
Development
Staging
Production
Production Topology
Multi-zone Kubernetes cluster
Managed PostgreSQL HA
Redis managed cluster
CDN + WAF
Autoscaling workers
Release Strategy
CI/CD pipelines
Blue/green or rolling deploys
Feature flags
9. Security Architecture
Controls
TLS everywhere
Secrets manager
RBAC
MFA for privileged roles
WAF
Audit logging
Encryption at rest
Network segmentation
Sensitive Data Classes
User identity data
OAuth tokens
Billing data
Portfolio private drafts
10. Observability Architecture
Logs

Structured centralized logs.

Metrics
API latency
Queue depth
Job failures
AI cost per request
Conversion funnel
Tracing

Distributed tracing across services.

Alerts

Pager alerts for Sev1/Sev2 incidents.

11. Capacity Targets
Metric	Initial Target
Monthly active users	50,000
Concurrent sessions	5,000
Daily repo imports	10,000
AI generations/day	25,000
Search queries/min	2,000
12. Architectural Risks & Mitigations
Risk	Impact	Mitigation
GitHub API throttling	Import delays	Cache + queue + retries
AI cost spikes	Margin pressure	Model routing + quotas
Cross-tenant leakage	Severe trust loss	Scoped auth + tests
Search relevance poor	Recruiter churn	Ranking iteration
Queue backlog	Delays	Autoscale workers
13. Key Architectural Decisions
ADR-0001

Start with modular monolith APIs + worker services, evolve to microservices when justified.

ADR-0002

Use PostgreSQL as system of record.

ADR-0003

Use asynchronous processing for imports and AI generation.

ADR-0004

Use shared multi-tenant SaaS first, dedicated tenancy later.

14. Assumptions

ASSUMPTION: Early traffic can be served efficiently with a single regional deployment.
Alternative: Multi-region active-active.

ASSUMPTION: LLM providers remain externally available.
Alternative: Self-hosted open models for fallback.

15. Definition of Done

Architecture is complete when:

Service boundaries documented
Infra diagrams approved
Capacity model reviewed
Security review passed
Runbooks linked
Deployment validated in staging