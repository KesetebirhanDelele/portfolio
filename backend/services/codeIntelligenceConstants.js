'use strict';

// Shared between codeIntelligence.js (JS/TS detection) and
// codeIntelligencePython.js (Python detection) — extracted here rather than
// having either require() the other, which would form a circular dependency.

// ── Confidence levels ─────────────────────────────────────────────────────────
// Represent certainty of detection, ordered highest → lowest.
// Config match is strongest evidence (explicit declaration in a config file).
// Path-only is weakest (heuristic based on directory / filename alone).

const CONFIDENCE = {
  CONFIG:  0.95,  // exact config filename / file extension match
  IMPORT:  0.80,  // import or require() statement found in source
  CONTENT: 0.70,  // usage pattern found in file body (not an import line)
  PATH:    0.60,  // directory segment or filename heuristic only
};

// ── Domain labels ─────────────────────────────────────────────────────────────
// Top-level architectural capability buckets.
// A single file can belong to multiple domains.

const DOMAINS = {
  AUTHENTICATION: 'authentication',
  API_LAYER:      'api_layer',
  DATABASE:       'database',
  AI_TOOLING:     'ai_tooling',
  FRONTEND:       'frontend',
  INFRASTRUCTURE: 'infrastructure',
};

module.exports = { CONFIDENCE, DOMAINS };
