exports.up = pgm => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS github_accounts (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      github_user_id  TEXT NOT NULL UNIQUE,
      github_username TEXT NOT NULL,
      github_email    TEXT,
      access_token    TEXT,
      avatar_url      TEXT,
      is_primary      BOOLEAN NOT NULL DEFAULT false,
      connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_github_accounts_user_id         ON github_accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_github_accounts_github_user_id  ON github_accounts(github_user_id);

    ALTER TABLE repositories ADD COLUMN IF NOT EXISTS github_account_id UUID REFERENCES github_accounts(id) ON DELETE SET NULL;

    INSERT INTO github_accounts (user_id, github_user_id, github_username, github_email, access_token, avatar_url, is_primary)
    SELECT id, github_user_id, COALESCE(github_username, 'unknown'), email, github_access_token, avatar_url, true
    FROM users
    WHERE github_user_id IS NOT NULL
    ON CONFLICT (github_user_id) DO NOTHING;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE repositories DROP COLUMN IF EXISTS github_account_id;
    DROP TABLE IF EXISTS github_accounts;
  `);
};
