// Replaces plaintext GitHub OAuth token storage with AES-256-GCM encrypted
// columns. Existing plaintext tokens are dropped (not migrated in place) —
// this is dev/test data with no production users yet; anyone affected just
// needs to log in / reconnect their account again once this ships.
exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE users ADD COLUMN encrypted_github_access_token TEXT;
    ALTER TABLE users ADD COLUMN github_access_token_iv TEXT;
    ALTER TABLE users DROP COLUMN IF EXISTS github_access_token;

    ALTER TABLE github_accounts ADD COLUMN encrypted_access_token TEXT;
    ALTER TABLE github_accounts ADD COLUMN access_token_iv TEXT;
    ALTER TABLE github_accounts DROP COLUMN IF EXISTS access_token;

    COMMENT ON COLUMN users.encrypted_github_access_token IS
      'AES-256-GCM ciphertext, key in GITHUB_TOKEN_ENCRYPTION_KEY env var. Never store plaintext GitHub tokens.';
    COMMENT ON COLUMN github_accounts.encrypted_access_token IS
      'AES-256-GCM ciphertext, key in GITHUB_TOKEN_ENCRYPTION_KEY env var. Never store plaintext GitHub tokens.';
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS github_access_token TEXT;
    ALTER TABLE users DROP COLUMN IF EXISTS encrypted_github_access_token;
    ALTER TABLE users DROP COLUMN IF EXISTS github_access_token_iv;

    ALTER TABLE github_accounts ADD COLUMN IF NOT EXISTS access_token TEXT;
    ALTER TABLE github_accounts DROP COLUMN IF EXISTS encrypted_access_token;
    ALTER TABLE github_accounts DROP COLUMN IF EXISTS access_token_iv;
  `);
};
