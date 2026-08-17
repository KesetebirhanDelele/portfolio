exports.up = pgm => {
  pgm.sql(`
    CREATE TABLE openai_usage_events (
      id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      call_type          TEXT        NOT NULL,
      model              TEXT        NOT NULL,
      prompt_tokens      INTEGER,
      completion_tokens  INTEGER,
      total_tokens       INTEGER,
      duration_ms        INTEGER     NOT NULL,
      outcome            TEXT        NOT NULL CHECK (outcome IN ('success','failure')),
      error_class        TEXT,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_openai_usage_events_created   ON openai_usage_events(created_at DESC);
    CREATE INDEX idx_openai_usage_events_call_type ON openai_usage_events(call_type);
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_openai_usage_events_call_type;
    DROP INDEX IF EXISTS idx_openai_usage_events_created;
    DROP TABLE IF EXISTS openai_usage_events;
  `);
};
