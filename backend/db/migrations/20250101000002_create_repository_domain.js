exports.up = pgm => {
  pgm.sql(`
    CREATE TABLE repositories (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tenant_id        UUID        REFERENCES tenants(id) ON DELETE SET NULL,
      provider         TEXT        NOT NULL DEFAULT 'github',
      external_repo_id TEXT        NOT NULL,
      name             TEXT        NOT NULL,
      full_name        TEXT        NOT NULL,
      private          BOOLEAN     NOT NULL DEFAULT FALSE,
      default_branch   TEXT,
      primary_language TEXT,
      stars_count      INTEGER     NOT NULL DEFAULT 0,
      forks_count      INTEGER     NOT NULL DEFAULT 0,
      repo_created_at  TIMESTAMPTZ,
      repo_updated_at  TIMESTAMPTZ,
      imported_at      TIMESTAMPTZ,
      sync_status      TEXT        NOT NULL DEFAULT 'pending',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (provider, external_repo_id)
    );

    CREATE INDEX idx_repositories_user_id ON repositories(user_id, created_at DESC);

    CREATE TABLE import_jobs (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      repository_id UUID        NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      status        TEXT        NOT NULL DEFAULT 'queued'
                                CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
      progress_pct  INTEGER     DEFAULT 0,
      error_code    TEXT,
      error_message TEXT,
      started_at    TIMESTAMPTZ,
      completed_at  TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_import_jobs_status ON import_jobs(status, created_at);
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP TABLE IF EXISTS import_jobs  CASCADE;
    DROP TABLE IF EXISTS repositories CASCADE;
  `);
};
