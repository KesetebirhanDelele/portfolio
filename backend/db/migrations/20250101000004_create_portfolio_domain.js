exports.up = pgm => {
  pgm.sql(`
    CREATE TABLE portfolios (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tenant_id    UUID        REFERENCES tenants(id) ON DELETE SET NULL,
      title        TEXT        NOT NULL,
      slug         TEXT        UNIQUE NOT NULL,
      theme        TEXT        DEFAULT 'default',
      status       TEXT        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'published', 'archived')),
      visibility   TEXT        NOT NULL DEFAULT 'private'
                               CHECK (visibility IN ('private', 'public', 'unlisted')),
      content_json JSONB,
      published_at TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_portfolios_user_id ON portfolios(user_id, updated_at DESC);

    CREATE TABLE portfolio_versions (
      id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      portfolio_id        UUID        NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
      version_number      INTEGER     NOT NULL,
      content_json        JSONB,
      created_by_user_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (portfolio_id, version_number)
    );
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP TABLE IF EXISTS portfolio_versions CASCADE;
    DROP TABLE IF EXISTS portfolios         CASCADE;
  `);
};
