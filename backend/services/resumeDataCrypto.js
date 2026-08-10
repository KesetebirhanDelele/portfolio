// Thin, readable wrappers around the shared AES-256-GCM helpers, specific to
// stored LinkedIn/resume data. Mirrors githubTokenCrypto.js's shape, with its
// own dedicated key (RESUME_DATA_ENCRYPTION_KEY) — kept separate from
// GITHUB_TOKEN_ENCRYPTION_KEY so a leak of one key doesn't expose the other
// class of data. See PROGRESS.md M64.2.
const { encrypt, decrypt } = require('./encryption');

function requireKey() {
  const key = process.env.RESUME_DATA_ENCRYPTION_KEY;
  if (!key) throw new Error('RESUME_DATA_ENCRYPTION_KEY is not configured.');
  return key;
}

// resumeObject: the extracted LinkedIn/resume JSON (name, headline, summary,
// experience[], education[], certifications[], skills[]). Returns
// { encryptedResumeData, resumeDataIv } — matches the two-column pattern.
function encryptResumeData(resumeObject) {
  const { payload, iv } = encrypt(JSON.stringify(resumeObject), requireKey());
  return { encryptedResumeData: payload, resumeDataIv: iv };
}

// Returns the parsed resume object, or null if either column is empty (no
// resume on file) rather than throwing.
function decryptResumeData(encryptedResumeData, resumeDataIv) {
  if (!encryptedResumeData || !resumeDataIv) return null;
  return JSON.parse(decrypt(encryptedResumeData, resumeDataIv, requireKey()));
}

module.exports = { encryptResumeData, decryptResumeData };
