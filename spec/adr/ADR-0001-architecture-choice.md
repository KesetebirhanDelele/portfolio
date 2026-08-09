Status

Accepted

Date

2026-04-17

Context

Repo2Reputation requires a production-ready architecture capable of supporting:

Student onboarding and authentication
GitHub repository ingestion
AI analysis and narrative generation
Public portfolio hosting
Recruiter search workflows
Institutional multi-tenancy
High availability targets (99.9%+)
Fast iteration during early-stage product discovery

The system must balance:

Speed of initial delivery
Operational simplicity
Future scalability
Cost efficiency
Team productivity

The expected early engineering team is small-to-medium sized, making excessive distributed-system complexity undesirable during MVP stages.

Decision

Adopt a Modular Monolith + Asynchronous Worker Architecture initially, with a planned evolution path toward selective microservices.

Core Structure
Web Frontend (Next.js)
↓
Primary Backend Application (Modular Monolith)
 ├─ Auth Module
 ├─ User Module
 ├─ Repository Module
 ├─ Portfolio Module
 ├─ Billing Module
 ├─ Admin Module
 └─ Public API Layer

Async Workers
 ├─ Repo Import Worker
 ├─ AI Analysis Worker
 ├─ Generation Worker
 ├─ Email Worker
 └─ Export Worker

Shared Data Layer
 ├─ PostgreSQL
 ├─ Redis
 ├─ Object Storage
 └─ Search Index
Why This Decision
Advantages
Faster Initial Delivery

Single deployable backend reduces:

Service sprawl
Networking overhead
Contract management burden
Duplicate infrastructure
Easier Team Coordination

Small teams can work within modules rather than coordinating many repos/services.

Lower Cost

Fewer runtime services reduce:

Hosting spend
Monitoring complexity
CI/CD complexity
Support burden
Clear Growth Path

Heavy workloads already separated into workers, making later extraction easier.

Rejected Alternatives
Option A: Full Microservices from Day 1
Rejected Because
High operational complexity
Slower MVP delivery
More DevOps burden
Harder debugging
Premature scaling architecture
Option B: Pure Monolith Without Workers
Rejected Because
AI workloads would block requests
Imports are long-running
Poor scalability for async jobs
Lower reliability under spikes
Option C: Serverless-Only Architecture
Rejected Because
Long-running jobs awkward
Cold start risk
Complex local development
Potential cost unpredictability
Boundaries Inside Modular Monolith
Required Internal Modules
auth
users
repositories
ingestion
ai orchestration
portfolios
recruiter search
tenants
billing
analytics
admin

Each module must have:

Owned domain models
Clear interfaces
Independent tests
No direct cross-module table coupling unless approved
Worker Separation Rules

Must run outside request-response path:

Repository imports
GitHub sync jobs
AI analysis
Narrative generation
PDF export
Bulk onboarding emails
Reindexing jobs
Triggers to Evolve to Microservices

Extract services only when one or more occur:

Trigger	Example
Independent scaling need	AI workers need 10x API scale
Team ownership split	Separate AI engineering team
Reliability isolation need	Search failures affect API
Deployment bottlenecks	Frequent conflicts in monolith
Compliance isolation	Dedicated tenant environments
Initial Deployment Model
Production
1 frontend deployment
1 backend app deployment
Worker deployment pool
Managed PostgreSQL
Managed Redis
Managed object storage
Managed search cluster (optional early)
Risks
Risk	Mitigation
Monolith grows messy	Strict module boundaries
Shared DB coupling	Schema ownership rules
Slow deployments	CI optimization + modular tests
AI queue overload	Separate worker autoscaling
Operational Implications
Positive
Simpler observability
Easier local development
Lower support burden
Negative
Some future refactor cost likely
Requires discipline to avoid “big ball of mud”
Success Metrics

Architecture remains valid while:

Deployment time <= 15 min
API p95 latency within targets
Team velocity stable
No module causes frequent regressions
Worker backlog manageable
Review Date

Reassess after earliest of:

50,000 monthly active users
10 engineers on backend/platform teams
3 enterprise tenants
AI workload cost >30% infrastructure spend
Assumptions

ASSUMPTION: Initial growth is moderate and manageable with modular monolith scale-up.
Alternative: Accelerate service extraction roadmap.

ASSUMPTION: Team can enforce architectural discipline.
Alternative: Earlier domain service separation.

Decision Outcome

Approved for MVP through Growth Stage 1 with scheduled reassessment triggers.