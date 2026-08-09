Purpose

Define implementation-ready acceptance criteria for Repo2Reputation using strict Given / When / Then format covering core workflows, edge cases, failures, and operational readiness.

1. Authentication & User Access
1.1 Student Registration

Given a new user provides valid email, password, and required consent fields
When registration is submitted
Then the account is created and verification email is sent within 60 seconds.

Given an email already exists
When registration is submitted
Then the system rejects the request with clear remediation steps.

1.2 GitHub OAuth Login

Given a user authorizes GitHub access
When OAuth callback completes successfully
Then the user is logged in and redirected to dashboard.

Given GitHub denies authorization
When callback returns failure
Then the user is shown reconnect steps without exposing system errors.

1.3 Role-Based Access

Given a Student account
When the user requests an Admin route
Then access is denied with HTTP 403.

Given an Institutional Admin account
When the user opens tenant reporting pages
Then only their tenant data is visible.

2. Repository Ingestion
2.1 Repository Selection

Given a connected GitHub account
When repositories are listed
Then visible repositories include name, visibility type, language summary, and last updated date.

2.2 Successful Import

Given one or more repositories are selected
When import begins
Then a queued job is created within 10 seconds.

Given a standard repository under supported limits
When processing completes
Then metadata, README, languages, and file tree summary are stored.

2.3 Import Failure Handling

Given GitHub API rate limiting occurs
When import fails temporarily
Then the system retries automatically up to 3 times.

Given repository permissions are revoked
When import is attempted
Then the job fails gracefully and prompts reconnect.

Given repository content exceeds configured limits
When processing begins
Then the system aborts safely and informs the user of limits.

3. AI Analysis Engine
3.1 Skill Extraction

Given a completed repository import
When analysis runs
Then the system returns detected technologies, inferred skills, and confidence scores.

3.2 Evidence Grounding

Given a generated skill claim
When a user views explanation details
Then the system displays supporting repository evidence references.

3.3 Low Confidence Outputs

Given analysis confidence falls below configured threshold
When results are produced
Then affected claims are marked “Needs Review”.

3.4 Failure Scenario

Given the AI provider is unavailable
When analysis is requested
Then the job is retried or queued and the user receives status messaging.

4. Narrative Generation
4.1 Portfolio Content Creation

Given completed repository analysis
When a student requests portfolio content
Then editable drafts are generated within 12 seconds p95.

4.2 Tone Selection

Given a user selects “Technical” tone
When generation runs
Then the output uses technical language appropriate for recruiters.

4.3 Unsupported Claims Protection

Given generated content contains unsupported claims
When validation executes
Then publication is blocked until corrected.

4.4 Regeneration

Given a student is dissatisfied with draft output
When regenerate is selected
Then an alternate version is produced while preserving user edits elsewhere.

5. Portfolio Builder
5.1 Publish Portfolio

Given a completed portfolio draft
When the student selects Publish
Then a public URL is created and accessible.

5.2 Unpublish Portfolio

Given a published portfolio
When the student selects Unpublish
Then the public URL becomes inaccessible within 60 seconds.

5.3 Mobile Responsiveness

Given a recruiter opens a portfolio on mobile
When the page loads
Then all sections render without horizontal scrolling.

5.4 Export

Given a published or draft portfolio
When Export PDF is selected
Then a downloadable PDF is generated successfully.

6. Analytics & Optimization
6.1 View Tracking

Given a public portfolio receives a valid visit
When page view tracking runs
Then the dashboard count increases within 15 minutes.

6.2 A/B Variant Testing

Given two narrative variants are active
When traffic is split
Then impressions and conversions are recorded per variant.

6.3 Recommendation Engine

Given sufficient engagement data exists
When optimization runs
Then the system recommends at least one actionable improvement.

7. Hiring Manager Features
7.1 Candidate Search

Given a recruiter searches “Python Django”
When search executes
Then only visible candidate profiles matching criteria are returned.

7.2 Consent-Based Contact

Given a recruiter requests student contact details
When student consent is absent
Then personal contact information is withheld.

8. Institutional Features
8.1 Bulk Onboarding

Given a valid CSV upload
When onboarding begins
Then >=95% valid rows are provisioned automatically.

8.2 Tenant Isolation

Given two institutions exist
When one admin views dashboards
Then no other institution data is visible.

9. Security & Compliance
9.1 Authentication Security

Given repeated failed login attempts exceed threshold
When brute-force protections trigger
Then the account or IP is temporarily rate limited.

9.2 Data Deletion

Given a verified user requests account deletion
When deletion workflow completes
Then personal data is removed according to retention policy.

9.3 Audit Logging

Given an admin changes permissions
When action completes
Then actor, timestamp, target, and result are logged.

10. Reliability & Operations
10.1 Availability

Given monthly uptime is measured
When reporting period closes
Then uptime is >=99.9%.

10.2 Incident Alerting

Given API error rate exceeds threshold
When monitoring detects breach
Then alerts are sent within 5 minutes.

10.3 Disaster Recovery

Given primary environment fails
When DR process is invoked
Then service recovery meets RTO 4h and RPO 1h targets.

11. Edge Cases
11.1 Empty Repository

Given a repository contains minimal or no code
When analysis runs
Then the system explains insufficient evidence instead of inventing results.

11.2 Private Repository Revoked Mid-Process

Given access is revoked during ingestion
When processing continues
Then the job stops safely and partial data is quarantined.

11.3 Duplicate Imports

Given the same repository is selected twice
When second import starts
Then the system deduplicates or asks for refresh behavior.

12. Definition of Acceptance Pass

A release passes only when:

All Critical scenarios pass.
No Severity 1 defects remain open.
No Severity 2 security defects remain open.
p95 latency targets met for 7 consecutive days.
UAT signoff completed.