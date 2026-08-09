MODE: BUILD
PROGRESS: Core operational architecture complete
PATH: Data lifecycle → Evolution strategy → Test scenarios → Execution plans → UX model
LOCKS: One file at a time

CURRENT STEP
Goal → Define the canonical data lifecycle and governance architecture.
Why → Your system handles GitHub metadata, private repositories, AI-generated outputs, tenant-scoped data, audit logs, and user portfolios. Without lifecycle governance, retention, deletion, privacy, and compliance rules become inconsistent across domains.
Expected Result → A deterministic governance model covering creation, mutation, retention, archival, deletion, auditability, and privacy boundaries.

---

# File 7

`data/01_data_lifecycle_governance.md`

````md id="7u2mck"
# Repo2Reputation — Data Lifecycle & Governance Model

# Purpose

Define the authoritative data lifecycle, governance, retention,
privacy, archival, deletion, ownership, and auditability rules
for Repo2Reputation.

This document specifies:

- data ownership
- lifecycle stages
- retention policies
- archival behavior
- deletion workflows
- privacy enforcement
- AI data handling
- audit requirements
- tenant boundaries
- compliance-ready governance

This file acts as the single source of truth for platform data governance.

---

# Governance Principles

## MUST

All persistent data SHALL:
- have an owner
- have a lifecycle
- define retention behavior
- define deletion behavior
- define auditability requirements

---

## MUST

User privacy SHALL take precedence over:
- analytics convenience
- AI persistence
- operational shortcuts

---

## MUST NOT

The platform SHALL NOT:
- retain unnecessary sensitive data
- persist raw secrets
- expose tenant data across boundaries
- publish AI outputs automatically

---

# Data Lifecycle Stages

| Stage | Meaning |
|---|---|
| created | initial persistence |
| active | operational use |
| stale | low-access aging |
| archived | retained but inactive |
| deleted | logically removed |
| purged | irreversibly destroyed |

---

# Data Ownership Model

# Ownership Rules

## MUST

Every mutable entity SHALL define:
- owner
- domain
- tenant scope
- retention rules

---

# Ownership Matrix

| Entity | Owner |
|---|---|
| User | Identity Domain |
| Repository | Repository Domain |
| Analysis | AI Domain |
| Portfolio | Portfolio Domain |
| Subscription | Billing Domain |
| AuditLog | Audit Domain |
| WorkflowJob | Workflow Domain |

---

# 1. User Data Governance

# User Data Categories

| Category | Examples |
|---|---|
| identity | email, profile |
| auth | password hash |
| oauth | GitHub linkage |
| analytics | usage events |
| portfolio | generated content |

---

# Identity Rules

## MUST

User emails SHALL:
- remain unique
- remain case-insensitive
- support verification

---

## MUST NOT

Passwords SHALL:
- exist in plaintext
- appear in logs
- be reversible

---

# Soft Deletion Rules

## MUST

User deletion SHALL initially:
```text id="v24v4g"
soft delete
````

before purge eligibility.

---

# User Purge Rules

## MUST

Full purge SHALL:

* remove personal identifiers
* revoke sessions
* invalidate tokens
* anonymize analytics where possible

---

# Retention Targets

| Data            | Retention    |
| --------------- | ------------ |
| active user     | indefinite   |
| deleted account | configurable |
| auth sessions   | short-lived  |
| audit logs      | long-term    |

---

# 2. Repository Data Governance

# Repository Categories

| Category         | Example             |
| ---------------- | ------------------- |
| metadata         | stars, language     |
| README           | markdown content    |
| manifests        | package.json        |
| dependency graph | extracted packages  |
| file tree        | structural metadata |

---

# Repository Storage Rules

## MUST

The platform SHALL support:

* public repositories
* private repositories

---

## MUST

Private repositories SHALL require:

* explicit OAuth consent
* revocable authorization

---

# Metadata-First Storage Rules

## MUST

Persistent storage SHALL prioritize:

* metadata
* manifests
* README
* structural signals
* dependency data

---

## MUST NOT

Full source code SHALL persist by default.

---

# Sensitive Data Rules

## MUST

Detected secrets SHALL:

* be excluded from persistence
* be excluded from prompts
* be excluded from logs

---

# Repository Retention Rules

| Repository State | Behavior  |
| ---------------- | --------- |
| imported         | active    |
| disconnected     | stale     |
| deleted by user  | archived  |
| purge requested  | destroyed |

---

# 3. AI Data Governance

# AI Data Categories

| Category          | Example             |
| ----------------- | ------------------- |
| prompts           | generation requests |
| outputs           | narratives          |
| embeddings        | semantic vectors    |
| evidence refs     | supporting claims   |
| confidence scores | AI quality          |

---

# AI Governance Rules

## MUST

AI outputs SHALL:

* remain editable
* remain reviewable
* remain attributable to evidence

---

## MUST NOT

AI systems SHALL:

* fabricate achievements
* infer protected attributes
* train on private data without consent

---

# Prompt Governance

## MUST

Prompts SHALL include:

* version IDs
* timestamps
* model identifiers

---

# AI Retention Rules

| Asset                   | Retention    |
| ----------------------- | ------------ |
| generated drafts        | retained     |
| failed generations      | short-term   |
| embeddings              | configurable |
| temporary preprocessing | ephemeral    |

---

# AI Purge Rules

## MUST

AI-derived content SHALL be removable when:

* repository disconnected
* user deleted
* consent withdrawn

---

# 4. Portfolio Governance

# Portfolio States

| State    | Meaning     |
| -------- | ----------- |
| private  | owner only  |
| unlisted | link-access |
| public   | indexed     |

---

# Publishing Rules

## MUST

Publishing SHALL require:

* explicit user action
* validation success
* consent confirmation

---

# MUST NOT

Private repository source code SHALL:

* appear publicly
* appear in recruiter search

---

# Portfolio Versioning Rules

## MUST

Published portfolios SHALL support:

* version history
* rollback
* change tracking

---

# Portfolio Retention Rules

| State    | Retention         |
| -------- | ----------------- |
| active   | indefinite        |
| archived | long-term         |
| deleted  | grace period      |
| purged   | permanent removal |

---

# 5. Tenant Data Governance

# Tenant Isolation Rules

## MUST

Tenant-scoped records SHALL include:

```text id="ccn75l"
tenant_id
```

---

## MUST

Tenant boundaries SHALL apply to:

* repositories
* analytics
* search
* exports
* recruiter visibility

---

## MUST NOT

Cross-tenant visibility SHALL occur by default.

---

# Tenant Deletion Rules

## MUST

Tenant removal SHALL:

* preserve audit obligations
* archive billing history
* revoke memberships

---

# 6. Audit Governance

# Audit Requirements

## MUST

Critical actions SHALL generate audit logs.

---

# Audited Actions

| Action          | Audited |
| --------------- | ------- |
| admin changes   | yes     |
| publish actions | yes     |
| role changes    | yes     |
| OAuth linkage   | yes     |
| billing changes | yes     |

---

# Audit Retention Rules

## MUST

Audit logs SHALL remain immutable.

---

## SHOULD

Audit logs SHOULD retain:

```text id="6y59e6"
minimum 12 months
```

or longer for enterprise environments.

---

# 7. Analytics Governance

# Analytics Rules

## MUST

Analytics SHALL:

* minimize PII
* support anonymization
* remain append-only

---

# MUST NOT

Analytics SHALL:

* expose secrets
* expose repository contents unnecessarily

---

# Event Retention Rules

| Event Type          | Retention            |
| ------------------- | -------------------- |
| product analytics   | configurable         |
| security events     | extended             |
| operational metrics | summarized long-term |

---

# 8. Notification Data Governance

# Notification Rules

## MUST

Notifications SHALL:

* avoid secrets
* avoid private repository content
* support opt-out preferences

---

# Notification Retention

| Data                 | Retention   |
| -------------------- | ----------- |
| delivery metadata    | medium-term |
| failed notifications | short-term  |
| templates            | versioned   |

---

# 9. Search Index Governance

# Search Rules

## MUST

Search indexes SHALL:

* honor visibility settings
* honor tenant scope
* support deletion propagation

---

# MUST NOT

Deleted/private portfolios SHALL remain searchable.

---

# Search Deletion Rules

## MUST

Search index deletion SHALL occur:

```text id="1qv8ut"
eventually consistent
```

within operational SLA.

---

# 10. Backup Governance

# Backup Rules

## MUST

Backups SHALL:

* encrypt data
* support point-in-time recovery
* support restore validation

---

# MUST

Backup access SHALL remain restricted.

---

# Backup Retention

| Asset               | Retention |
| ------------------- | --------- |
| DB snapshots        | scheduled |
| incremental backups | rolling   |
| object metadata     | scheduled |

---

# 11. Data Export & User Rights

# Supported Rights

## MUST

Users SHALL support:

* export requests
* deletion requests
* consent withdrawal
* profile correction

---

# Export Rules

## MUST

Exports SHALL:

* remain authenticated
* respect tenant boundaries
* exclude secrets

---

# Deletion SLA Targets

| Request        | SLA                |
| -------------- | ------------------ |
| export         | <= 7 days          |
| deletion       | <= 30 days         |
| consent change | immediate or <=24h |

---

# 12. Compliance Governance

# Governance Targets

| Area             | Target         |
| ---------------- | -------------- |
| privacy          | consent-driven |
| auditability     | enforced       |
| tenant isolation | mandatory      |
| AI safety        | evidence-based |

---

# MUST

Future enterprise readiness SHALL support:

* SOC 2 preparation
* FERPA alignment
* GDPR-aligned deletion/export concepts

---

# 13. Data Mutation Rules

## MUST

Critical writes SHALL:

* use transactions
* support rollback
* preserve consistency

---

## MUST NOT

Partial updates SHALL corrupt:

* tenant boundaries
* AI evidence
* portfolio publication state

---

# 14. Data Archival Rules

# Archival Targets

| Data                | Archival Behavior |
| ------------------- | ----------------- |
| inactive portfolios | archive eligible  |
| stale imports       | archive eligible  |
| old analytics       | summarized        |
| old notifications   | removable         |

---

# MUST

Archived data SHALL remain:

* recoverable
* traceable
* access-controlled

---

# 15. Purge Rules

## MUST

Purged data SHALL become:

```text id="dz9kkt"
irrecoverable
```

except where legal retention required.

---

# Purge Triggers

| Trigger            | Example                |
| ------------------ | ---------------------- |
| deletion request   | GDPR-like removal      |
| tenant termination | enterprise offboarding |
| retention expiry   | lifecycle expiration   |

---

# 16. Governance Invariants

The following SHALL always remain true:

1. No plaintext credentials stored
2. No cross-tenant data leakage
3. No AI-generated content without traceability
4. No published content without user approval
5. No private repository exposure publicly
6. No secret persistence in prompts/logs
7. No audit-log mutation
8. No orphaned ownership records

---

# 17. Definition of Governance Readiness

A subsystem is governance-ready only when:

* ownership defined
* lifecycle defined
* retention defined
* deletion defined
* auditability defined
* tenant scope defined
* privacy boundaries enforced
* export behavior defined
* purge behavior defined
* compliance implications documented

```
```
