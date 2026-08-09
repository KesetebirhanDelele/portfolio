exports.up = pgm => {
  pgm.sql(`
    CREATE TABLE analyses (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      repository_id    UUID        NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      model_version    TEXT,
      status           TEXT        NOT NULL DEFAULT 'pending',
      confidence_score NUMERIC(5,4),
      skills_json      JSONB,
      domains_json     JSONB,
      summary_json     JSONB,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at     TIMESTAMPTZ
    );

    CREATE INDEX idx_analyses_repository_id ON analyses(repository_id, created_at DESC);

    CREATE TABLE evidence_refs (
      id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      analysis_id         UUID        NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
      claim_type          TEXT,
      claim_key           TEXT,
      source_path         TEXT,
      source_excerpt_hash TEXT,
      confidence          NUMERIC(5,4),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE generations (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      analysis_id       UUID        NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
      type              TEXT        NOT NULL CHECK (type IN ('summary', 'projects', 'resume')),
      tone              TEXT,
      status            TEXT        NOT NULL DEFAULT 'pending',
      model_version     TEXT,
      prompt_version    TEXT,
      content_json      JSONB,
      validation_status TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at      TIMESTAMPTZ
    );
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP TABLE IF EXISTS generations  CASCADE;
    DROP TABLE IF EXISTS evidence_refs CASCADE;
    DROP TABLE IF EXISTS analyses     CASCADE;
  `);
};
