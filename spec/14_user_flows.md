Purpose

Define end-to-end user flows for Repo2Reputation across Students, Recruiters, Institutional Admins, and Platform Admins. Includes success paths, failure paths, decision points, metrics, and acceptance criteria.

1. User Flow Principles
Must
Reach first value quickly.
Minimize friction.
Preserve trust and consent.
Support mobile-first flows.
Recover gracefully from failures.
Track measurable conversion points.
2. Primary Personas
Persona	Goal
Student	Turn GitHub work into job-winning portfolio
Recruiter	Find qualified candidates efficiently
Institutional Admin	Improve student placement outcomes
Platform Admin	Operate and govern platform safely
3. Student Flow — New User Activation
Objective

Get a new student from signup to published portfolio.

Landing Page
→ Sign Up
→ Verify Email
→ Choose Career Goal
→ Connect GitHub
→ Select Repositories
→ Import + Analyze
→ Generate Portfolio Draft
→ Edit Content
→ Publish Portfolio
→ Share Link
Key Metrics
Signup conversion
GitHub connect rate
Repo import completion
Publish rate
Time to first publish
Acceptance Criteria

Given a new student signs up
When onboarding is completed
Then first portfolio can be published within 15 minutes median time.

4. Student Flow — Returning User Optimization
Objective

Improve existing portfolio performance.

Login
→ View Dashboard Metrics
→ See Recommendations
→ Regenerate Headline / Summary
→ Reorder Projects
→ Republish
→ Monitor Results
Metrics
Repeat session rate
Recommendation adoption rate
CTR uplift after edits
5. Student Flow — GitHub Connection Failure
Failure Flow
Connect GitHub
→ OAuth Denied / Error
→ Friendly Explanation
→ Retry Option
→ Help Docs
→ Manual Public Repo URL Option (future)
Acceptance Criteria

Given OAuth fails
When callback returns error
Then user receives retry guidance without technical jargon.

6. Student Flow — Low Confidence AI Output
Recovery Flow
Analysis Complete
→ Low Confidence Flag
→ Explain Missing Evidence
→ Ask User to Select More Repos
→ Regenerate
Goal

Preserve trust over false certainty.

7. Student Flow — Privacy Controls
Flow
Settings
→ Discoverability Preferences
→ Public / Unlisted / Private
→ Recruiter Contact Consent
→ Save Changes
Acceptance Criteria

Given a user disables discoverability
When saved
Then profile is removed from recruiter search within SLA window.

8. Recruiter Flow — Candidate Discovery
Objective

Find qualified candidates fast.

Recruiter Sign Up / Login
→ Approval Check
→ Search Skills / Filters
→ Candidate Results
→ Open Portfolio
→ Save Shortlist
→ Request Contact
Search Filters
Skills
Languages
Graduation year
Institution
Role interest
Portfolio popularity (optional)
Metrics
Search-to-profile-open rate
Shortlist rate
Contact request rate
9. Recruiter Flow — Consent Gate
Flow
Request Contact
→ Consent Exists?
    Yes → Reveal Approved Channel
    No  → Send Consent Request to Student
Acceptance Criteria

Given no consent exists
When recruiter requests contact
Then personal details remain hidden.

10. Institutional Admin Flow — Bulk Onboarding
Objective

Create many student accounts efficiently.

Login
→ Upload CSV
→ Validate Rows
→ Resolve Errors
→ Create Accounts
→ Send Invites
→ View Cohort Dashboard
Metrics
CSV success rate
Time to onboard cohort
Invite acceptance rate
11. Institutional Admin Flow — Outcomes Review
Open Dashboard
→ Cohort Portfolio Publish Rate
→ Recruiter Engagement
→ Top Skills Trends
→ Export Report
12. Platform Admin Flow — Moderation & Support
Admin Login (MFA)
→ View Alerts Queue
→ User Search
→ Suspend / Restore User
→ Review Audit Logs
→ Resolve Ticket
13. Platform Admin Flow — Incident Response
Alert Triggered
→ Severity Assigned
→ Runbook Opened
→ Mitigation Executed
→ Status Updates
→ Resolution
→ Postmortem
14. Public Portfolio Visitor Flow
Objective

Maximize recruiter conversion.

Visitor Opens Public URL
→ Reads Summary
→ Views Projects
→ Views Skills
→ CTA: Contact / Download Resume
→ Analytics Event Captured
Metrics
Bounce rate
Time on page
CTA click rate
15. Upgrade / Billing Flow
Student Paid Upgrade
Hit Free Limit
→ Compare Plans
→ Select Monthly / Annual
→ Checkout
→ Payment Success
→ Features Enabled
Institutional Sales Flow
Demo Request
→ Sales Qualification
→ Pilot Proposal
→ Contract
→ Tenant Provisioning
16. Notification Flows
Student Notifications
Import complete
Analysis ready
Recruiter interest
Recommendation available
Subscription renewal
Admin Notifications
Security alerts
Queue backlog
Billing failures
Tenant onboarding issues
17. Cross-Flow Decision Points
Decision	Options
Visibility	Public / Unlisted / Private
AI Tone	Professional / Technical / Leadership
Publish Timing	Draft / Publish now
Contact Sharing	Auto-approved / Consent request
18. Funnel Measurement Plan
Student Funnel
Visitor
→ Signup
→ GitHub Connect
→ Import
→ Generate Draft
→ Publish
→ Return User
→ Paid User
Recruiter Funnel
Signup
→ Search
→ Open Candidate
→ Shortlist
→ Contact
19. Edge Cases
Student
No GitHub repositories
Empty repositories
Private repos revoked
Low-confidence outputs
Payment failure
Recruiter
No results found
Contact denied
Search abuse detection
Institution
Bad CSV format
Duplicate users
Tenant branding misconfiguration
20. Accessibility Requirements

All flows must support:

Keyboard navigation
Screen reader labels
WCAG AA contrast
Mobile responsiveness
Clear error messaging
21. Assumptions

ASSUMPTION: Most students can connect GitHub immediately.
Alternative: Manual upload/import path required.

ASSUMPTION: Recruiters prefer search-first workflow.
Alternative: Curated talent recommendations feed.

22. Definition of Done

User flows complete when:

Core journeys mapped
Metrics attached to each funnel
Failure states covered
Accessibility reviewed
UX stakeholders approved