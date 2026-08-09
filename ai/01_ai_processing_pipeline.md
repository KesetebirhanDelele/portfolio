MODE: BUILD
PROGRESS: Testing architecture complete
PATH: Product evolution → AI governance → UX systems → Search/reputation architecture
LOCKS: One file at a time

CURRENT STEP
Goal → Define the canonical AI processing and intelligence architecture.
Why → Your original AI design was overlapping with system architecture. We now isolate AI into its own dedicated subsystem specification so Claude can generate AI pipelines consistently without duplicating platform concerns.
Expected Result → A deterministic AI processing architecture covering ingestion intelligence, scoring, embeddings, ranking, generation, evidence grounding, and model orchestration.

---

# File 9

`ai/01_ai_processing_pipeline.md`

````md id="1f4dyq"
# Repo2Reputation — AI Processing Pipeline

# Purpose

Define the authoritative AI subsystem architecture for Repo2Reputation.

This document specifies:

- AI workflow orchestration
- repository intelligence extraction
- embeddings
- scoring systems
- ranking systems
- narrative generation
- evidence grounding
- model routing
- AI safety
- evaluation orchestration
- inference lifecycle behavior

This file acts as the single source of truth for all AI subsystem behavior.

---

# AI System Objectives

The AI subsystem exists to:

1. analyze repositories
2. infer developer skills
3. generate evidence-backed narratives
4. rank technical strengths
5. build reputation signals
6. improve recruiter discoverability
7. reduce manual portfolio creation effort

---

# AI System Principles

## MUST

All meaningful AI outputs SHALL:
- remain evidence-backed
- remain explainable
- remain editable
- remain reviewable
- remain attributable

---

## MUST NOT

The AI subsystem SHALL NOT:
- fabricate achievements
- invent technologies
- infer protected characteristics
- auto-publish generated content
- expose private repository secrets

---

# AI Processing Topology

```text id="n9uvq0"
Repository Import
    ↓
Signal Extraction
    ↓
Feature Normalization
    ↓
Classification
    ↓
Skill Inference
    ↓
Evidence Mapping
    ↓
Scoring
    ↓
Narrative Generation
    ↓
Validation
    ↓
Portfolio Assembly
````

---

# 1. AI Pipeline Stages

| Stage           | Purpose               |
| --------------- | --------------------- |
| ingestion       | collect repo signals  |
| extraction      | derive features       |
| normalization   | standardize metadata  |
| classification  | identify technologies |
| inference       | infer skills          |
| ranking         | score confidence      |
| generation      | produce narratives    |
| validation      | hallucination checks  |
| publishing prep | portfolio formatting  |

---

# 2. Repository Signal Extraction

# Supported Signals

| Signal           | Example             |
| ---------------- | ------------------- |
| README           | project description |
| dependencies     | package.json        |
| repo metadata    | stars/forks         |
| file structure   | architecture clues  |
| CI configs       | deployment maturity |
| commit summaries | activity patterns   |
| topics           | ecosystem hints     |

---

# Extraction Rules

## MUST

Extraction SHALL prioritize:

* lightweight metadata
* structural indicators
* dependency manifests
* documented intent

---

## MUST NOT

The system SHALL persist:

* full repository source code by default
* detected secrets
* irrelevant binaries

---

# 3. Feature Normalization Pipeline

# Purpose

Convert heterogeneous repo data into standardized AI-ready signals.

---

# Normalized Categories

| Category   | Example        |
| ---------- | -------------- |
| frontend   | React          |
| backend    | Node.js        |
| infra      | Docker         |
| database   | PostgreSQL     |
| testing    | Jest           |
| deployment | GitHub Actions |

---

# MUST

Normalization SHALL:

* deduplicate technologies
* resolve aliases
* map ecosystem variants

---

# Example Alias Resolution

| Raw Signal | Canonical  |
| ---------- | ---------- |
| node       | Node.js    |
| pg         | PostgreSQL |
| ts         | TypeScript |

---

# 4. Technology Classification

# Purpose

Identify technologies, frameworks, patterns, and ecosystem usage.

---

# Classification Inputs

| Input        | Example            |
| ------------ | ------------------ |
| dependencies | package manifests  |
| README       | docs               |
| file names   | framework patterns |
| configs      | Docker/K8s         |

---

# Classification Outputs

| Output    | Example    |
| --------- | ---------- |
| framework | React      |
| language  | TypeScript |
| infra     | Docker     |
| testing   | Playwright |

---

# MUST

Classification SHALL produce:

* confidence score
* evidence references
* extraction source

---

# 5. Skill Inference Engine

# Purpose

Infer probable developer skills from repository evidence.

---

# Skill Categories

| Category | Example            |
| -------- | ------------------ |
| frontend | React architecture |
| backend  | REST APIs          |
| infra    | Docker             |
| AI       | embeddings         |
| testing  | E2E workflows      |

---

# Inference Inputs

| Signal              | Weight     |
| ------------------- | ---------- |
| dependency evidence | high       |
| README claims       | medium     |
| project structure   | medium     |
| deployment configs  | high       |
| commit patterns     | low-medium |

---

# MUST

Skills SHALL include:

* confidence score
* supporting evidence
* evidence origin

---

# MUST NOT

Skill inference SHALL:

* overstate expertise
* infer unsupported mastery
* fabricate experience duration

---

# 6. Repository Scoring Engine

# Purpose

Generate weighted technical reputation scores.

---

# Score Categories

| Category      | Purpose               |
| ------------- | --------------------- |
| complexity    | technical depth       |
| consistency   | repo quality          |
| activity      | maintenance signals   |
| documentation | communication quality |
| deployment    | operational maturity  |
| testing       | validation maturity   |

---

# Example Weighted Signals

| Signal             | Weight      |
| ------------------ | ----------- |
| tests present      | medium      |
| CI/CD configured   | medium      |
| Docker support     | medium      |
| README quality     | medium      |
| active maintenance | medium-high |

---

# Score Rules

## MUST

Scores SHALL remain:

* explainable
* reproducible
* versioned

---

## MUST

Score generation SHALL support:

* recalculation
* model evolution
* benchmark comparisons

---

# 7. Embedding Pipeline

# Purpose

Enable semantic search and recruiter discovery.

---

# Embedding Sources

| Source              | Included |
| ------------------- | -------- |
| README              | yes      |
| generated summaries | yes      |
| skills              | yes      |
| portfolio sections  | yes      |

---

# MUST

Embeddings SHALL:

* exclude secrets
* exclude raw credentials
* support deletion propagation

---

# Embedding Uses

| Use Case         | Purpose              |
| ---------------- | -------------------- |
| recruiter search | semantic matching    |
| recommendations  | related developers   |
| ranking          | contextual relevance |

---

# 8. Narrative Generation Pipeline

# Purpose

Generate recruiter-friendly summaries.

---

# Narrative Types

| Type              | Purpose               |
| ----------------- | --------------------- |
| project summary   | concise repo overview |
| skills narrative  | inferred strengths    |
| portfolio intro   | personal branding     |
| recruiter summary | technical highlights  |

---

# Narrative Rules

## MUST

Narratives SHALL:

* remain evidence-backed
* remain editable
* remain confidence-aware

---

## MUST NOT

Narratives SHALL:

* exaggerate achievements
* fabricate metrics
* imply employment claims

---

# 9. AI Validation Layer

# Purpose

Prevent unsafe or unsupported output.

---

# Validation Categories

| Category      | Purpose            |
| ------------- | ------------------ |
| grounding     | evidence-backed    |
| hallucination | unsupported claims |
| safety        | harmful output     |
| formatting    | schema validity    |

---

# Validation Rules

## MUST

Generated outputs SHALL fail validation when:

* unsupported technologies detected
* evidence missing
* confidence below threshold
* protected attributes inferred

---

# MUST

Unsafe outputs SHALL transition to:

```text id="lx5v0r"
needs_review
```

---

# 10. Confidence Scoring Model

# Confidence Thresholds

| Score     | Meaning           |
| --------- | ----------------- |
| >= 0.85   | high confidence   |
| 0.70–0.84 | medium confidence |
| < 0.70    | needs review      |

---

# Confidence Inputs

| Signal                     | Effect |
| -------------------------- | ------ |
| direct dependency evidence | strong |
| README-only mention        | weaker |
| structural match           | medium |
| deployment config          | strong |

---

# 11. Multi-Model Routing

# Purpose

Optimize:

* cost
* latency
* quality

---

# Routing Strategy

| Task                 | Model Tier    |
| -------------------- | ------------- |
| classification       | lightweight   |
| extraction           | lightweight   |
| ranking              | deterministic |
| narrative generation | premium       |
| validation           | deterministic |

---

# MUST

Model routing SHALL support:

* provider switching
* fallback routing
* timeout recovery

---

# 12. Prompt Governance

# MUST

All prompts SHALL include:

* prompt version
* model version
* timestamp
* trace IDs

---

# MUST

Prompt changes SHALL support:

* rollback
* evaluation comparison
* regression detection

---

# 13. AI Runtime Rules

# MUST

All AI execution SHALL occur asynchronously.

---

# MUST NOT

LLM execution SHALL block:

* API request threads
* frontend interactions

---

# AI Runtime Flow

```text id="7y1g2q"
Queue
→ Worker
→ AI Provider
→ Validation
→ Persistence
```

---

# 14. AI Evaluation Framework

# Evaluation Categories

| Category        | Purpose              |
| --------------- | -------------------- |
| grounding       | evidence correctness |
| consistency     | stable outputs       |
| formatting      | schema compliance    |
| hallucination   | unsupported claims   |
| ranking quality | meaningful scoring   |

---

# MUST

Prompt/model changes SHALL trigger:

* benchmark evaluation
* regression analysis
* comparison reports

---

# 15. Recruiter Intelligence Layer

# Purpose

Improve discoverability and matching.

---

# Recruiter Features

| Feature             | Purpose              |
| ------------------- | -------------------- |
| semantic search     | contextual discovery |
| skill ranking       | relevance            |
| portfolio summaries | quick evaluation     |

---

# MUST

Recruiter-visible insights SHALL:

* remain explainable
* remain evidence-backed
* remain confidence-aware

---

# 16. AI Safety Rules

# MUST NOT

AI SHALL:

* infer race
* infer gender
* infer disability
* infer religion
* infer political affiliation

---

# MUST

The system SHALL:

* block unsafe outputs
* preserve auditability
* support human review

---

# 17. AI Observability

# MUST

AI pipelines SHALL emit:

* latency metrics
* token usage
* confidence metrics
* validation failures
* retry counts

---

# MUST

AI traces SHALL remain correlated with:

* repository IDs
* workflow IDs
* user IDs
* prompt versions

---

# 18. AI Failure Handling

# MUST

AI outages SHALL:

* preserve imports
* delay generation gracefully
* support retries

---

# MUST NOT

AI failure SHALL:

* corrupt repository data
* block authentication
* break portfolio viewing

---

# 19. AI Governance Invariants

The following SHALL always remain true:

1. No unsupported recruiter-visible claims
2. No auto-published AI output
3. No secret leakage into prompts
4. No private repository exposure publicly
5. No confidence-free inference
6. No untraceable AI generation
7. No hallucination-prone publishing
8. No protected-attribute inference

---

# 20. Definition of AI Readiness

An AI subsystem is considered production-ready only when:

* extraction pipeline defined
* scoring logic versioned
* prompts versioned
* validation enforced
* confidence scoring operational
* evaluation datasets defined
* hallucination checks operational
* observability enabled
* retry behavior defined
* human review supported

```
```
