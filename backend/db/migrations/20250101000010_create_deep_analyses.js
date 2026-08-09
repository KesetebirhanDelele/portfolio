exports.up = pgm => {
  pgm.sql(`
    CREATE TABLE deep_analyses (
      id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      repository_id          UUID        NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      status                 TEXT        NOT NULL DEFAULT 'queued'
                                         CHECK (status IN ('queued','running','completed','failed')),
      pipeline_version       TEXT        NOT NULL DEFAULT '1.0',

      -- Phase checkpoint columns (stored as each phase completes)
      github_enrichment_json JSONB,
      code_intelligence_json JSONB,
      file_manifest_json     JSONB,
      semantic_chunks_json   JSONB,

      -- Final merged intelligence output from all agents
      intelligence_json      JSONB,

      model_version          TEXT,
      confidence_score       NUMERIC(5,4),
      tokens_used            INTEGER,
      duration_ms            INTEGER,
      error_message          TEXT,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at           TIMESTAMPTZ
    );

    CREATE INDEX idx_deep_analyses_repo
      ON deep_analyses(repository_id, created_at DESC);
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP INDEX  IF EXISTS idx_deep_analyses_repo;
    DROP TABLE  IF EXISTS deep_analyses;
  `);
};
