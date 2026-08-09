Purpose

Define binding constraints, preferences, decision boundaries, trade-offs, escalation triggers, and Definition of Done for Repo2Reputation.

1. Architectural Constraints
Must
The platform must support cloud-native deployment.
The platform must separate frontend, API, worker, and AI processing concerns.
The platform must support horizontal scaling of stateless services.
The platform must support asynchronous job processing for ingestion and AI workloads.
The platform must expose versioned APIs.
The platform must maintain tenant isolation for institutional customers.
The platform must support zero-downtime rolling deployments.
Must-Not
The system must not couple AI generation directly to synchronous user login flows.
The system must not rely on a single compute instance for production workloads.
The system must not hardcode environment secrets in source control.
The system must not allow cross-tenant data joins without explicit authorization.
Preferences
Kubernetes-based orchestration.
Managed cloud services where operationally efficient.
Event-driven integrations.
PostgreSQL as primary relational store.
Redis for caching and queue acceleration.
2. Product Constraints
Must
Users must approve public portfolio publication.
Users must be able to edit AI-generated outputs before publishing.
Recruiter-facing claims must be evidence-grounded.
The system must support institutional white-label branding.
Core student workflows must function on mobile browsers.
Must-Not
The system must not publish portfolios automatically after generation.
The system must not expose private repository source code publicly.
The system must not require coding knowledge to use portfolio tools.
Preferences
Minimal onboarding friction.
First-value experience within 15 minutes of signup.
Self-service configuration for most user actions.
3. Security Constraints
Must
TLS 1.2+ for all external traffic.
MFA for Admin and Institutional Admin roles.
Password hashing using Argon2 or bcrypt.
Encryption at rest for sensitive data stores.
Role-based authorization on all protected routes.
Immutable audit logs for privileged actions.
Quarterly dependency vulnerability scanning.
Must-Not
No plaintext passwords.
No production access via shared credentials.
No direct database exposure to public internet.
No unrestricted admin impersonation without logging.
Preferences
SSO support for enterprise tenants.
Hardware-backed secret storage.
Automated key rotation.
4. Privacy & Compliance Constraints
Must
GDPR-compliant deletion workflow.
CCPA-compliant data access/export workflow.
Consent capture before public profile indexing.
Retention policy for logs and personal data.
Ability to suppress personally identifiable data from analytics exports.
Must-Not
No sale of identifiable student data.
No use of private repositories for model training without explicit consent.
No retention beyond policy without approved exception.
Preferences
Region-aware data residency options.
Consent center for user preferences.
5. AI System Constraints
Must
AI outputs must include evidence traceability for material claims.
Low-confidence outputs must be flagged.
Hallucination rate must remain <= 3% on audited samples.
Prompt templates must be version controlled.
Safety filters must block harmful or discriminatory output.
Human override/edit capability must exist.
Must-Not
No fabricated experience claims.
No inferred protected attributes (race, religion, health, etc.).
No autonomous publishing of generated narratives.
Preferences
Multi-model routing for cost optimization.
Smaller models for preprocessing/classification.
Larger models only for high-value generation tasks.
6. Performance Constraints
Must
Dashboard page load <= 2.5 seconds p95.
Auth login <= 2 seconds p95.
Standard AI generation <= 12 seconds p95.
Search responses <= 1 second p95 for indexed queries.
Queue backlog recovery within 30 minutes after transient spikes.
Must-Not
No blocking long-running jobs on request threads.
No synchronous processing of large repository imports.
Preferences
Aggressive caching of repeat analytics queries.
CDN-backed static asset delivery.
7. Reliability Constraints
Must
Monthly uptime >= 99.9%.
Backups daily minimum.
RTO <= 4 hours.
RPO <= 1 hour.
Multi-zone deployment for production workloads.
Automated health checks and restart policies.
Must-Not
No single point of failure in production.
No manual-only recovery dependency.
Preferences
Chaos testing before enterprise launch.
Blue/green deployment support.
8. Delivery Constraints
Must
CI pipeline required for all merges.
Automated tests required before production deployment.
Infrastructure changes managed as code.
Change approval required for production schema migrations.
Release notes published for each production release.
Must-Not
No direct production hotfixes without traceability.
No unreviewed code to protected branches.
Preferences
Trunk-based development with feature flags.
Weekly release cadence.
9. Trade-offs & Decision Guidance
Decision Area	Option A	Option B	Preferred Rule
Speed vs Quality	Faster generation	Higher quality generation	Default quality for paid/public outputs
Cost vs Accuracy	Lower-cost models	Higher-accuracy models	Route by user tier/use case
Simplicity vs Scale	Monolith	Microservices	Modular monolith early, services later
Flexibility vs Governance	Open customization	Controlled templates	Controlled defaults + overrides
Real-time vs Batch	Immediate analytics	Batched analytics	Real-time user metrics, batch heavy reports
10. Escalation Triggers

Immediate escalation required when any condition occurs:

Uptime projected below 99.9%.
Security breach or suspected unauthorized access.
Hallucination audit rate exceeds 3%.
Queue backlog exceeds 1 hour.
Payment or billing failures exceed 2% daily volume.
Cross-tenant data exposure suspected.
Data deletion SLA breach.
P95 latency exceeds target for 24 continuous hours.
Failed deployment affecting >10% active users.
11. Assumptions

ASSUMPTION: Initial user growth allows phased scaling rather than instant hyperscale.
Alternative: Pre-provision higher baseline infrastructure.

ASSUMPTION: Most institutions accept shared SaaS tenancy with logical isolation.
Alternative: Offer dedicated single-tenant enterprise tier.

ASSUMPTION: Users prefer editable AI drafts over manual blank-state creation.
Alternative: Template-first non-AI workflow.

12. Definition of Done

A feature is complete only when all below are true:

Functional
Requirements implemented.
Acceptance criteria passed.
Edge cases handled.
Quality
Unit/integration tests added.
No Sev1 or Sev2 defects open.
Performance targets met in staging.
Security
AuthZ reviewed.
Sensitive data handling validated.
Logs contain no secrets.
Operations
Metrics and alerts added.
Runbook updated.
Rollback path verified.
Documentation
API/docs updated.
User-facing changes documented.
Support notes published if needed.
Approval
Product owner approved.
Engineering lead approved.
Release manager approved for production.