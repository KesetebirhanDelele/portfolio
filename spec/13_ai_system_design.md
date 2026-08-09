Purpose

Define the production AI system architecture for Repo2Reputation including models, pipelines, prompts, evaluation, safety controls, cost governance, and operational boundaries.

1. AI System Objectives

The AI layer must convert repository signals into trustworthy employability assets by delivering:

Technology stack classification
Skill extraction
Project domain detection
Personalized narratives
Resume bullet generation
Portfolio optimization recommendations
Explainable evidence-backed outputs
2. Core AI Principles
Must
Evidence-ground outputs
Human-editable outputs
Measurable quality thresholds
Cost-aware inference routing
Privacy-preserving processing
Version-controlled prompts/models
Must-Not
Fabricate achievements
Infer protected characteristics
Publish content automatically
Train on private data without consent
3. AI Capability Map
Capability	Input	Output
Stack Classification	Repo metadata/files	Languages, frameworks
Skill Extraction	README, files, deps	Skills + confidence
Domain Classification	Repo semantics	Fintech, SaaS, ML, etc.
Narrative Generation	Analysis + profile	Summaries, bullets
Recommendation Engine	Engagement metrics	Improvement suggestions
Anomaly Detection	Usage patterns	Champions / outliers
4. Recommended Model Strategy
4.1 Multi-Model Architecture

Use different models for different tasks.

Task	Recommended Model Type
Language/framework detection	Rules + small classifier
Skill extraction	Embedding / lightweight LLM
Domain classification	Fine-tuned classifier
Final narratives	High-quality generative LLM
Ranking recommendations	Traditional ML
4.2 Routing Policy
Low-cost models:
- Extraction
- Classification
- Summaries draft

Premium models:
- Final public portfolio narratives
- Regeneration requests
- Enterprise white-label outputs
5. Input Signals
Repository Signals
Name
Description
README
Topics/tags
Language stats
Dependency manifests
File structure
Commit summaries
Test presence
Deployment configs
User Signals
Career target role
Preferred tone
Graduation year
Institution
Skills manually added
Engagement Signals
Portfolio views
Recruiter clicks
Section dwell time
CTA conversion
6. AI Pipeline Architecture
Repository Import
→ Preprocessing
→ Feature Extraction
→ Classification
→ Skill Scoring
→ Evidence Mapping
→ Narrative Generation
→ Validation Layer
→ User Editing
→ Publish
7. Preprocessing Layer
Responsibilities
Normalize text
Parse manifests (package.json, requirements.txt, pom.xml)
Extract README sections
Detect duplicate repositories
Remove binary noise
Chunk large inputs
Constraints
Respect token limits
Do not expose secrets found in repositories
8. Feature Extraction Logic
Examples
Signal	Inference
package.json includes react	React skill
requirements.txt includes django	Django skill
Dockerfile present	DevOps familiarity
CI config present	CI/CD exposure
Tests directory present	Testing practices
9. Prompt System Design
9.1 Prompt Layers
System prompt
Task template
User profile context
Repository evidence
Output schema instructions
9.2 Example Narrative Prompt Template
You are generating recruiter-facing portfolio copy.

Use only supported evidence.
Do not invent metrics or experience.
Tone: {tone}
Career Target: {role}

Repository Evidence:
{repo_summary}

Return JSON with:
summary
top_projects
resume_bullets
9.3 Prompt Governance
Must
Version all prompts
Track output quality by prompt version
Roll back poor-performing prompts quickly
10. Validation Layer

Generated outputs must pass validation before user display.

Checks
Unsupported claims
Duplicate phrases
Excessive generic wording
Toxic or biased content
Missing required fields
Formatting issues
Actions
Result	Action
Pass	Show to user
Minor issue	Auto-correct
Major issue	Retry
Unsafe	Block + alert
11. Confidence Scoring

Each major output must have confidence.

Example Components
Evidence density
Classification certainty
Repository completeness
Similarity to known patterns
Validation pass quality
Thresholds
Score	Meaning
>=0.85	High confidence
0.70–0.84	Medium
<0.70	Needs review
12. Evaluation Framework
Offline Benchmarks
Metric	Target
Stack precision	>= 90%
Skill evidence support	>= 97%
Narrative human score	>= 4.1 / 5
Unsupported claims	<= 3%
Online Metrics
Accept draft rate
Regeneration rate
Publish conversion
Recruiter engagement lift
User satisfaction
13. Recommendation Engine
Inputs
Portfolio analytics
Historical winners
User goals
Similar user cohorts
Outputs
Improve headline
Add stronger project first
Use concise tone
Add missing skill proof
14. AI Safety Controls
Must
Filter harmful outputs
Remove protected-attribute inferences
Prevent fabricated work history
Require user approval before publish
Sample audits weekly
Escalate If
Unsupported claims >3%
Toxic output incident
Repeated biased outputs
Provider policy breach
15. Privacy Controls
Must
Redact secrets accidentally found in repos
Avoid storing unnecessary raw source code
Tenant-separate prompts/context
Honor deletion requests in derived artifacts
16. Cost Management
Track
Cost per generation
Cost per active user
Cost by tenant
Token usage by feature
Retry waste
Optimization Tactics
Cache repeated analyses
Summarize before premium model calls
Use smaller models first
Batch low-priority jobs
17. Failure Handling
Failure	Response
Provider timeout	Retry / fallback provider
Invalid JSON output	Auto-repair / retry
Low confidence	Show warning
Cost threshold exceeded	Route to cheaper model
Queue overload	Prioritize active users
18. Model Operations (MLOps)
Required
Model registry
Prompt registry
Evaluation datasets
Canary rollouts
Drift monitoring
Rollback path
19. Future Enhancements
Interview question generation
Salary positioning insights
Personalized learning roadmap
Recruiter match scoring
Open-source contribution scoring
20. Assumptions

ASSUMPTION: Third-party LLM APIs remain economically viable.
Alternative: Self-host open-weight models.

ASSUMPTION: Users prefer AI first drafts over blank forms.
Alternative: Hybrid templates + optional AI.

21. Definition of Done

AI system design complete when:

Pipelines documented
Prompts versioned
Benchmarks established
Safety checks implemented
Cost dashboard live
Rollback tested