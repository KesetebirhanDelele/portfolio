Purpose

Capture unresolved product, technical, commercial, compliance, and delivery questions that require stakeholder decisions before full-scale implementation of Repo2Reputation.

1. Decision Management Rules
Must
Each open question must have an owner.
Each question must have a target decision date.
Blocking questions must be resolved before dependent phase starts.
Decisions must be recorded in ADRs or product notes.
Expired unresolved blockers trigger escalation.
2. Critical Blocking Questions
ID	Question	Why It Matters	Owner	Needed By
Q-001	Which cloud provider is primary: AWS, Azure, or GCP?	Impacts architecture, IAM, CI/CD, cost model	CTO	Phase 1
Q-002	Which LLM provider(s) are approved for production?	Impacts AI architecture, privacy, pricing	CTO / Product	Phase 3
Q-003	Is full source code storage allowed or metadata-only ingestion preferred?	Major privacy + storage decision	Security / Legal	Phase 2
Q-004	What is the primary launch market: direct-to-student or institutional B2B?	Determines roadmap priority	Founder / GTM	Phase 2
Q-005	What legal terms govern use of private repositories?	Consent and liability exposure	Legal	Phase 2
3. Product Strategy Questions
ID	Question	Options	Recommended Default
Q-101	Initial target user segment?	Students / Bootcamps / Universities	Students + pilot universities
Q-102	Free tier scope?	No free tier / Limited / Full trial	Limited free tier
Q-103	Public portfolio discoverability default?	Opt-in / Opt-out	Opt-in
Q-104	Should recruiter accounts be gated?	Open signup / Approval / Paid only	Approval
Q-105	White-label institutional branding at launch?	Yes / No	Yes for enterprise tier
4. AI & Intelligence Questions
ID	Question	Why It Matters
Q-201	Which model handles classification vs generation?	Cost + performance
Q-202	Human review queue required at launch?	Trust + staffing
Q-203	Can user feedback retrain models?	Data rights + roadmap
Q-204	How are hallucination audits sampled?	Quality governance
Q-205	Should AI outputs cite evidence in UI?	Trust + UX
Recommended Defaults
Small/cheap models for extraction tasks
Premium model only for final narratives
Human review for low-confidence outputs only
Evidence viewer enabled
5. Data Model Questions
ID	Question	Why It Matters
Q-301	Single PostgreSQL vs polyglot persistence?	Complexity vs scale
Q-302	Shared tenant DB vs isolated schemas?	Security vs cost
Q-303	Event warehouse needed at MVP?	Analytics maturity
Q-304	Full portfolio version history retention period?	Storage + compliance
Recommended Defaults
PostgreSQL primary
Shared DB with row-level tenant isolation
Lightweight event pipeline initially
12-month version retention
6. Security & Compliance Questions
ID	Question	Why It Matters
Q-401	SOC 2 required before enterprise sales?	Sales readiness
Q-402	FERPA required for university deals?	Education compliance
Q-403	Regional data residency required?	Infra footprint
Q-404	MFA mandatory for all users or admins only?	UX vs security
Q-405	Private repo scanning boundaries?	Legal + trust
Recommended Defaults
MFA for admins only initially
SOC 2 roadmap started immediately
FERPA positioning for higher-ed deals
7. Commercial Questions
ID	Question	Why It Matters
Q-501	Pricing model?	Revenue forecast
Q-502	Institutional pricing metric?	Seat / Cohort / Usage
Q-503	Recruiter monetization path?	Marketplace revenue
Q-504	Data insights product allowed?	Privacy + monetization
Q-505	Refund policy for subscriptions?	Support ops
Recommended Defaults
Student monthly SaaS
Institution annual contract
Recruiter premium access later
8. Delivery Questions
ID	Question	Why It Matters
Q-601	In-house build vs outsourced components?	Speed + quality
Q-602	Team size for first 6 months?	Delivery realism
Q-603	MVP launch deadline fixed?	Scope control
Q-604	Design resources available?	UX quality
Q-605	Dedicated QA or engineer-owned QA?	Release risk
9. Go-To-Market Questions
ID	Question	Why It Matters
Q-701	First acquisition channel?	CAC efficiency
Q-702	University partnerships ready?	B2B traction
Q-703	Pilot success metric?	Expansion decision
Q-704	Need case studies before scale?	Sales enablement
10. Metrics Questions
ID	Question	Why It Matters
Q-801	Primary North Star metric?	Org alignment
Q-802	Success defined by placement lift or portfolio adoption?	Strategy
Q-803	Attribution method for hires/interviews?	ROI proof
Recommended North Star Options
Interview requests per active student
Published portfolios per active student
Placement rate uplift in partner cohorts
11. Risks If Unresolved
Area	Risk
Cloud undecided	Delayed infrastructure work
LLM undecided	Rework AI layer
GTM unclear	Wrong roadmap priority
Privacy unresolved	Legal exposure
Pricing unclear	Weak monetization launch
12. Required Immediate Decisions (Next 14 Days)
Primary customer segment
Cloud provider
LLM provider shortlist
Data handling policy for private repos
MVP scope boundaries
Pricing hypothesis
Pilot customer targets
13. Governance Workflow
Weekly Review
Open questions aging >14 days
New blockers
Owner accountability
Decision deadlines
Escalation

Any blocker delaying critical path by >7 days escalates to executive sponsor.

14. Assumptions

ASSUMPTION: Founder can make rapid early-stage decisions.
Alternative: Formal steering committee required.

ASSUMPTION: MVP can proceed while some enterprise questions remain open.
Alternative: Resolve compliance path before coding.

15. Definition of Done

Open questions file is complete when:

All blockers listed
Owners assigned
Dates assigned
Weekly review cadence active
Closed items migrated to ADRs