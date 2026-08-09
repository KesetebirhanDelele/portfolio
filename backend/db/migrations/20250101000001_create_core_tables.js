exports.up = pgm => {
  pgm.sql(`
    CREATE TABLE users (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      email             TEXT        NOT NULL,
      password_hash     TEXT,
      github_user_id    TEXT        UNIQUE,
      name              TEXT,
      headline          TEXT,
      avatar_url        TEXT,
      role              TEXT        NOT NULL DEFAULT 'student'
                                    CHECK (role IN ('student', 'admin', 'recruiter')),
      status            TEXT        NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'suspended', 'pending')),
      email_verified_at TIMESTAMPTZ,
      last_login_at     TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at        TIMESTAMPTZ
    );

    CREATE UNIQUE INDEX idx_users_email ON users (lower(email));

    CREATE TABLE tenants (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name            TEXT        NOT NULL,
      slug            TEXT        UNIQUE NOT NULL,
      plan            TEXT        NOT NULL DEFAULT 'basic'
                                  CHECK (plan IN ('basic', 'pro', 'institutional')),
      branding_config JSONB,
      status          TEXT        NOT NULL DEFAULT 'active',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE memberships (
      id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role      TEXT        NOT NULL DEFAULT 'student'
                            CHECK (role IN ('student', 'admin', 'counselor')),
      status    TEXT        NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, user_id)
    );

    CREATE TABLE sessions (
      id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token_hash TEXT        NOT NULL,
      ip_address         TEXT,
      user_agent         TEXT,
      expires_at         TIMESTAMPTZ NOT NULL,
      revoked_at         TIMESTAMPTZ,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_sessions_user_id           ON sessions(user_id);
    CREATE INDEX idx_sessions_refresh_token_hash ON sessions(refresh_token_hash);
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP TABLE IF EXISTS sessions   CASCADE;
    DROP TABLE IF EXISTS memberships CASCADE;
    DROP TABLE IF EXISTS tenants    CASCADE;
    DROP TABLE IF EXISTS users      CASCADE;
  `);
};
