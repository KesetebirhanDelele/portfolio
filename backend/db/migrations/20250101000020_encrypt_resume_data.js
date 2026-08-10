// Adds a single, user-level encrypted store for LinkedIn/resume data,
// replacing the per-portfolio content_json.linkedin copy. Rationale: reuse
// across portfolios (M64.2) is only safe to build on top of encryption if
// there's one record to protect and one place to delete — a copy in every
// portfolio's content_json would mean deleting one portfolio doesn't remove
// the resume data duplicated into the others. See PROGRESS.md M64.2.
exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE users ADD COLUMN encrypted_resume_data TEXT;
    ALTER TABLE users ADD COLUMN resume_data_iv TEXT;

    COMMENT ON COLUMN users.encrypted_resume_data IS
      'AES-256-GCM ciphertext (JSON: name/headline/summary/experience/education/certifications/skills), key in RESUME_DATA_ENCRYPTION_KEY env var. Never store plaintext resume data.';
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE users DROP COLUMN IF EXISTS encrypted_resume_data;
    ALTER TABLE users DROP COLUMN IF EXISTS resume_data_iv;
  `);
};
