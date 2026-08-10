// Single source of truth for a user's LinkedIn/resume data. Replaces the old
// per-portfolio content_json.linkedin copy (M64.2) — every portfolio a user
// has, past or future, reads the same one encrypted record, and deleting it
// removes it everywhere at once instead of leaving copies stranded in other
// portfolios. See PROGRESS.md M64.2.
const pool = require('../db/postgres');
const { encryptResumeData, decryptResumeData } = require('./resumeDataCrypto');

async function getResumeData(userId) {
  const result = await pool.query(
    'SELECT encrypted_resume_data, resume_data_iv FROM users WHERE id = $1',
    [userId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return decryptResumeData(row.encrypted_resume_data, row.resume_data_iv);
}

async function saveResumeData(userId, resumeObject) {
  const { encryptedResumeData, resumeDataIv } = encryptResumeData(resumeObject);
  await pool.query(
    'UPDATE users SET encrypted_resume_data = $1, resume_data_iv = $2, updated_at = NOW() WHERE id = $3',
    [encryptedResumeData, resumeDataIv, userId]
  );
}

async function deleteResumeData(userId) {
  await pool.query(
    'UPDATE users SET encrypted_resume_data = NULL, resume_data_iv = NULL, updated_at = NOW() WHERE id = $1',
    [userId]
  );
}

module.exports = { getResumeData, saveResumeData, deleteResumeData };
