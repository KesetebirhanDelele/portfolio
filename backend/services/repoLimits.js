'use strict';

// ── Hard limits ───────────────────────────────────────────────────────────────
// All numeric safety thresholds in one place. Change here, applies everywhere.

const LIMITS = {
  // File selection
  MAX_FILES_SCANNED:        60,          // maximum files whose content we fetch
  MAX_FILE_SIZE_BYTES:      100_000,     // 100 KB — skip any single file above this
  MAX_LOCKFILE_BYTES:       5_000,       // 5 KB  — skip lockfiles above this
  MAX_LINES_PER_FILE:       200,         // truncate content to first N lines

  // Total payload cap (sum of all fetched file content, decoded bytes)
  MAX_TOTAL_PAYLOAD_BYTES:  2_000_000,   // 2 MB across all files combined

  // Tree size — if the recursive tree has more entries than this,
  // we fall back to top-level-only traversal rather than bailing entirely.
  MAX_TREE_ENTRIES:         10_000,

  // Timeout for the entire enrichment phase (ms)
  ENRICHMENT_TIMEOUT_MS:    30_000,      // 30 seconds
};

// ── Excluded directory segments ───────────────────────────────────────────────
// Any path segment (not just root-level) that matches disqualifies the file.
// Checked against every '/' delimited part of the path except the filename.

const EXCLUDED_DIR_SEGMENTS = new Set([
  // JavaScript / Node
  'node_modules',
  'bower_components',
  'jspm_packages',

  // Build outputs
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.output',
  '.svelte-kit',
  'storybook-static',
  '.docusaurus',

  // Caches
  '.cache',
  '.turbo',
  '.parcel-cache',
  '.eslintcache',

  // Version control
  '.git',

  // Test coverage
  'coverage',
  '.nyc_output',
  'htmlcov',

  // Python
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.venv',
  'venv',
  'env',
  '.eggs',

  // Ruby / PHP / Go
  'vendor',
  '.bundle',

  // Java / Kotlin / Gradle / Maven
  '.gradle',
  'target',
  'bin',
  'obj',

  // Deployment / infra generated
  '.vercel',
  '.netlify',
  '.serverless',
  'cdk.out',
  'terraform.tfstate.d',
]);

// ── Binary / non-code extensions ──────────────────────────────────────────────
// Files with these extensions are never fetched — no size check needed.

const BINARY_EXTENSIONS = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
  '.bmp', '.tiff', '.tif', '.avif', '.heic', '.heif', '.raw', '.svg',

  // Video / Audio
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv',
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma',

  // Fonts
  '.woff', '.woff2', '.ttf', '.eot', '.otf',

  // Archives
  '.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.rar', '.war', '.jar',

  // Compiled / native binaries
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.o', '.a', '.lib', '.out',
  '.class', '.pyc', '.pyd', '.pyo', '.wasm',

  // Data / ML artifacts
  '.sqlite', '.db', '.mdb', '.accdb',
  '.parquet', '.feather', '.pkl', '.h5', '.hdf5',
  '.npy', '.npz', '.pt', '.pth', '.onnx', '.pb',

  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',

  // Secrets / certificates (never read)
  '.pem', '.key', '.crt', '.cert', '.p12', '.pfx', '.der', '.jks',

  // Source maps — large, machine-generated, not useful
  '.map',

  // Misc binary
  '.DS_Store', '.ico', '.cur',
]);

// ── Lockfile names ────────────────────────────────────────────────────────────
// These are skipped entirely if their size exceeds MAX_LOCKFILE_BYTES.
// They are auto-generated and provide no intelligence signal worth the payload.

const LOCKFILE_NAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'Gemfile.lock',
  'composer.lock',
  'poetry.lock',
  'Pipfile.lock',
  'Cargo.lock',
  'cargo.lock',
  'mix.lock',
  'pubspec.lock',
  'gradle.lockfile',
  'flake.lock',
]);

// ── Generated / minified file patterns ───────────────────────────────────────
// Matched against the full relative path.

const GENERATED_PATTERNS = [
  /\.min\.(js|css)$/i,
  /\.bundle\.(js|css)$/i,
  /\.chunk\.[a-f0-9]+\.(js|css)$/i,   // webpack content-hashed chunks
  /\.[a-f0-9]{8,}\.(js|css)$/i,       // general content-hash suffix
  /-(legacy|polyfill|vendor)\.(js|css)$/i,
];

// ── Path-level filter ─────────────────────────────────────────────────────────

/**
 * Determines whether a file path should be skipped based on its path alone,
 * before any network request is made. Checks directory segments, extension,
 * and generated-file patterns.
 *
 * @param {string} filePath  — relative path from repo root, e.g. "src/routes/auth.js"
 * @returns {{ skip: boolean, reason: string | null }}
 */
function shouldSkipPath(filePath) {
  const segments = filePath.split('/');
  const filename = segments[segments.length - 1];

  // Check every directory segment (not the filename)
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (EXCLUDED_DIR_SEGMENTS.has(seg)) {
      return { skip: true, reason: 'excluded_directory' };
    }
    // Python egg-info directories: any segment ending in .egg-info
    if (seg.endsWith('.egg-info')) {
      return { skip: true, reason: 'excluded_directory' };
    }
  }

  // Binary extension check
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex !== -1) {
    const ext = filename.slice(dotIndex).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) {
      return { skip: true, reason: 'binary_extension' };
    }
  }

  // Generated / minified file check
  if (GENERATED_PATTERNS.some(p => p.test(filePath))) {
    return { skip: true, reason: 'generated_file' };
  }

  return { skip: false, reason: null };
}

// ── File-level filter (requires size) ────────────────────────────────────────

/**
 * Determines whether a file should be fetched given its path and byte size
 * (available from the GitHub tree API's `size` field).
 *
 * @param {{ filePath: string, sizeBytes: number }}
 * @returns {{ skip: boolean, reason: string | null }}
 */
function shouldSkipFile({ filePath, sizeBytes }) {
  const pathResult = shouldSkipPath(filePath);
  if (pathResult.skip) return pathResult;

  const filename = filePath.split('/').pop();

  if (LOCKFILE_NAMES.has(filename) && sizeBytes > LIMITS.MAX_LOCKFILE_BYTES) {
    return { skip: true, reason: 'lockfile_too_large' };
  }

  if (sizeBytes > LIMITS.MAX_FILE_SIZE_BYTES) {
    return { skip: true, reason: 'file_too_large' };
  }

  return { skip: false, reason: null };
}

// ── Content truncation ────────────────────────────────────────────────────────

/**
 * Truncates file content to MAX_LINES_PER_FILE.
 *
 * @param {string} rawContent
 * @returns {{ content: string, truncated: boolean, originalLines: number }}
 */
function truncateToLineLimit(rawContent) {
  const lines = rawContent.split('\n');
  const originalLines = lines.length;
  const truncated = originalLines > LIMITS.MAX_LINES_PER_FILE;
  return {
    content: truncated ? lines.slice(0, LIMITS.MAX_LINES_PER_FILE).join('\n') : rawContent,
    truncated,
    originalLines,
  };
}

// ── Payload tracker ───────────────────────────────────────────────────────────

/**
 * Returns a stateful counter the enricher uses to track cumulative payload
 * size across all fetched files. Call add() after each fetch; check
 * isExceeded() before the next one.
 *
 * @returns {{ add: (bytes: number) => void, isExceeded: () => boolean, bytes: number }}
 */
function createPayloadTracker() {
  let total = 0;
  return {
    add(bytes)    { total += bytes; },
    isExceeded()  { return total > LIMITS.MAX_TOTAL_PAYLOAD_BYTES; },
    get bytes()   { return total; },
    get remaining() { return Math.max(0, LIMITS.MAX_TOTAL_PAYLOAD_BYTES - total); },
  };
}

// ── Timeout wrapper ───────────────────────────────────────────────────────────

/**
 * Races a promise against ENRICHMENT_TIMEOUT_MS.
 * Rejects with { code: 'ENRICHMENT_TIMEOUT' } if the timeout fires first.
 *
 * @param {Promise<any>} promise
 * @returns {Promise<any>}
 */
function withEnrichmentTimeout(promise) {
  const timeout = new Promise((_, reject) =>
    setTimeout(
      () => reject(Object.assign(new Error('Enrichment timed out'), { code: 'ENRICHMENT_TIMEOUT' })),
      LIMITS.ENRICHMENT_TIMEOUT_MS,
    )
  );
  return Promise.race([promise, timeout]);
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  LIMITS,
  EXCLUDED_DIR_SEGMENTS,
  BINARY_EXTENSIONS,
  LOCKFILE_NAMES,
  shouldSkipPath,
  shouldSkipFile,
  truncateToLineLimit,
  createPayloadTracker,
  withEnrichmentTimeout,
};
