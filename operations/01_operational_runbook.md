MODE: BUILD
PROGRESS: Repository structure standard complete
PATH: Operational governance → Final architecture convergence → Claude generation stabilization
LOCKS: One file at a time

CURRENT STEP
Goal → Define the canonical operational runbook and production operations architecture.
Why → You now have runtime orchestration, queues, AI pipelines, deployments, observability, and scaling rules. Claude still needs a dedicated operational source of truth for production management, incident handling, deployments, monitoring, and recovery workflows.
Expected Result → A deterministic operational playbook for production management and long-term ownership.

---

# File 17

`operations/01_operational_runbook.md`

````md id="4u7x2v"
# Repo2Reputation — Operational Runbook

# Purpose

Define the authoritative production operations,
deployment management,
incident response,
monitoring,
runtime governance,
and operational ownership model
for Repo2Reputation.

This document specifies:

- operational procedures
- deployment operations
- incident response
- monitoring strategy
- queue operations
- worker management
- production debugging
- rollback workflows
- backup operations
- scaling operations
- maintenance procedures

This file acts as the single source of truth for platform operations.

---

# Operational Principles

## MUST

Production operations SHALL prioritize:
1. availability
2. tenant safety
3. data integrity
4. observability
5. recoverability
6. auditability

---

## MUST NOT

Operational workflows SHALL:
- bypass security
- bypass audit logging
- ignore rollback readiness
- expose secrets

---

# Operational Topology

```text id="7m2v8x"
Frontend
Backend API
Workers
Redis
PostgreSQL
Monitoring
Reverse Proxy
AI Providers
GitHub API
````

---

# Core Operational Domains

| Domain        | Responsibility         |
| ------------- | ---------------------- |
| deployments   | release management     |
| runtime       | worker/API health      |
| queues        | async orchestration    |
| observability | logs/metrics/traces    |
| incidents     | operational response   |
| recovery      | backup/restore         |
| security      | operational protection |

---

# 1. Deployment Operations

# Deployment Strategy

## MUST

Deployments SHALL support:

* rollback
* health validation
* staged rollout
* observability verification

---

# Initial Production Strategy

```text id="2v4q7n"
Docker containers deployed on Hetzner infrastructure
```

---

# Deployment Workflow

```text id="9g1w5r"
CI Validation
→ Container Build
→ Staging Validation
→ Production Deploy
→ Health Verification
→ Observability Checks
```

---

# MUST

Production deployments SHALL require:

* green CI
* migration validation
* rollback path
* environment validation

---

# MUST NOT

Deployments SHALL proceed when:

* migrations fail
* health checks fail
* queue integrity compromised

---

# 2. Runtime Operations

# Runtime Components

| Component   | Runtime      |
| ----------- | ------------ |
| frontend    | container    |
| backend API | container    |
| workers     | container    |
| Redis       | queue broker |
| PostgreSQL  | persistence  |

---

# MUST

Operational visibility SHALL include:

* service uptime
* worker health
* queue depth
* API latency
* DB health

---

# Runtime Health Rules

## MUST

Every runtime service SHALL expose:

* health endpoint
* metrics endpoint
* structured logs

---

# MUST NOT

Unhealthy services SHALL remain silently degraded.

---

# 3. Queue Operations

# Managed Queues

| Queue         | Purpose    |
| ------------- | ---------- |
| repo-import   | ingestion  |
| ai-analysis   | inference  |
| ai-generation | narratives |
| notifications | outbound   |
| analytics     | telemetry  |

---

# Queue Monitoring Rules

## MUST

Queue operations SHALL monitor:

* queue depth
* retry rates
* dead-letter volume
* worker throughput

---

# MUST

Dead-letter queues SHALL:

* preserve payloads
* preserve traceability
* support replay workflows

---

# Queue Recovery Workflow

```text id="8x5m1p"
Failure
→ Retry Exhaustion
→ Dead Letter
→ Investigation
→ Replay/Fix
```

---

# 4. Worker Operations

# Worker Types

| Worker              | Responsibility   |
| ------------------- | ---------------- |
| import-worker       | GitHub ingestion |
| ai-worker           | inference        |
| notification-worker | messaging        |
| analytics-worker    | telemetry        |

---

# MUST

Workers SHALL:

* remain independently scalable
* support graceful restart
* support replay-safe execution

---

# MUST NOT

Worker crashes SHALL:

* corrupt queue state
* duplicate imports
* break tenant isolation

---

# Worker Recovery Rules

## MUST

Worker recovery SHALL support:

* restart
* replay
* retry continuation
* dead-letter inspection

---

# 5. Database Operations

# MUST

Database operations SHALL support:

* backups
* restore validation
* migration rollback
* connection monitoring

---

# DB Monitoring Targets

| Metric                | Purpose     |
| --------------------- | ----------- |
| connection saturation | load        |
| query latency         | performance |
| replication lag       | consistency |
| storage usage         | capacity    |

---

# MUST

Critical writes SHALL remain transactional.

---

# MUST NOT

Manual production DB edits SHALL occur without:

* auditability
* approval
* rollback consideration

---

# 6. Redis Operations

# MUST

Redis SHALL support:

* queue durability
* retry persistence
* worker coordination

---

# MUST NOT

Redis SHALL become:

* sole persistence layer
* irreplaceable source of truth

---

# Redis Monitoring

| Metric             | Purpose              |
| ------------------ | -------------------- |
| memory usage       | capacity             |
| queue latency      | orchestration health |
| persistence status | durability           |

---

# 7. Observability Operations

# MUST

The platform SHALL emit:

* structured logs
* metrics
* traces
* audit events

---

# MUST

Observability SHALL support:

* incident debugging
* performance analysis
* queue tracing
* AI workflow tracing

---

# Required Metrics

| Metric              | Purpose           |
| ------------------- | ----------------- |
| API latency         | performance       |
| queue depth         | runtime pressure  |
| retry counts        | instability       |
| AI latency          | provider health   |
| import success rate | ingestion quality |

---

# MUST NOT

Operational debugging SHALL depend on:

* manual guesswork
* unstructured logs
* missing trace IDs

---

# 8. Incident Response Operations

# Severity Levels

| Severity | Meaning                  |
| -------- | ------------------------ |
| Sev1     | critical outage/security |
| Sev2     | major degradation        |
| Sev3     | partial issue            |
| Sev4     | informational            |

---

# Sev1 Workflow

```text id="5m8r2q"
Incident Detection
→ Incident Channel
→ Incident Commander
→ Mitigation
→ Recovery
→ RCA
```

---

# MUST

Sev1 incidents SHALL:

* generate immediate alerts
* freeze risky deployments
* preserve forensic evidence

---

# MUST NOT

Critical incidents SHALL:

* proceed undocumented
* bypass audit trails

---

# 9. Security Operations

# MUST

Operational security SHALL include:

* secret rotation
* MFA for admins
* audit logging
* access reviews

---

# MUST NOT

Production secrets SHALL:

* exist in Git
* appear in logs
* appear in screenshots

---

# Security Incident Rules

## MUST

Security incidents SHALL:

* revoke risky sessions
* preserve evidence
* trigger escalation

---

# 10. AI Operations

# MUST

AI operations SHALL monitor:

* token usage
* provider latency
* hallucination rates
* validation failures

---

# MUST

AI generation SHALL support:

* retries
* provider fallback
* model switching

---

# MUST NOT

AI failures SHALL:

* block portfolio viewing
* corrupt repository data

---

# 11. GitHub Integration Operations

# MUST

GitHub integration monitoring SHALL include:

* OAuth failures
* rate-limit pressure
* sync failures
* import latency

---

# MUST

OAuth revocation SHALL trigger:

* reconnect flow
* token invalidation
* user notification

---

# 12. Backup & Recovery Operations

# Backup Requirements

| Asset           | Frequency           |
| --------------- | ------------------- |
| PostgreSQL      | daily + incremental |
| Redis           | scheduled           |
| object metadata | scheduled           |

---

# MUST

Restore validation SHALL occur regularly.

---

# Restore Workflow

```text id="7n5k3u"
Backup Selection
→ Isolated Restore
→ Validation
→ Production Recovery
```

---

# MUST NOT

Unvalidated restores SHALL enter production directly.

---

# 13. Scaling Operations

# Scaling Priorities

| Component  | Scaling Trigger    |
| ---------- | ------------------ |
| API        | latency            |
| workers    | queue depth        |
| DB         | saturation         |
| AI workers | generation backlog |

---

# MUST

Worker scaling SHALL remain independent from API scaling.

---

# MUST NOT

Scaling SHALL occur blindly without:

* metrics
* bottleneck analysis
* observability evidence

---

# 14. Maintenance Operations

# Maintenance Categories

| Type               | Example          |
| ------------------ | ---------------- |
| dependency updates | libraries        |
| runtime upgrades   | Node versions    |
| AI model updates   | provider changes |
| migration cleanup  | DB hygiene       |

---

# MUST

Maintenance SHALL:

* remain versioned
* remain test-validated
* support rollback

---

# 15. Operational Access Control

# MUST

Production access SHALL remain:

* role-scoped
* auditable
* MFA-protected

---

# MUST NOT

Shared admin accounts SHALL exist.

---

# 16. Production Debugging Workflow

# Debugging Flow

```text id="4w8g2n"
Alert
→ Trace Investigation
→ Queue Inspection
→ Log Correlation
→ Mitigation
→ Recovery
```

---

# MUST

Production debugging SHALL:

* preserve auditability
* preserve tenant safety
* avoid destructive intervention

---

# 17. Cost Operations

# MUST

Operational monitoring SHALL include:

* AI spend
* infrastructure utilization
* queue efficiency
* storage growth

---

# MUST

AI workloads SHALL support:

* concurrency limits
* fallback providers
* spend controls

---

# 18. Operational Governance

# MUST

Critical operational changes SHALL require:

* review
* auditability
* rollback planning

---

# MUST NOT

Production hotfixes SHALL bypass:

* traceability
* validation
* recovery planning

---

# 19. Operational Invariants

The following SHALL always remain true:

1. No deployment without rollback path
2. No hidden runtime failures
3. No unobservable queue systems
4. No production secret leakage
5. No unaudited privileged operations
6. No worker replay corruption
7. No unsafe restore workflows
8. No scaling without telemetry

---

# 20. Definition of Operational Readiness

An operational subsystem is considered production-ready only when:

* monitoring enabled
* alerts configured
* rollback validated
* backups operational
* recovery tested
* observability active
* queue tracing enabled
* auditability enforced
* scaling metrics available
* incident workflows documented

```
```
