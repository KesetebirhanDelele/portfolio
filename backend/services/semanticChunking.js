'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// semanticChunking.js
//
// Deterministic semantic chunking engine for the v2 deep-analysis pipeline.
// Implements Phase 4 (Semantic Chunking) of runDeepAnalysisPipeline.
//
// Transforms classified files (Phase 3 output) into retrieval-ready semantic
// chunks that represent coherent architectural systems. These chunks are the
// primary unit of context given to AI agents in Phase 5.
//
// Design constraints:
//   - Zero external dependencies (no require() of any npm package)
//   - No AI/LLM calls — pure deterministic grouping and relationship mapping
//   - All constants and lookup tables defined at module load
//   - Fault-tolerant — a bad group or file never crashes the phase
//   - Fully deterministic — same input always produces identical output
// ─────────────────────────────────────────────────────────────────────────────

// ── Chunk size limits ─────────────────────────────────────────────────────────
// Chunks exceeding MAX_TOKENS_PER_CHUNK are split to keep them within LLM
// context budgets for Phase 5 agents.
// Rule of thumb: 1 token ≈ 4 chars (GPT-family tokenizer convention).

const CHARS_PER_TOKEN    = 4;
const MAX_TOKENS_PER_CHUNK = 8_000;   // ≈ 32 KB of source code per chunk
const MAX_CHARS_PER_CHUNK  = MAX_TOKENS_PER_CHUNK * CHARS_PER_TOKEN;

// Maximum primary files highlighted per chunk (most important files first).
const MAX_PRIMARY_FILES  = 5;

// ── Human-readable labels ─────────────────────────────────────────────────────
// Used in deterministic chunk summaries.

const GROUP_LABELS = {
  api_surface:       'API routes and controllers',
  data_layer:        'Data models and database layer',
  auth_flow:         'Authentication and authorization',
  ui_components:     'UI components',
  ui_pages:          'Application pages',
  ai_pipeline:       'AI/ML integration',
  infra_config:      'Infrastructure configuration',
  app_configuration: 'Application configuration',
  test_suite:        'Test suite',
  application_core:  'Application core (services and entry points)',
  shared_utilities:  'Shared utilities and helpers',
  documentation:     'Documentation',
  state_management:  'State management',
  type_definitions:  'Type definitions',
};

const DOMAIN_LABELS = {
  backend:       'backend',
  frontend:      'frontend UI',
  database:      'database layer',
  infrastructure:'infrastructure',
  ai_system:     'AI/ML pipeline',
  auth_system:   'auth system',
  testing:       'test suite',
  documentation: 'documentation',
  configuration: 'configuration',
  shared:        'shared utilities',
};

// ── Role priority for sorting files within a chunk ────────────────────────────
// Lower value = higher priority (sorted ascending).
// Most important roles surface as primaryFiles.

const ROLE_PRIORITY = {
  entry_point:   1,
  service:       2,
  route_handler: 3,
  middleware:    4,
  model:         5,
  schema:        6,
  migration:     7,
  component:     8,
  page:          9,
  hook:          10,
  utility:       11,
  type:          12,
  config:        13,
  workflow:      14,
  container:     15,
  iac:           16,
  seed:          17,
  test:          18,
  documentation: 19,
  unknown:       99,
};

// ── Chunk relationship rules ──────────────────────────────────────────────────
// Precompiled directed relationships between semantic groups.
// 'from' chunk depends on / interacts with 'to' chunk.
//
// These are architectural facts, not inferred — every real-world project where
// both groups exist has these relationships by definition.

const RELATIONSHIP_RULES = [
  // API surface is protected by auth and delegates to core + data
  { from: 'api_surface',       to: 'auth_flow',          type: 'protected_by'   },
  { from: 'api_surface',       to: 'data_layer',         type: 'reads_from'     },
  { from: 'api_surface',       to: 'application_core',   type: 'delegates_to'   },
  // Frontend calls the API and composes from components
  { from: 'ui_pages',          to: 'api_surface',        type: 'calls'          },
  { from: 'ui_pages',          to: 'ui_components',      type: 'uses'           },
  { from: 'ui_components',     to: 'api_surface',        type: 'calls'          },
  { from: 'ui_components',     to: 'state_management',   type: 'uses'           },
  { from: 'state_management',  to: 'api_surface',        type: 'calls'          },
  // Application core uses data and is configured by config
  { from: 'application_core',  to: 'data_layer',         type: 'uses'           },
  { from: 'application_core',  to: 'app_configuration',  type: 'configured_by'  },
  // Auth reads from data (user records, sessions)
  { from: 'auth_flow',         to: 'data_layer',         type: 'reads_from'     },
  { from: 'auth_flow',         to: 'app_configuration',  type: 'configured_by'  },
  // AI pipeline integrates with core and reads from data
  { from: 'ai_pipeline',       to: 'application_core',   type: 'integrated_with'},
  { from: 'ai_pipeline',       to: 'data_layer',         type: 'reads_from'     },
  { from: 'ai_pipeline',       to: 'app_configuration',  type: 'configured_by'  },
  // Data layer is configured and has schema evolution
  { from: 'data_layer',        to: 'app_configuration',  type: 'configured_by'  },
  // Infrastructure deploys the application core
  { from: 'infra_config',      to: 'application_core',   type: 'deploys'        },
  { from: 'infra_config',      to: 'app_configuration',  type: 'includes'       },
  // Type definitions are shared across layers
  { from: 'type_definitions',  to: 'api_surface',        type: 'types_for'      },
  { from: 'type_definitions',  to: 'data_layer',         type: 'types_for'      },
  { from: 'type_definitions',  to: 'application_core',   type: 'types_for'      },
  // Shared utilities support core + API
  { from: 'shared_utilities',  to: 'application_core',   type: 'supports'       },
  { from: 'shared_utilities',  to: 'api_surface',        type: 'supports'       },
  // Tests cover the systems they belong to
  { from: 'test_suite',        to: 'application_core',   type: 'tests'          },
  { from: 'test_suite',        to: 'api_surface',        type: 'tests'          },
  { from: 'test_suite',        to: 'data_layer',         type: 'tests'          },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tier helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives an importance tier string from a 0–1 score.
 * Mirrors the same thresholds used in repoIntelligenceScorer.js.
 */
function tierFromScore(score) {
  if (score >= 0.85) return 'critical';
  if (score >= 0.65) return 'high';
  if (score >= 0.45) return 'medium';
  if (score >= 0.25) return 'low';
  return 'minimal';
}

// ─────────────────────────────────────────────────────────────────────────────
// Token estimation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimates total token count for a set of file paths.
 * Uses the CHARS_PER_TOKEN constant — no tokenizer dependency.
 *
 * @param {string[]}                paths
 * @param {Object<string, object>}  fileContents  — { path → { content } }
 * @returns {number}
 */
function estimateTokens(paths, fileContents) {
  let totalChars = 0;
  for (const p of paths) {
    const fc = fileContents[p];
    if (fc && typeof fc.content === 'string') {
      totalChars += fc.content.length;
    }
  }
  return Math.ceil(totalChars / CHARS_PER_TOKEN);
}

// ─────────────────────────────────────────────────────────────────────────────
// File-level helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the sort key for a file: (rolePriority, -importanceScore).
 * Lower → more important → comes first in sorted output.
 *
 * @param {object} classifiedFile  — classified file record from Phase 3
 * @returns {number}
 */
function fileSortKey(classifiedFile) {
  const rp    = ROLE_PRIORITY[classifiedFile.role] ?? 99;
  const score = typeof classifiedFile.importanceScore === 'number'
    ? classifiedFile.importanceScore
    : 0;
  // Combine: role priority (1–99) shifted up, minus score so higher score sorts earlier
  return rp * 100 - score * 100;
}

/**
 * Collects unique architecture patterns from an array of classified file records.
 * @param {object[]} fileRecords
 * @returns {string[]}
 */
function collectArchPatterns(fileRecords) {
  const seen = new Set();
  for (const f of fileRecords) {
    if (!Array.isArray(f.architectureSignals)) continue;
    for (const sig of f.architectureSignals) {
      if (typeof sig === 'string') seen.add(sig);
    }
  }
  return [...seen];
}

/**
 * Collects unique technology/framework names from an array of classified file records.
 * @param {object[]} fileRecords
 * @returns {string[]}
 */
function collectTechnologies(fileRecords) {
  const seen = new Set();
  for (const f of fileRecords) {
    if (!Array.isArray(f.frameworkContext)) continue;
    for (const tech of f.frameworkContext) {
      if (typeof tech === 'string') seen.add(tech);
    }
  }
  return [...seen];
}

/**
 * Returns the primary domain of a set of file records.
 * "Primary" means the domain with the most files; ties broken by DOMAIN_PRIORITY.
 *
 * @param {object[]} fileRecords
 * @returns {string}
 */
const DOMAIN_PRIORITY_ORDER = [
  'ai_system', 'auth_system', 'backend', 'frontend',
  'database', 'infrastructure', 'configuration', 'testing', 'documentation', 'shared',
];

function primaryDomain(fileRecords) {
  if (fileRecords.length === 0) return 'backend';
  const counts = {};
  for (const f of fileRecords) {
    if (typeof f.domain === 'string') {
      counts[f.domain] = (counts[f.domain] ?? 0) + 1;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // most files first
    return DOMAIN_PRIORITY_ORDER.indexOf(a[0]) - DOMAIN_PRIORITY_ORDER.indexOf(b[0]);
  });
  return sorted[0]?.[0] ?? 'backend';
}

// ─────────────────────────────────────────────────────────────────────────────
// Chunk ID generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a deterministic chunk ID from semantic group name and split index.
 * e.g. buildChunkId('api_surface', 0) → 'chunk_api_surface_0'
 *
 * @param {string} semanticGroup
 * @param {number} index
 * @returns {string}
 */
function buildChunkId(semanticGroup, index) {
  return `chunk_${semanticGroup}_${index}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic chunk summary builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produces a human-readable, deterministic summary string for a chunk.
 * No LLM — built entirely from structural metadata.
 *
 * Format:
 *   "{groupLabel} — {n} file{s} ({domain}).[Tech list.] Key: {topFilenames}."
 *
 * @param {string}   semanticGroup
 * @param {string}   domain
 * @param {string[]} filePaths
 * @param {string[]} primaryPaths   — top important file paths
 * @param {string[]} technologies
 * @param {string[]} archPatterns
 * @returns {string}
 */
function buildChunkSummary(semanticGroup, domain, filePaths, primaryPaths, technologies, archPatterns) {
  const groupLabel  = GROUP_LABELS[semanticGroup] ?? semanticGroup.replace(/_/g, ' ');
  const domainLabel = DOMAIN_LABELS[domain]       ?? domain;
  const fileCount   = filePaths.length;
  const plural      = fileCount === 1 ? '' : 's';

  const parts = [`${groupLabel} — ${fileCount} file${plural} (${domainLabel})`];

  // Technology / architecture context (capped at 4 for readability)
  const techItems = [...technologies, ...archPatterns]
    .filter((v, i, a) => a.indexOf(v) === i) // deduplicate
    .slice(0, 4)
    .map(s => s.replace(/_/g, ' '));
  if (techItems.length > 0) {
    parts.push(techItems.join(', '));
  }

  // Key files (top 3 basenames for brevity)
  if (primaryPaths.length > 0) {
    const names = primaryPaths
      .slice(0, 3)
      .map(p => p.split('/').pop())
      .join(', ');
    parts.push(`Key: ${names}`);
  }

  return parts.join('. ') + '.';
}

// ─────────────────────────────────────────────────────────────────────────────
// Group-to-chunks conversion  (with token-budget splitting)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts one semantic group's file list into one or more chunk records.
 * If the total estimated token count exceeds MAX_CHARS_PER_CHUNK, the files
 * are split into sequential sub-chunks (chunk_<group>_0, chunk_<group>_1, …).
 *
 * Files are sorted by (rolePriority, -importanceScore) before splitting so
 * the most important files always land in chunk 0.
 *
 * @param {string}                  semanticGroup
 * @param {string[]}                paths          — all paths in this group
 * @param {Object<string, object>}  cfMap          — path → classified file record
 * @param {Object<string, object>}  fileContents   — path → enriched file data
 * @returns {object[]}  Array of raw chunk records (without relationships yet)
 */
function buildChunksForGroup(semanticGroup, paths, cfMap, fileContents) {
  // ── 1. Resolve classified file records for this group ─────────────────────
  // Files not found in cfMap (possible if Phase 3 skipped them) are filtered out.
  const fileRecords = [];
  for (const p of paths) {
    const cf = cfMap[p];
    if (cf) fileRecords.push(cf);
  }

  if (fileRecords.length === 0) return [];

  // ── 2. Sort by role priority + importance score desc ──────────────────────
  const sorted = fileRecords.slice().sort((a, b) => fileSortKey(a) - fileSortKey(b));

  // ── 3. Greedy token-budget split ──────────────────────────────────────────
  // Walk sorted files, greedily filling sub-chunks until the budget is spent.
  const subChunks     = [[]]; // array of arrays of fileRecords
  let   currentChars  = 0;

  for (const rec of sorted) {
    const fc       = fileContents[rec.path];
    const fileChars = (fc && typeof fc.content === 'string') ? fc.content.length : 0;

    // If adding this file would bust the limit AND the current chunk is non-empty,
    // start a new sub-chunk.
    if (currentChars > 0 && currentChars + fileChars > MAX_CHARS_PER_CHUNK) {
      subChunks.push([]);
      currentChars = 0;
    }

    subChunks[subChunks.length - 1].push(rec);
    currentChars += fileChars;
  }

  // ── 4. Build one raw chunk per sub-chunk ──────────────────────────────────
  const chunks = [];

  for (let i = 0; i < subChunks.length; i++) {
    const records = subChunks[i];
    if (records.length === 0) continue;

    const chunkId        = buildChunkId(semanticGroup, i);
    const filePaths      = records.map(r => r.path);
    const domain         = primaryDomain(records);
    const archPatterns   = collectArchPatterns(records);
    const technologies   = collectTechnologies(records);
    const estTokens      = estimateTokens(filePaths, fileContents);

    // Primary files: top MAX_PRIMARY_FILES by (role priority, importance score)
    const primaryPaths   = records
      .slice(0, MAX_PRIMARY_FILES)
      .map(r => r.path);

    // Chunk importance = the highest file importance score in this chunk
    let maxScore = 0;
    for (const r of records) {
      const s = typeof r.importanceScore === 'number' ? r.importanceScore : 0;
      if (s > maxScore) maxScore = s;
    }
    const importanceScore = parseFloat(maxScore.toFixed(3));
    const importanceTier  = tierFromScore(importanceScore);

    const summary = buildChunkSummary(
      semanticGroup,
      domain,
      filePaths,
      primaryPaths,
      technologies,
      archPatterns,
    );

    chunks.push({
      chunkId,
      semanticGroup,
      domain,
      files:               filePaths,
      primaryFiles:        primaryPaths,
      importanceScore,
      importanceTier,
      architecturePatterns: archPatterns,
      technologies,
      estimatedTokens:     estTokens,
      summary,
      relationships:       [], // populated in a second pass
    });
  }

  return chunks;
}

// ─────────────────────────────────────────────────────────────────────────────
// Relationship graph builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the flat chunkRelationships array and populates the `relationships`
 * field on each chunk using the RELATIONSHIP_RULES lookup table.
 *
 * A relationship is only created when chunks for BOTH the 'from' and 'to'
 * groups actually exist (no phantom relationships to empty groups).
 *
 * Mutates the chunks array in-place (adds to each chunk's .relationships).
 *
 * @param {object[]} chunks  — all chunk records (pre-populated, no relationships yet)
 * @returns {object[]}  Flat array of { fromChunkId, toChunkId, relationshipType }
 */
function buildChunkRelationships(chunks) {
  // Index: semanticGroup → [chunkIds]
  const groupToChunkIds = {};
  for (const chunk of chunks) {
    if (!groupToChunkIds[chunk.semanticGroup]) {
      groupToChunkIds[chunk.semanticGroup] = [];
    }
    groupToChunkIds[chunk.semanticGroup].push(chunk.chunkId);
  }

  // Index: chunkId → chunk (for mutation)
  const chunkById = {};
  for (const chunk of chunks) {
    chunkById[chunk.chunkId] = chunk;
  }

  const allRelationships = [];

  for (const rule of RELATIONSHIP_RULES) {
    const fromIds = groupToChunkIds[rule.from];
    const toIds   = groupToChunkIds[rule.to];

    // Skip if either side has no chunks in this repo
    if (!fromIds || fromIds.length === 0) continue;
    if (!toIds   || toIds.length   === 0) continue;

    for (const fromId of fromIds) {
      for (const toId of toIds) {
        // Skip self-relationships (possible when a group maps to itself)
        if (fromId === toId) continue;

        allRelationships.push({
          fromChunkId:      fromId,
          toChunkId:        toId,
          relationshipType: rule.type,
        });

        // Populate per-chunk relationships (outgoing)
        const fromChunk = chunkById[fromId];
        if (fromChunk) {
          fromChunk.relationships.push({
            chunkId:          toId,
            relationshipType: rule.type,
            direction:        'outgoing',
          });
        }

        // Populate per-chunk relationships (incoming)
        const toChunk = chunkById[toId];
        if (toChunk) {
          toChunk.relationships.push({
            chunkId:          fromId,
            relationshipType: rule.type,
            direction:        'incoming',
          });
        }
      }
    }
  }

  return allRelationships;
}

// ─────────────────────────────────────────────────────────────────────────────
// Retrieval index builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a multi-dimensional retrieval index from the final chunk array.
 * Enables Phase 5 agents to quickly find relevant chunks by domain, file path,
 * technology, semantic group, or importance tier without iterating all chunks.
 *
 * @param {object[]} chunks
 * @returns {{
 *   byDomain:         Object<string, string[]>,
 *   bySemanticGroup:  Object<string, string[]>,
 *   byFile:           Object<string, string>,
 *   byTechnology:     Object<string, string[]>,
 *   byImportanceTier: Object<string, string[]>,
 * }}
 */
function buildRetrievalIndex(chunks) {
  const byDomain         = {};
  const bySemanticGroup  = {};
  const byFile           = {};
  const byTechnology     = {};
  const byImportanceTier = {};

  for (const chunk of chunks) {
    const id = chunk.chunkId;

    // ── byDomain ─────────────────────────────────────────────────────────────
    if (!byDomain[chunk.domain]) byDomain[chunk.domain] = [];
    byDomain[chunk.domain].push(id);

    // ── bySemanticGroup ───────────────────────────────────────────────────────
    if (!bySemanticGroup[chunk.semanticGroup]) bySemanticGroup[chunk.semanticGroup] = [];
    bySemanticGroup[chunk.semanticGroup].push(id);

    // ── byFile (one-to-one: each file belongs to exactly one chunk) ───────────
    for (const p of chunk.files) {
      byFile[p] = id;
    }

    // ── byTechnology ──────────────────────────────────────────────────────────
    for (const tech of chunk.technologies) {
      if (!byTechnology[tech]) byTechnology[tech] = [];
      if (!byTechnology[tech].includes(id)) byTechnology[tech].push(id);
    }

    // ── byImportanceTier ──────────────────────────────────────────────────────
    const tier = chunk.importanceTier;
    if (!byImportanceTier[tier]) byImportanceTier[tier] = [];
    byImportanceTier[tier].push(id);
  }

  return { byDomain, bySemanticGroup, byFile, byTechnology, byImportanceTier };
}

// ─────────────────────────────────────────────────────────────────────────────
// chunkRepository  — Phase 4 entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phase 4 — Semantic Chunking.
 *
 * Groups classified files into retrieval-ready semantic chunks by semanticGroup,
 * builds an architectural relationship graph between chunks, generates
 * deterministic summaries, and constructs a multi-dimensional retrieval index.
 *
 * Pipeline contract: returns { data, meta, dbUpdate } as expected by
 * runPhaseIsolated() in deepAnalysisPipeline.js.
 *
 *   data     — passed to Phase 5 (intelligenceAgents)
 *   meta     — stored in phase_metrics_json by persistCheckpoint()
 *   dbUpdate — { semantic_chunks_json: … } — persisted immediately
 *
 * @param {object} fileClassificationData  — Phase 3 fcResult.data
 *   @param {object[]} fileClassificationData.classifiedFiles   — per-file records
 *   @param {object}   fileClassificationData.semanticGroups    — { group: [paths] }
 *   @param {object}   fileClassificationData.fileContents      — { path → file data }
 *   @param {object}   fileClassificationData.importantFiles    — sorted important files
 *   @param {object}   fileClassificationData.domainBreakdown
 *   @param {object}   fileClassificationData.roleBreakdown
 *   @param {object}   fileClassificationData.summary
 *
 * @returns {{ data: object, meta: object, dbUpdate: object }}
 */
function chunkRepository(fileClassificationData) {
  // ── Defensive normalisation ───────────────────────────────────────────────
  const safe = (fileClassificationData && typeof fileClassificationData === 'object')
    ? fileClassificationData
    : {};

  const classifiedFiles = Array.isArray(safe.classifiedFiles) ? safe.classifiedFiles : [];
  const semanticGroups  = (safe.semanticGroups && typeof safe.semanticGroups === 'object')
    ? safe.semanticGroups
    : {};
  const fileContents    = (safe.fileContents && typeof safe.fileContents === 'object')
    ? safe.fileContents
    : {};

  // ── Build classified file lookup ──────────────────────────────────────────
  // path → classified file record; used for O(1) access inside buildChunksForGroup.
  const cfMap = {};
  for (const cf of classifiedFiles) {
    if (cf && typeof cf.path === 'string') {
      cfMap[cf.path] = cf;
    }
  }

  // ── Build one or more chunks per semantic group ───────────────────────────
  const allChunks = [];

  for (const [group, paths] of Object.entries(semanticGroups)) {
    if (!Array.isArray(paths) || paths.length === 0) continue;

    try {
      const groupChunks = buildChunksForGroup(group, paths, cfMap, fileContents);
      for (const c of groupChunks) allChunks.push(c);
    } catch {
      // Per-group fault isolation — a malformed group never aborts the phase
    }
  }

  // ── Build relationship graph (mutates chunk.relationships in-place) ───────
  let chunkRelationships = [];
  try {
    chunkRelationships = buildChunkRelationships(allChunks);
  } catch {
    // Relationship building is best-effort — partial is better than failing
    chunkRelationships = [];
  }

  // ── Build retrieval index ─────────────────────────────────────────────────
  let retrievalIndex = { byDomain: {}, bySemanticGroup: {}, byFile: {}, byTechnology: {}, byImportanceTier: {} };
  try {
    retrievalIndex = buildRetrievalIndex(allChunks);
  } catch {
    // Index building failure is non-fatal
  }

  // ── Build chunkSummaries convenience map ─────────────────────────────────
  const chunkSummaries = {};
  for (const chunk of allChunks) {
    chunkSummaries[chunk.chunkId] = chunk.summary;
  }

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalFilesChunked = new Set(allChunks.flatMap(c => c.files)).size;
  const totalEstTokens    = allChunks.reduce((sum, c) => sum + c.estimatedTokens, 0);
  const domainsRepresented = [...new Set(allChunks.map(c => c.domain))];
  const splitChunks        = Object.values(
    allChunks.reduce((acc, c) => {
      acc[c.semanticGroup] = (acc[c.semanticGroup] ?? 0) + 1;
      return acc;
    }, {}),
  ).filter(count => count > 1).length;

  const summary = {
    chunksCreated:       allChunks.length,
    groupsChunked:       Object.keys(semanticGroups).length,
    groupsSplit:         splitChunks,
    totalFilesChunked,
    domainsRepresented,
    relationshipsBuilt:  chunkRelationships.length,
    estimatedTotalTokens: totalEstTokens,
  };

  // ── Phase 4 output (passed to Phase 5 intelligenceAgents) ─────────────────
  // fileContents is passed through so agents can access raw code content
  // without re-fetching from DB. Not stored in dbUpdate (already in DB).
  // NOTE: allChunks was mutated in-place by buildChunkRelationships above
  // (relationships arrays were populated), so we reference it directly here.
  const chunkedAt = new Date().toISOString();
  const data = {
    chunks:            allChunks,
    chunkRelationships,
    chunkSummaries,
    retrievalIndex,
    summary,
    fileContents,         // passthrough for Phase 5 — not stored in DB
    analysisVersion: 2,
    chunkedAt,
  };

  // ── Phase metrics (stored in phase_metrics_json) ──────────────────────────
  // Shape matches phaseTracker.js documentation for semanticChunking.
  const meta = {
    chunksCreated:   allChunks.length,
    chunkNames:      allChunks.map(c => c.chunkId),
    totalFilesChunked,
    groupsChunked:   Object.keys(semanticGroups).length,
    domainsRepresented: domainsRepresented.length,
    relationshipsBuilt: chunkRelationships.length,
    estimatedTotalTokens: totalEstTokens,
  };

  // ── DB update — stored in semantic_chunks_json ────────────────────────────
  // Excludes fileContents (already in github_enrichment_json) to avoid bloat.
  const dbPayload = {
    chunks:            allChunks,
    chunkRelationships,
    chunkSummaries,
    retrievalIndex,
    summary,
    analysisVersion: 2,
    chunkedAt,
  };

  return {
    data,
    meta,
    dbUpdate: { semantic_chunks_json: dbPayload },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  chunkRepository,          // Phase 4 entry point
  buildChunksForGroup,      // exported for unit testing
  buildChunkRelationships,  // exported for unit testing
  buildRetrievalIndex,      // exported for unit testing
  buildChunkSummary,        // exported for unit testing
  RELATIONSHIP_RULES,
  GROUP_LABELS,
};
