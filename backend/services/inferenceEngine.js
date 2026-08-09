'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// inferenceEngine.js
//
// Phase 6 of the v2 deep-analysis pipeline — cross-phase synthesis and
// confidence evaluation layer.
//
// Design constraints:
//   - Consumes outputs from all five upstream phases
//   - Zero AI/LLM calls — fully deterministic
//   - No randomness — same inputs always produce identical outputs
//   - Follows the standard { data, meta, dbUpdate } pipeline contract
//   - Null-safe and fault-tolerant throughout
// ─────────────────────────────────────────────────────────────────────────────

const ANALYSIS_VERSION = 2;

// ── Rank tables ───────────────────────────────────────────────────────────────
// Used for ordinal comparison in agreement checks and assessment inference.

const SENIORITY_RANK = { junior: 1, mid: 2, senior: 3 };

const AI_MATURITY_RANK = {
  none:              0,
  basic_integration: 1,
  orchestrated_ai:   2,
  production_ai:     3,
};

const DEPLOYMENT_RANK = {
  none:                 0,
  basic_infrastructure: 1,
  containerized:        2,
  automated_delivery:   3,
  production_ready:     4,
};

// ── Coverage weights ──────────────────────────────────────────────────────────
// Positive contributions to signalCoverage. All max values sum to exactly 1.00.
// Density-scaled signals contribute proportionally up to their stated maximum.

const COVERAGE_WEIGHTS = {
  // Pipeline data presence — boolean (max 0.40)
  hasFiles:              0.08,
  hasCodeIntelligence:   0.10,
  hasFileClassification: 0.07,
  hasSemanticChunks:     0.10,
  hasIntelligence:       0.05,

  // Signal density — continuous, capped to [0, max] (max 0.30)
  fileDensity:           0.06,  // filesScanned / 20, capped at 1
  technologyBreadth:     0.05,  // techCount / 5, capped at 1
  semanticGroupRichness: 0.05,  // semanticGroupCount / 4, capped at 1
  technologyCertainty:   0.08,  // ciConfidence (already 0–1)
  relationshipDensity:   0.06,  // relationships / max(1, chunks-1), capped at 1

  // Architectural evidence — continuous, capped (max 0.20)
  archPatternsP2:        0.08,  // archPatterns.length / 3, capped at 1
  archPatternsP5:        0.07,  // archPatternsP5 / 2, capped at 1
  domainBreadth:         0.05,  // chunkDomainCount / 3, capped at 1

  // Richness indicators — boolean or continuous (max 0.10)
  documentationPresent:  0.03,
  cicdPresent:           0.03,
  aiToolingRichness:     0.04,  // aiToolCount / 2, capped at 1
};

// Penalties subtracted after positive summation — clamp01 applied afterwards.
const COVERAGE_PENALTIES = {
  conflictingSeniority: 0.05,  // Phase 5 agents disagree on seniority
  sparseSemanticGraph:  0.04,  // ≥4 chunks with zero relationships
  missingDeployment:    0.02,  // no deployment maturity signal from Phase 5
};

// ── Pattern registry (documentation only) ────────────────────────────────────
// Firing conditions are implemented in inferPatterns(). This list documents
// every pattern the engine can emit so the set is auditable without reading code.

const PATTERN_REGISTRY = [
  { id: 'fullstack_architecture_confirmed', description: 'Frontend and backend domains both detected with semantic chunking evidence' },
  { id: 'ai_orchestrated_system',           description: 'AI orchestration library (LangChain, LlamaIndex, Vercel AI SDK) detected' },
  { id: 'ai_integration_confirmed',         description: 'AI tooling detected and Phase 5 aiCapabilities.present is true' },
  { id: 'retrieval_augmented_architecture', description: 'Vector database + AI tooling — indicates a RAG pattern' },
  { id: 'production_ready_backend',         description: 'Backend domain + infrastructure tooling (Docker, CI/CD) detected' },
  { id: 'scalable_service_architecture',    description: 'Container orchestration confirmed (Docker + Kubernetes)' },
  { id: 'enterprise_backend_patterns',      description: 'Auth + database + CI/CD + 3+ architecture patterns — enterprise-level complexity' },
  { id: 'strong_domain_separation',         description: '3+ distinct semantic chunk domains with cross-domain relationships' },
  { id: 'modular_frontend_architecture',    description: 'Frontend domain + state management library detected' },
  { id: 'authentication_layer_present',     description: 'Dedicated authentication domain confirmed across multiple phases' },
  { id: 'infrastructure_as_code_present',   description: 'Infrastructure tooling (Docker, Kubernetes, GitHub Actions, Terraform) detected' },
];

// ── Technology sets ───────────────────────────────────────────────────────────
// Defined once at module load — not rebuilt on every call.

const AI_TECH_SET  = new Set([
  'openai','anthropic','langchain','llamaindex','vercel-ai-sdk',
  'pinecone','weaviate','chromadb','mistral','cohere','groq','embeddings',
]);
const VECTOR_DB_SET = new Set(['pinecone','weaviate','chromadb']);
const ORCHESTR_SET  = new Set(['langchain','llamaindex','vercel-ai-sdk']);
const INFRA_SET     = new Set(['docker','kubernetes','github-actions','terraform']);
const STATE_SET     = new Set(['redux','zustand','jotai','recoil']);

// ── Utility helpers ───────────────────────────────────────────────────────────

function safeArr(val)             { return Array.isArray(val) ? val : []; }
function safeObj(val)             { return val && typeof val === 'object' && !Array.isArray(val) ? val : {}; }
function safeNum(val, fallback=0) { return typeof val === 'number' && isFinite(val) ? val : fallback; }
function clamp01(x)               { return Math.max(0, Math.min(1, x)); }
function round2(x)                { return Math.round(x * 100) / 100; }

// ── Relationship density ──────────────────────────────────────────────────────

/**
 * Fraction of the theoretical maximum relationships in a linear chain.
 * Returns 0 when chunkCount ≤ 1 (no relationships possible).
 */
function computeRelationshipDensity(chunkCount, relationshipCount) {
  if (chunkCount <= 1) return 0;
  return clamp01(relationshipCount / (chunkCount - 1));
}

// ── Cross-phase signal extraction ─────────────────────────────────────────────

/**
 * Derives a flat, normalised signal map from all five phase outputs.
 * All downstream inference reads from this object — never from raw inputs directly.
 * Each field is null-safe and has a typed fallback.
 */
function extractCrossPhaseSignals({
  enrichmentData,
  codeIntelligenceData,
  fileClassificationData,
  semanticChunkingData,
  intelligenceData,
}) {
  // ── Phase 1: enrichment
  const fileContents = safeObj(enrichmentData?.fileContents);
  const rankedFiles  = safeArr(enrichmentData?.rankedFiles);
  const filesScanned = safeNum(enrichmentData?.summary?.filesScanned);
  const hasFiles     = filesScanned > 0 || Object.keys(fileContents).length > 0;

  // ── Phase 2: code intelligence
  const ci             = safeObj(codeIntelligenceData);
  const technologies   = safeArr(ci.technologies);
  const archPatterns   = safeArr(ci.architecturePatterns);
  const detectedDomains = safeArr(ci.detectedDomains);
  const ciConfidence   = safeNum(ci.confidenceScore);
  const dominantStack  = ci.dominantStack ?? null;
  const techCount      = technologies.length;

  const hasInfra       = technologies.some(t => INFRA_SET.has(t));
  const hasCICD        = technologies.includes('github-actions') ||
                         technologies.includes('circleci') ||
                         technologies.includes('travis');
  const hasAi          = technologies.some(t => AI_TECH_SET.has(t));
  const hasVectorDb    = technologies.some(t => VECTOR_DB_SET.has(t));
  const hasOrchestr    = technologies.some(t => ORCHESTR_SET.has(t));
  const hasStateMgmt   = technologies.some(t => STATE_SET.has(t));
  const aiToolCount    = technologies.filter(t => AI_TECH_SET.has(t)).length;

  const hasAuth     = detectedDomains.includes('authentication');
  const hasFrontend = detectedDomains.includes('frontend');
  const hasBackend  = detectedDomains.includes('api_layer') || detectedDomains.includes('database');

  // ── Phase 3: file classification
  const fc              = safeObj(fileClassificationData);
  const classifiedFiles = safeArr(fc.files ?? fc.classifiedFiles);
  const fcDomains       = new Set(classifiedFiles.map(f => f.domain).filter(Boolean));
  const hasDocFiles     = classifiedFiles.some(
    f => f.semanticGroup === 'documentation' || f.role === 'documentation',
  );
  const hasTests        = classifiedFiles.some(
    f => f.semanticGroup === 'tests' || f.role === 'test' || f.role === 'testing',
  );

  // ── Phase 4: semantic chunking
  const sc                = safeObj(semanticChunkingData);
  const chunks            = safeArr(sc.chunks);
  const relationships     = safeArr(sc.chunkRelationships);
  const chunkDomains      = new Set(chunks.map(c => c.domain).filter(Boolean));
  const chunkGroups       = new Set(chunks.map(c => c.semanticGroup).filter(Boolean));
  const chunkCount        = chunks.length;
  const relationshipCount = relationships.length;
  const relDensity        = computeRelationshipDensity(chunkCount, relationshipCount);

  // ── Phase 5: intelligence agents
  const intel       = safeObj(intelligenceData);
  const execSummary = safeObj(intel.executiveSummary);
  const skills      = safeObj(intel.skills);
  const aiCaps      = safeObj(intel.aiCapabilities);
  const arch        = safeObj(intel.architecture);

  return {
    // Phase 1
    hasFiles,
    filesScanned,
    rankedFilesCount: rankedFiles.length,
    hasDocFiles,

    // Phase 2
    hasCodeIntelligence: techCount > 0 || detectedDomains.length > 0,
    technologies,
    techCount,
    archPatterns,
    detectedDomains,
    ciConfidence,
    dominantStack,
    hasInfra,
    hasCICD,
    hasAi,
    hasVectorDb,
    hasOrchestratorLib: hasOrchestr,
    hasStateMgmt,
    aiToolCount,
    hasAuth,
    hasFrontend,
    hasBackend,

    // Phase 3
    hasFileClassification: classifiedFiles.length > 0,
    fcDomains:    [...fcDomains],
    fcDomainCount: fcDomains.size,
    hasTests,

    // Phase 4
    hasSemanticChunks:  chunkCount > 0,
    chunkCount,
    relationshipCount,
    relationshipDensity: relDensity,
    chunkDomains:       [...chunkDomains],
    chunkDomainCount:   chunkDomains.size,
    semanticGroupCount: chunkGroups.size,

    // Phase 5
    hasIntelligence:       !!intel.executiveSummary,
    seniority_execSummary: execSummary.seniority        ?? null,
    seniority_skills:      skills.seniority              ?? null,
    aiMaturity_skills:     skills.aiMaturityLevel        ?? null,
    aiMaturity_aiCaps:     aiCaps.maturityLevel          ?? null,
    aiCapsPresent:         aiCaps.present                ?? false,
    deploymentMaturity:    execSummary.deploymentMaturity ?? null,
    projectType:           execSummary.projectType        ?? null,
    archLayers:            safeArr(arch.layers).length,
    archPatternsP5:        safeArr(arch.patterns).length,
  };
}

// ── Signal coverage scoring ───────────────────────────────────────────────────

/**
 * Measures how completely the pipeline captured evidence from this repository.
 *
 * Structure:
 *   positive = sum of weighted evidence signals (max 1.00)
 *   penalties = subtracted for conflicting or absent signals (max 0.11)
 *   result = clamp01(positive - penalties), rounded to 2 decimal places
 *
 * Density signals scale continuously 0 → max weight using capped ratios.
 * Boolean signals contribute their full weight or zero.
 */
function computeSignalCoverage(signals) {
  let score = 0;

  // Pipeline data presence (max 0.40)
  if (signals.hasFiles)               score += COVERAGE_WEIGHTS.hasFiles;
  if (signals.hasCodeIntelligence)    score += COVERAGE_WEIGHTS.hasCodeIntelligence;
  if (signals.hasFileClassification)  score += COVERAGE_WEIGHTS.hasFileClassification;
  if (signals.hasSemanticChunks)      score += COVERAGE_WEIGHTS.hasSemanticChunks;
  if (signals.hasIntelligence)        score += COVERAGE_WEIGHTS.hasIntelligence;

  // Signal density — continuous, capped (max 0.30)
  score += clamp01(signals.filesScanned   / 20) * COVERAGE_WEIGHTS.fileDensity;
  score += clamp01(signals.techCount      / 5)  * COVERAGE_WEIGHTS.technologyBreadth;
  score += clamp01(signals.semanticGroupCount / 4) * COVERAGE_WEIGHTS.semanticGroupRichness;
  score += signals.ciConfidence                  * COVERAGE_WEIGHTS.technologyCertainty;
  score += signals.relationshipDensity           * COVERAGE_WEIGHTS.relationshipDensity;

  // Architectural evidence — continuous, capped (max 0.20)
  score += clamp01(signals.archPatterns.length / 3) * COVERAGE_WEIGHTS.archPatternsP2;
  score += clamp01(signals.archPatternsP5      / 2) * COVERAGE_WEIGHTS.archPatternsP5;
  score += clamp01(signals.chunkDomainCount    / 3) * COVERAGE_WEIGHTS.domainBreadth;

  // Richness indicators (max 0.10)
  if (signals.hasDocFiles) score += COVERAGE_WEIGHTS.documentationPresent;
  if (signals.hasCICD)     score += COVERAGE_WEIGHTS.cicdPresent;
  score += clamp01(signals.aiToolCount / 2)         * COVERAGE_WEIGHTS.aiToolingRichness;

  // Penalties — applied last
  if (signals.seniority_execSummary && signals.seniority_skills &&
      signals.seniority_execSummary !== signals.seniority_skills)
    score -= COVERAGE_PENALTIES.conflictingSeniority;

  if (signals.chunkCount >= 4 && signals.relationshipCount === 0)
    score -= COVERAGE_PENALTIES.sparseSemanticGraph;

  if (!signals.deploymentMaturity || signals.deploymentMaturity === 'none')
    score -= COVERAGE_PENALTIES.missingDeployment;

  return round2(clamp01(score));
}

// ── Cross-phase consistency scoring ──────────────────────────────────────────

/**
 * Scores how consistently the five phases agree with each other.
 * Each applicable check contributes 0 (full disagreement) to 1 (full agreement).
 * Returns the mean of all checks that had enough data to evaluate, in [0, 1].
 *
 * Checks:
 *   1. Seniority — executiveSummary vs skills agent
 *   2. AI maturity — skills agent vs aiCapabilities agent
 *   3. Domain overlap — Phase 2 detectedDomains vs Phase 4 chunkDomains
 *   4. Deployment — Phase 5 maturity claim vs Phase 2 infra evidence
 */
function scoreCrossPhaseConsistency(signals) {
  const checks = [];

  // 1. Seniority agreement
  if (signals.seniority_execSummary && signals.seniority_skills) {
    checks.push(signals.seniority_execSummary === signals.seniority_skills ? 1 : 0);
  }

  // 2. AI maturity agreement
  if (signals.aiMaturity_skills && signals.aiMaturity_aiCaps) {
    checks.push(signals.aiMaturity_skills === signals.aiMaturity_aiCaps ? 1 : 0);
  }

  // 3. Domain overlap: Phase 2 names vs Phase 4 chunk domain names
  // Phase vocabularies differ — map equivalent concepts before comparing.
  if (signals.detectedDomains.length > 0 && signals.chunkDomains.length > 0) {
    const p2 = new Set(signals.detectedDomains);
    const matched = signals.chunkDomains.filter(d => {
      if (d === 'backend')     return p2.has('api_layer') || p2.has('database');
      if (d === 'auth_system') return p2.has('authentication');
      if (d === 'ai_system')   return p2.has('ai_tooling');
      return p2.has(d);
    }).length;
    checks.push(clamp01(matched / Math.max(1, signals.chunkDomains.length)));
  }

  // 4. Deployment: Phase 5 claim vs Phase 2 infra signals
  if (signals.deploymentMaturity) {
    const rank = DEPLOYMENT_RANK[signals.deploymentMaturity] ?? 0;
    if      (rank >= 3 && signals.hasInfra && signals.hasCICD) checks.push(1);
    else if (rank >= 3 && signals.hasInfra)                    checks.push(0.5);
    else if (rank >= 3)                                         checks.push(0);
    else if (rank === 2 && signals.hasInfra)                    checks.push(1);
    else if (rank === 2)                                         checks.push(0);
    else                                                         checks.push(1); // low claim consistent regardless
  }

  if (checks.length === 0) return 0;
  return round2(checks.reduce((a, b) => a + b, 0) / checks.length);
}

/**
 * Composite overall confidence.
 *
 * Formula:  overall = clamp01(coverage × 0.65 + consistency × 0.35)
 *
 * Coverage (65%) captures evidence quantity — how much data the pipeline collected.
 * Consistency (35%) rewards coherent cross-phase narratives.
 */
function computeOverallConfidence(signalCoverage, crossPhaseConsistency) {
  return round2(clamp01(signalCoverage * 0.65 + crossPhaseConsistency * 0.35));
}

// ── Cross-phase agreement checks ──────────────────────────────────────────────
// Each function returns: 'high' | 'medium' | 'low' | 'partial' | null

function checkSeniorityAgreement(signals) {
  const a = signals.seniority_execSummary;
  const b = signals.seniority_skills;
  if (!a && !b) return null;
  if (!a || !b) return 'partial';
  if (a === b)  return 'high';
  const diff = Math.abs((SENIORITY_RANK[a] ?? 0) - (SENIORITY_RANK[b] ?? 0));
  return diff === 1 ? 'medium' : 'low';
}

function checkAiMaturityAgreement(signals) {
  const a = signals.aiMaturity_skills;
  const b = signals.aiMaturity_aiCaps;
  if (!a && !b) return null;
  if (!a || !b) return 'partial';
  if (a === b)  return 'high';
  const diff = Math.abs((AI_MATURITY_RANK[a] ?? 0) - (AI_MATURITY_RANK[b] ?? 0));
  return diff === 1 ? 'medium' : 'low';
}

function checkArchitectureConsistency(signals) {
  const hasP2 = signals.archPatterns.length > 0;
  const hasP5 = signals.archLayers > 0 || signals.archPatternsP5 > 0;
  const richChunks = signals.chunkCount >= 2 && signals.chunkDomainCount >= 2;

  if (!hasP2 && !hasP5) return null;
  if (hasP2 && hasP5 && richChunks) return 'high';
  if (hasP2 && richChunks)          return 'medium';
  if (hasP2 || hasP5)               return 'medium';
  return 'low';
}

/**
 * Validates Phase 5's deployment maturity claim against Phase 2 infrastructure
 * evidence. A high-maturity claim backed by matching infra signals → 'high'.
 * An unsupported high claim → 'low'.
 */
function checkDeploymentConsistency(signals) {
  if (!signals.deploymentMaturity) return null;
  const rank = DEPLOYMENT_RANK[signals.deploymentMaturity] ?? 0;

  if (rank >= 3) {
    if (signals.hasInfra && signals.hasCICD) return 'high';
    if (signals.hasInfra)                    return 'medium';
    return 'low';
  }
  if (rank === 2) return signals.hasInfra ? 'high' : 'low';
  if (rank === 1) return signals.hasInfra ? 'high' : 'medium';
  // rank 0 (none) — consistent if no infra detected, inconsistent if infra is present
  return signals.hasInfra ? 'medium' : 'high';
}

// ── Pattern inference ─────────────────────────────────────────────────────────

/**
 * Evaluates each PATTERN_REGISTRY entry deterministically against the signal map.
 * Returns an array of fired pattern id strings — no thresholds, only hard conditions.
 *
 * Rules are ordered from broadest (fullstack) to most specific (enterprise).
 * A repository can match any number of patterns simultaneously.
 */
function inferPatterns(signals) {
  const fired = [];

  // Fullstack: frontend + backend + chunking evidence
  if (signals.hasFrontend && signals.hasBackend && signals.hasSemanticChunks)
    fired.push('fullstack_architecture_confirmed');

  // AI orchestration: dedicated orchestration library present
  if (signals.hasOrchestratorLib)
    fired.push('ai_orchestrated_system');

  // AI integration: AI tech detected AND Phase 5 confirmed AI capabilities
  if (signals.hasAi && signals.aiCapsPresent)
    fired.push('ai_integration_confirmed');

  // RAG: vector database + AI tooling
  if (signals.hasAi && signals.hasVectorDb)
    fired.push('retrieval_augmented_architecture');

  // Production backend: backend domain + any infrastructure tooling
  if (signals.hasBackend && signals.hasInfra)
    fired.push('production_ready_backend');

  // Scalable service: explicit container orchestration (Docker + Kubernetes)
  if (signals.technologies.includes('docker') && signals.technologies.includes('kubernetes'))
    fired.push('scalable_service_architecture');

  // Enterprise: auth + database domain + CI/CD + 3+ architecture patterns
  if (signals.hasAuth && signals.hasBackend && signals.hasCICD &&
      signals.archPatterns.length >= 3)
    fired.push('enterprise_backend_patterns');

  // Domain separation: 3+ chunk domains with cross-domain relationships
  if (signals.chunkDomainCount >= 3 && signals.relationshipCount > 0)
    fired.push('strong_domain_separation');

  // Modular frontend: frontend domain + state management library
  if (signals.hasFrontend && signals.hasStateMgmt)
    fired.push('modular_frontend_architecture');

  // Auth layer: authentication domain confirmed in Phase 2
  if (signals.hasAuth)
    fired.push('authentication_layer_present');

  // Infrastructure as code: any infra tooling detected
  if (signals.hasInfra)
    fired.push('infrastructure_as_code_present');

  return fired;
}

// ── Overall assessment ────────────────────────────────────────────────────────

/**
 * Portfolio strength — multi-factor composite score.
 *
 * Factors and weights:
 *   overall confidence    40%
 *   architecture richness 25%  (arch patterns + chunk domain breadth)
 *   technology diversity  20%  (tech count, saturates at 8)
 *   infra + AI maturity   15%  (infra presence + AI maturity rank)
 *
 * Thresholds: strong ≥ 0.72 · developing ≥ 0.48 · emerging ≥ 0.24 · minimal
 */
function inferPortfolioStrength(signals, confidence) {
  if (!signals.hasIntelligence) return null;

  const archRichness = clamp01(
    clamp01(signals.archPatterns.length / 4) * 0.50 +
    clamp01(signals.chunkDomainCount    / 5) * 0.50,
  );
  const techDiversity = clamp01(signals.techCount / 8);
  const infraAi = clamp01(
    (signals.hasInfra ? 0.50 : 0) +
    ((AI_MATURITY_RANK[signals.aiMaturity_aiCaps] ?? 0) / 3) * 0.50,
  );

  const composite = round2(
    confidence  * 0.40 +
    archRichness  * 0.25 +
    techDiversity * 0.20 +
    infraAi       * 0.15,
  );

  if (composite >= 0.72) return 'strong';
  if (composite >= 0.48) return 'developing';
  if (composite >= 0.24) return 'emerging';
  return 'minimal';
}

/**
 * Engineering level — consensus-first, structurally-arbitrated on conflict.
 *
 * Primary: if Phase 5 executiveSummary and skills agents agree on seniority,
 *          that consensus is authoritative.
 * Fallback: when agents disagree or only one is available, structural complexity
 *           signals (tech breadth, architecture depth, infra, AI, chunk richness)
 *           are scored and mapped to junior / mid / senior.
 */
function inferEngineeringLevel(signals) {
  const a = signals.seniority_execSummary;
  const b = signals.seniority_skills;

  if (a && b && a === b) return a; // agents agree — use consensus directly

  // Structural arbitration
  const complexityScore =
    (signals.techCount >= 6        ? 2 : signals.techCount >= 3 ? 1 : 0) +
    (signals.archPatterns.length >= 3 ? 2 : signals.archPatterns.length >= 1 ? 1 : 0) +
    (signals.hasInfra              ? 1 : 0) +
    (signals.hasAi                 ? 1 : 0) +
    (signals.chunkDomainCount >= 4 ? 1 : 0) +
    (signals.relationshipCount >= 3 ? 1 : 0);

  if (complexityScore >= 6) return a ?? b ?? 'senior';
  if (complexityScore >= 3) return a ?? b ?? 'mid';
  return a ?? b ?? 'junior';
}

/**
 * Project maturity — scored from six independent structural signals.
 * Returns null when Phase 5 or Phase 4 data is absent (insufficient basis).
 *
 * Signals:
 *   chunkCount ≥ 5  · chunkDomainCount ≥ 3 · archPatterns present
 *   relationships present · documentation present · tests present
 *
 * Thresholds: mature ≥ 5 · developing ≥ 3 · early
 */
function deriveProjectMaturity(signals) {
  if (!signals.hasIntelligence || !signals.hasSemanticChunks) return null;

  const score =
    (signals.chunkCount        >= 5 ? 1 : 0) +
    (signals.chunkDomainCount  >= 3 ? 1 : 0) +
    (signals.archPatterns.length >  0 ? 1 : 0) +
    (signals.relationshipCount  >  0 ? 1 : 0) +
    (signals.hasDocFiles             ? 1 : 0) +
    (signals.hasTests                ? 1 : 0);

  if (score >= 5) return 'mature';
  if (score >= 3) return 'developing';
  return 'early';
}

/**
 * Deployment readiness — maps Phase 5 deployment maturity through a Phase 2
 * infrastructure validation filter.
 *
 * High Phase 5 claims that lack Phase 2 infra evidence are downgraded:
 *   automated_delivery/production_ready without infra → 'basic'
 *   automated_delivery without CI/CD                  → 'containerized'
 *   containerized without infra techs                 → 'basic'
 */
function inferDeploymentReadiness(signals) {
  const rank = DEPLOYMENT_RANK[signals.deploymentMaturity] ?? 0;

  // Validate high claims against infra evidence
  if (rank >= 3 && !signals.hasInfra)              return 'basic';
  if (rank >= 3 && !signals.hasCICD)               return 'containerized';
  if (rank === 2 && !signals.hasInfra)             return 'basic';

  // Validated claims pass through
  if (rank >= 4) return 'production_ready';
  if (rank >= 3) return 'automated';
  if (rank >= 2) return 'containerized';

  // Infra signals may indicate readiness even when Phase 5 didn't report it
  if (rank >= 1 || signals.hasInfra) return 'basic';
  return 'none';
}

// ── Strengths ─────────────────────────────────────────────────────────────────

function deriveStrengths(signals, patternsInferred) {
  const has = p => patternsInferred.includes(p);
  const out = [];

  if (has('fullstack_architecture_confirmed'))
    out.push('Full-stack architecture with clear frontend and backend separation');
  if (has('ai_orchestrated_system'))
    out.push('Structured AI orchestration via a dedicated framework layer');
  if (has('retrieval_augmented_architecture'))
    out.push('Retrieval-augmented architecture with vector database integration');
  if (has('enterprise_backend_patterns'))
    out.push('Enterprise-level backend: auth, persistence, CI/CD, and layered architecture');
  if (has('strong_domain_separation'))
    out.push('Strong domain-driven structure with well-defined semantic boundaries');
  if (has('production_ready_backend'))
    out.push('Production-grade backend with infrastructure and deployment tooling');
  if (has('modular_frontend_architecture'))
    out.push('Modular frontend architecture with structured state management');
  if (has('scalable_service_architecture'))
    out.push('Container orchestration present — infrastructure scales horizontally');
  if (has('authentication_layer_present'))
    out.push('Dedicated authentication layer identified');

  return out;
}

// ── Recommendations ───────────────────────────────────────────────────────────

/**
 * Generates actionable, deterministic recommendations from absent or weak signals.
 * Each rule fires only when the corresponding signal is missing — no recommendation
 * is emitted for signals that are already present.
 */
function generateRecommendations(signals) {
  const out = [];

  if (!signals.hasDocFiles)
    out.push('Add documentation files (README, /docs) to strengthen portfolio signal and onboarding clarity');

  if (!signals.hasTests)
    out.push('Add automated tests to demonstrate production confidence and engineering rigor');

  if (!signals.hasInfra)
    out.push('Add infrastructure configuration (Docker, GitHub Actions) to demonstrate deployment readiness');

  if (signals.hasInfra && !signals.hasCICD)
    out.push('Add a CI/CD pipeline (GitHub Actions, GitLab CI) to automate build, test, and delivery');

  if (!signals.hasAuth && signals.hasBackend)
    out.push('Authentication layer not detected — add auth middleware to strengthen security posture');

  if (signals.hasAi && !signals.hasOrchestratorLib)
    out.push('Consider a dedicated AI orchestration library (LangChain, LlamaIndex) to structure AI call flows');

  if (signals.hasAi && signals.aiToolCount >= 2 && !signals.hasVectorDb)
    out.push('Consider adding a vector database (Pinecone, Weaviate, ChromaDB) for knowledge retrieval in RAG systems');

  if (signals.chunkCount >= 4 && signals.relationshipCount === 0)
    out.push('Improve inter-module cohesion — semantic chunks have no detected cross-domain relationships');

  if (signals.chunkDomainCount <= 2 && signals.chunkCount >= 4)
    out.push('Improve architecture modularity — consolidate related code into distinct domain boundaries');

  return out;
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Phase 6: Inference Engine.
 *
 * Consumes all five upstream phase outputs and produces a deterministic
 * cross-phase synthesis: confidence metrics, pattern detection, agreement checks,
 * and an overall engineering assessment.
 *
 * Returns the standard pipeline contract: { data, meta, dbUpdate }.
 *
 * @param {{ enrichmentData, codeIntelligenceData, fileClassificationData,
 *           semanticChunkingData, intelligenceData, repoMeta }} inputs
 * @returns {Promise<{ data, meta, dbUpdate }>}
 */
async function runInferenceEngine({
  enrichmentData         = null,
  codeIntelligenceData   = null,
  fileClassificationData = null,
  semanticChunkingData   = null,
  intelligenceData       = null,
  repoMeta               = {},
}) {
  const inferredAt = new Date().toISOString();

  const signals = extractCrossPhaseSignals({
    enrichmentData,
    codeIntelligenceData,
    fileClassificationData,
    semanticChunkingData,
    intelligenceData,
  });

  const signalCoverage        = computeSignalCoverage(signals);
  const crossPhaseConsistency = scoreCrossPhaseConsistency(signals);
  const overallConfidence     = computeOverallConfidence(signalCoverage, crossPhaseConsistency);

  const patternsInferred = inferPatterns(signals);

  const crossPhaseSignals = {
    seniorityAgreement:      checkSeniorityAgreement(signals),
    aiMaturityAgreement:     checkAiMaturityAgreement(signals),
    architectureConsistency: checkArchitectureConsistency(signals),
    deploymentConsistency:   checkDeploymentConsistency(signals),
  };

  const overallAssessment = {
    portfolioStrength:   inferPortfolioStrength(signals, overallConfidence),
    engineeringLevel:    inferEngineeringLevel(signals),
    projectMaturity:     deriveProjectMaturity(signals),
    deploymentReadiness: inferDeploymentReadiness(signals),
  };

  const strengths       = deriveStrengths(signals, patternsInferred);
  const recommendations = generateRecommendations(signals);

  const inference = {
    overallAssessment,
    confidence: {
      overall:              overallConfidence,
      signalCoverage,
      crossPhaseConsistency,
    },
    patternsInferred,
    crossPhaseSignals,
    strengths,
    recommendations,
    analysisVersion: ANALYSIS_VERSION,
    inferredAt,
  };

  const meta = {
    totalSignals:     Object.keys(signals).length,
    agreementChecks:  Object.values(crossPhaseSignals).filter(v => v !== null).length,
    inferredPatterns: patternsInferred.length,
    confidenceScore:  overallConfidence,
  };

  return {
    data:     inference,
    meta,
    dbUpdate: {
      inference_json:   inference,
      confidence_score: overallConfidence,
    },
  };
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { runInferenceEngine };
