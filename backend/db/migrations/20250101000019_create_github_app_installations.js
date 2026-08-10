// github_app_installations was referenced by routes/githubApp.js and
// services/githubTokenResolver.js but never had a migration — getAppInstallations()
// threw "relation does not exist" on every call, which took down the entire
// GET /api/repos route (unguarded call, caught by the outer try/catch as a
// generic 500) including the primary-account fetch that had already succeeded.
// See PROGRESS.md M56.
exports.up = pgm => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS github_app_installations (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      installation_id     TEXT NOT NULL UNIQUE,
      account_login       TEXT NOT NULL,
      account_type        TEXT NOT NULL,
      account_avatar_url  TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_github_app_installations_user_id ON github_app_installations(user_id);
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP TABLE IF EXISTS github_app_installations;
  `);
};
