Purpose

Define the evaluation framework for Repo2Reputation covering product quality, AI accuracy, system performance, security posture, business outcomes, and release readiness.

1. Evaluation Principles

Repo2Reputation must be evaluated across six dimensions:

Functional Correctness
AI Quality & Safety
Performance & Reliability
Security & Compliance
User Experience & Adoption
Commercial Outcomes

No major release should proceed if any Critical metric fails threshold.

2. Evaluation Cadence
Frequency	Scope
Per Commit	Unit tests, linting, static checks
Daily	Integration tests, regression suite
Weekly	AI sample audits, performance review
Sprint End	UAT + KPI review
Monthly	Security review + SLA review
Quarterly	Architecture + business review
3. Functional Evaluation
3.1 Core Workflows

The following workflows must be tested end-to-end:

User signup/login
GitHub OAuth connection
Repository import
AI analysis completion
Narrative generation
Portfolio publish/unpublish
Recruiter search
CSV institutional onboarding
Data deletion request
Pass Threshold
100% pass rate for Critical flows

= 95% pass rate for Standard flows

Failure Trigger
Any Critical flow failing blocks release.
4. AI Evaluation Framework
4.1 Classification Accuracy

Measure technology stack and project domain labeling.

Metric	Target
Precision	>= 90%
Recall	>= 85%
F1 Score	>= 87%
4.2 Skill Extraction Quality

Measure whether inferred skills are supported by repository evidence.

Metric	Target
Evidence-supported claims	>= 97%
Unsupported claims	<= 3%
Duplicate skill noise	<= 5%
4.3 Narrative Generation Quality

Human raters score outputs from 1–5.

Dimension	Target
Accuracy	>= 4.2
Professionalism	>= 4.0
Relevance	>= 4.2
Readability	>= 4.3
Personalization	>= 4.0

Minimum composite score: 4.1

4.4 Safety Evaluation
Metric	Target
Harmful content rate	0%
Protected attribute inference	0%
Fabricated achievements	<= 1% audited sample
Policy filter miss rate	<= 0.5%
4.5 Latency Evaluation
Action	Target
Skill analysis	<= 8s p95
Narrative generation	<= 12s p95
Regeneration	<= 10s p95
5. Product Experience Evaluation
5.1 Onboarding Funnel
Step	Target
Signup completion	>= 80%
GitHub connection	>= 70%
First repo import	>= 60%
First portfolio publish	>= 40%
5.2 Satisfaction
Metric	Target
CSAT	>= 4.2 / 5
NPS	>= 30
Support response satisfaction	>= 4.0 / 5
5.3 Retention
Metric	Target
30-day student retention	>= 45%
90-day institutional retention	>= 85%
6. Performance & Reliability Evaluation
6.1 API Performance
Metric	Target
API latency	<= 500ms p95
Search latency	<= 1s p95
Dashboard load	<= 2.5s p95
6.2 Reliability
Metric	Target
Uptime	>= 99.9%
Failed jobs	<= 2%
Queue backlog >30 min	0 incidents/month
6.3 Disaster Recovery

Quarterly drills required.

Metric	Target
RTO	<= 4h
RPO	<= 1h
7. Security Evaluation
Mandatory Checks
Dependency vulnerability scan
Secrets scan
RBAC access tests
MFA enforcement tests
Audit log verification
Penetration test before enterprise launch
Thresholds
Metric	Target
Critical vulnerabilities open	0
High vulnerabilities open >30d	0
Unauthorized access success	0
8. Compliance Evaluation
Required Controls
GDPR deletion requests tested monthly
Data export requests tested monthly
Consent logging validated
Retention jobs verified quarterly
Cross-tenant access tests executed each release
9. Business Outcome Evaluation
Student Success Metrics
Metric	Target
Portfolio publish rate	>= 40%
Recruiter contact rate	Increasing trend QoQ
Interview conversion lift	Measured in pilot cohorts
Revenue Metrics
Metric	Target
Free to paid conversion	>= 5%
Institutional close rate	Defined by GTM plan
Gross margin	Positive trend
10. Experimentation Evaluation
A/B Testing Rules
Minimum sample size required before declaring winner.
Confidence threshold >= 95%.
Guardrail metrics must not regress:
Bounce rate
Complaint rate
Generation success rate
Example Tests
Headline variants
CTA wording
Narrative tone
Portfolio section order
11. Release Gates
Minor Release

Requires:

Regression suite pass
No Sev1 defects
Metrics stable
Major Release

Requires:

Full functional pass
AI quality audit pass
Performance targets met 7 consecutive days
Security signoff
Product signoff
Enterprise Release

Requires:

Pen test passed
DR drill passed
Tenant isolation validated
SLA readiness approved
12. Tooling Recommendations
Test Automation: Playwright / Cypress
API Testing: Postman / Newman
Load Testing: k6 / JMeter
Monitoring: Datadog / Grafana
AI Evaluation: Custom rubric + labeled benchmark sets
Error Tracking: Sentry
13. Assumptions

ASSUMPTION: Human review capacity exists for sampled AI audits.
Alternative: Automated scoring + smaller manual audits.

ASSUMPTION: Enough traffic exists for statistically valid A/B tests.
Alternative: Use qualitative testing until scale reached.

14. Escalation Triggers

Immediate review required if:

Hallucination rate > 3%
Uptime < 99.9%
CSAT < 4.0
Import success < 95%
Critical vulnerability detected
Conversion funnel drops >15% week-over-week
15. Definition of Done

Evaluation framework is complete when:

Metrics dashboards live
Benchmarks documented
Owners assigned per KPI
Alert thresholds configured
Release gates operationalized