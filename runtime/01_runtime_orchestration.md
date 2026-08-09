MODE: BUILD
PROGRESS: Directives + Domain Model + State Model complete
PATH: Runtime orchestration → Failure handling → Execution plans → Environment → Tests
LOCKS: One file at a time

CURRENT STEP
Goal → Define runtime orchestration and async execution architecture.
Why → Your project is now heavily async-driven (imports, AI analysis, portfolio generation). Without a dedicated runtime orchestration file, workers, queues, retries, and event coordination become ambiguous and duplicated across architecture docs.
Expected Result → A deterministic runtime execution model for APIs, workers, queues, scheduling, retries, and orchestration.

---

# File 4

`runtime/01_runtime_orchestration.md`

````md id="3r8wkc"
# Repo2Reputation — Runtime Orchestration Model

# Purpose

Define the authoritative runtime execution architecture for Repo2Reputation.

This document specifies:

- request lifecycle behavior
- queue orchestration
- async execution
- worker coordination
- event-driven workflows
- scheduling
- retries
- concurrency controls
- runtime ownership boundaries

This file acts as the single source of truth for system runtime behavior.

---

# Runtime Architecture Principles

## MUST

The platform SHALL separate:

- request-response execution
- long-running workloads
- background orchestration
- scheduled processing

---

## MUST

Heavy workloads SHALL execute asynchronously.

---

## MUST NOT

CPU-intensive or network-intensive jobs SHALL block API threads.

---

# Runtime Topology

```text id="r3a4u5"
Frontend
    ↓
API Gateway / Backend API
    ↓
Runtime Event Layer
    ↓
Queues / Workers
    ↓
Persistence + AI + External APIs
````

---

# Runtime Components

| Component    | Responsibility             |
| ------------ | -------------------------- |
| Frontend     | User interaction           |
| Backend API  | Validation + orchestration |
| Queue Layer  | Async dispatch             |
| Workers      | Background execution       |
| Scheduler    | Timed execution            |
| Redis        | Queue broker               |
| PostgreSQL   | Persistent state           |
| GitHub API   | Repo ingestion             |
| AI Providers | Analysis/generation        |

---

# 1. Request-Response Runtime Model

## Purpose

Handle synchronous user-facing interactions.

---

## Allowed Operations

### MUST

API requests MAY perform:

* validation
* authorization
* lightweight reads
* orchestration dispatch
* transactional writes
* cache reads

---

## Forbidden Operations

### MUST NOT

API requests SHALL NOT perform:

* repository cloning
* AI generation
* heavy parsing
* long-running imports
* embedding generation
* batch exports

---

## Request Timeout Target

| Endpoint Type   | Target                     |
| --------------- | -------------------------- |
| auth            | <2s                        |
| dashboard reads | <2.5s                      |
| repo browsing   | <4s                        |
| imports         | async accepted immediately |

---

# 2. Async Queue Architecture

## Purpose

Handle deferred workloads safely and scalably.

---

# Queue Types

| Queue         | Purpose                   |
| ------------- | ------------------------- |
| repo-import   | repository ingestion      |
| repo-sync     | scheduled refresh         |
| ai-analysis   | classification/extraction |
| ai-generation | narratives                |
| notifications | outbound comms            |
| analytics     | event aggregation         |
| exports       | PDF/export generation     |
| search-index  | indexing                  |

---

# Queue Ownership Rules

## MUST

Each queue SHALL have:

* dedicated worker handlers
* retry policies
* dead-letter handling
* observability metrics

---

## MUST NOT

Workers SHALL NOT consume queues outside owned responsibilities.

---

# 3. Repository Import Runtime Flow

## Flow

```text id="gmn5y8"
User Action
→ API Validation
→ Import Job Created
→ Queue Dispatch
→ Worker Claims Job
→ GitHub Fetch
→ Metadata Extraction
→ Persistence
→ Completion Event
```

---

# Runtime Stages

| Stage              | Runtime Owner |
| ------------------ | ------------- |
| request validation | API           |
| job persistence    | API           |
| queue execution    | worker        |
| GitHub calls       | worker        |
| parsing            | worker        |
| persistence        | worker        |

---

# Import Runtime Rules

## MUST

Import jobs SHALL be idempotent.

---

## MUST

Concurrent imports for same repo/user SHALL serialize.

---

## MUST

GitHub rate limits SHALL trigger delayed retries.

---

# 4. AI Runtime Pipeline

## Runtime Flow

```text id="fckxmw"
Analysis Requested
→ Preprocessing
→ Feature Extraction
→ Classification
→ Skill Scoring
→ Evidence Mapping
→ Validation
→ Persistence
```

---

# AI Runtime Stages

| Stage         | Runtime |
| ------------- | ------- |
| preprocessing | worker  |
| extraction    | worker  |
| LLM calls     | worker  |
| validation    | worker  |
| persistence   | worker  |

---

# AI Runtime Rules

## MUST

LLM execution SHALL occur only in workers.

---

## MUST

AI pipelines SHALL checkpoint progress after each stage.

---

## MUST

All prompts SHALL include:

* prompt version
* model version
* trace IDs

---

# AI Runtime Constraints

## MUST NOT

AI providers SHALL NOT receive:

* secrets
* tokens
* sensitive credentials
* unsupported private data

---

# 5. Event-Driven Runtime Model

# Event Categories

| Category            | Purpose            |
| ------------------- | ------------------ |
| domain events       | business lifecycle |
| workflow events     | orchestration      |
| audit events        | compliance         |
| analytics events    | metrics            |
| notification events | messaging          |

---

# Core Runtime Events

| Event                       | Trigger         |
| --------------------------- | --------------- |
| repo.import.requested       | import API      |
| repo.import.completed       | import worker   |
| ai.analysis.requested       | post-import     |
| ai.analysis.completed       | analysis worker |
| portfolio.publish.requested | user action     |
| notification.send.requested | async messaging |

---

# Event Rules

## MUST

Events SHALL be immutable.

---

## MUST

Events SHALL contain:

* timestamp
* actor
* trace_id
* correlation_id
* payload version

---

# 6. Scheduler Runtime Model

## Purpose

Handle recurring background workflows.

---

# Scheduled Workloads

| Job                    | Frequency |
| ---------------------- | --------- |
| repo refresh           | periodic  |
| analytics rollups      | hourly    |
| stale session cleanup  | hourly    |
| search reindex         | scheduled |
| billing reconciliation | daily     |
| backup verification    | daily     |

---

# Scheduler Rules

## MUST

Schedulers SHALL enqueue jobs rather than execute heavy work directly.

---

# 7. Worker Runtime Model

# Worker Types

| Worker              | Responsibility    |
| ------------------- | ----------------- |
| import-worker       | GitHub ingestion  |
| analysis-worker     | AI classification |
| generation-worker   | narratives        |
| notification-worker | emails            |
| export-worker       | PDFs              |
| analytics-worker    | aggregations      |

---

# Worker Ownership Rules

## MUST

Workers SHALL:

* own queue consumption
* update state atomically
* emit lifecycle events
* support retries

---

## MUST NOT

Workers SHALL directly call frontend systems.

---

# Worker Isolation Rules

## MUST

Workers SHALL run separately from:

* frontend containers
* API containers

---

# 8. Retry Runtime Model

# Retry Categories

| Failure Type       | Retry? |
| ------------------ | ------ |
| GitHub timeout     | yes    |
| rate limit         | yes    |
| malformed repo     | no     |
| auth revoked       | no     |
| AI timeout         | yes    |
| transient DB issue | yes    |

---

# Retry Strategy

## MUST

Retries SHALL use:

* exponential backoff
* capped attempts
* jitter

---

# Dead Letter Rules

## MUST

Exceeded retries SHALL transition to:

```text id="dr0g2z"
dead_letter
```

---

# 9. Runtime Concurrency Rules

## MUST

The system SHALL prevent:

* duplicate imports
* double publication
* concurrent destructive writes

---

# Concurrency Mechanisms

| Use Case              | Strategy           |
| --------------------- | ------------------ |
| repo imports          | distributed lock   |
| publish actions       | optimistic locking |
| queue claims          | atomic reservation |
| analytics aggregation | batching           |

---

# 10. Runtime Observability

# Runtime Metrics

## MUST Emit

| Metric                | Purpose          |
| --------------------- | ---------------- |
| queue_depth           | worker pressure  |
| job_duration          | latency          |
| retry_count           | instability      |
| failure_rate          | reliability      |
| import_success_rate   | ingestion health |
| ai_generation_latency | AI performance   |

---

# Runtime Tracing

## MUST

Distributed tracing SHALL propagate across:

* frontend
* backend
* workers
* AI providers
* database calls

---

# 11. Runtime Failure Isolation

## MUST

Failure in one queue SHALL NOT:

* crash unrelated queues
* block API availability
* corrupt persistent state

---

# Isolation Examples

| Failure              | Isolation Behavior    |
| -------------------- | --------------------- |
| AI outage            | imports continue      |
| GitHub outage        | auth unaffected       |
| notification failure | portfolios unaffected |

---

# 12. Runtime Scaling Model

# Initial Deployment Strategy

```text id="u8ev3m"
Docker containers on Hetzner infrastructure
```

---

# Scaling Priorities

| Component      | Scaling Trigger       |
| -------------- | --------------------- |
| API            | CPU/latency           |
| import workers | queue depth           |
| AI workers     | generation backlog    |
| DB             | connection saturation |

---

# Scaling Rules

## MUST

Worker scaling SHALL remain independent from API scaling.

---

# 13. Runtime Security Rules

## MUST

Workers SHALL use:

* scoped credentials
* environment secrets
* minimal permissions

---

## MUST NOT

Queue payloads SHALL contain:

* plaintext secrets
* raw credentials
* unnecessary sensitive data

---

# 14. Runtime Recovery Rules

## MUST

All workflows SHALL support:

* replay
* retry
* checkpoint resume

---

# Recovery Guarantees

| Failure          | Guarantee           |
| ---------------- | ------------------- |
| worker crash     | job resumable       |
| API restart      | queue preserved     |
| retry failure    | dead-letter capture |
| transient outage | eventual retry      |

---

# 15. Runtime Invariants

The following invariants SHALL always remain true:

1. API threads remain lightweight
2. Long-running jobs remain async
3. Queue ownership remains isolated
4. Retries remain bounded
5. Worker execution remains traceable
6. AI generation remains auditable
7. Imports remain idempotent
8. Queue failures remain isolated

---

# Runtime Definition of Done

A runtime workflow is production-ready only when:

* queue defined
* worker defined
* retries defined
* dead-letter handling defined
* metrics emitted
* tracing enabled
* concurrency controlled
* replay supported
* observability configured
* recovery validated

```
```
