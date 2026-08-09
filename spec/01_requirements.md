Purpose

Define measurable functional and non-functional requirements for Repo2Reputation, an AI platform that converts GitHub repositories into employability portfolios, narratives, and hiring insights.

1. Functional Requirements
1.1 Authentication & Access Control
Requirements
The system must support email/password authentication.
The system must support OAuth login with GitHub.
The system must support JWT-based session tokens with refresh tokens.
The system must support RBAC roles:
Student
Admin
Hiring Manager
Institutional Admin
The system must automatically revoke sessions after password reset.
The system must log all privileged admin actions.
Acceptance Criteria

Given a valid user credential set
When the user logs in
Then access is granted in <= 2 seconds p95.

Given a user without permission
When they request an admin route
Then the system returns HTTP 403.

1.2 GitHub Repository Ingestion
Requirements
Users must be able to connect GitHub accounts via OAuth.
Users must be able to select repositories for import.
The system must ingest:
Repository metadata
Languages
README
Topics/tags
Commit summaries
File tree metadata
The system must support retry on temporary GitHub API failures.
The system must queue ingestion jobs asynchronously.
The system must notify users when import completes.
Performance Targets
95% of repositories under 500 MB metadata scope imported in <= 3 minutes.
Retry transient failures up to 3 times with exponential backoff.
Acceptance Criteria

Given a valid connected GitHub account
When a student selects repositories
Then import jobs begin within 10 seconds.

Given GitHub rate limits occur
When import is attempted
Then the system queues retry without data corruption.

1.3 AI Analysis Engine
Requirements
The system must classify repository technology stacks.
The system must infer demonstrated skills.
The system must classify project domain categories.
The system must produce confidence scores for each inference.
The system must store evidence references used for claims.
The system must flag low-confidence outputs for user review.
Quality Targets
Tech stack classification precision >= 90%.
Hallucinated unsupported skill claims <= 3%.
Low-confidence routing triggered below configurable threshold.
Acceptance Criteria

Given a completed repository import
When analysis runs
Then at least one structured skill report is generated.

Given evidence is insufficient
When confidence falls below threshold
Then the output is marked “Needs Review”.

1.4 Narrative Generation
Requirements
Generate recruiter-facing summaries.
Generate project descriptions.
Generate resume bullet points.
Generate personalized branding statements.
Allow tone selection:
Professional
Technical
Concise
Leadership-oriented
Allow user editing before publish.
Performance Targets
Standard narrative generation <= 12 seconds p95.
Retry failed generations once automatically.
Acceptance Criteria

Given a completed analysis
When a user requests portfolio content
Then editable drafts are returned.

Given generated content contains unsupported claims
When validation runs
Then content is blocked until corrected.

1.5 Portfolio Builder
Requirements
Users must edit generated content.
Users must reorder sections.
Users must upload profile image.
Users must publish public portfolio URLs.
Users must unpublish at any time.
Users must export PDF.
Performance Targets
Published portfolio pages load <= 2.5 seconds p95.
Acceptance Criteria

Given a published portfolio
When a recruiter opens the page
Then content renders correctly on mobile and desktop.

1.6 Search & Hiring Manager Tools
Requirements
Hiring managers must search candidates by:
Skill
Language
Graduation year
Institution
Role interest
Hiring managers must save shortlists.
Candidate contact requires consent workflow.
Acceptance Criteria

Given a recruiter searches “React + Node.js”
When results are returned
Then only matching visible candidates are listed.

1.7 Institutional Features
Requirements
Support multi-tenant institutions.
Bulk onboarding via CSV.
Tenant-level branding.
Cohort analytics dashboards.
Export placement reports.
Acceptance Criteria

Given a valid CSV of students
When onboarding runs
Then >=95% valid rows are provisioned automatically.

2. Non-Functional Requirements
2.1 Availability
Monthly uptime must be >= 99.9%.
Planned maintenance windows must be announced 72h in advance.
2.2 Security
TLS 1.2+ for all traffic.
Passwords hashed with Argon2 or bcrypt.
Sensitive data encrypted at rest.
Admin accounts require MFA.
2.3 Privacy
GDPR and CCPA deletion workflows required.
Consent required before portfolio public listing.
User data export available within 24h request SLA.
2.4 Scalability
Support 50,000 MAU initial scale.
Support 5,000 concurrent sessions.
Horizontal scaling required for API and worker tiers.
2.5 Observability
Structured logs for all services.
Metrics for latency, errors, queue depth.
Alerting on Sev1 incidents within 5 minutes.
3. Constraints
Must
Use evidence-grounded AI outputs.
Maintain tenant isolation.
Use asynchronous ingestion architecture.
Provide audit logs.
Must-Not
Publish portfolios without consent.
Claim skills unsupported by repository evidence.
Share tenant data across institutions.
Preferences
Cloud-native deployment.
Modular microservice boundaries.
API-first integrations.
Trade-offs
Faster generation may reduce output quality.
Lower AI cost may reduce personalization depth.
Escalation Triggers
Uptime below 99.9%.
Hallucination rate above 3%.
Ingestion failure rate above 5%.
Security incident of any severity.
4. Definition of Done
Requirements implemented.
Automated tests passing >= 90% critical coverage.
Security review completed.
Monitoring dashboards live.
Documentation approved.
Stakeholder UAT signed off.
5. Assumptions

ASSUMPTION: GitHub remains primary integration source.
Alternative: Add GitLab/Bitbucket connectors.

ASSUMPTION: Users accept AI-generated first drafts.
Alternative: Human-template assisted generation mode.