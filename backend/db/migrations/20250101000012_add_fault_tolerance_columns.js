exports.up = pgm => {
  pgm.sql(`
    -- Extend status to allow partial completion
    ALTER TABLE deep_analyses DROP CONSTRAINT IF EXISTS deep_analyses_status_check;
    ALTER TABLE deep_analyses ADD CONSTRAINT deep_analyses_status_check
      CHECK (status IN ('queued','running','completed','partial','failed'));

    -- Per-phase status snapshot: { phaseName: 'completed'|'failed'|'running'|'skipped' }
    ALTER TABLE deep_analyses ADD COLUMN IF NOT EXISTS phase_status_json JSONB;

    -- Structured error data for each failed phase: { phaseName: { message, code, retryable, occurredAt } }
    ALTER TABLE deep_analyses ADD COLUMN IF NOT EXISTS phase_errors_json JSONB;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE deep_analyses DROP COLUMN IF EXISTS phase_errors_json;
    ALTER TABLE deep_analyses DROP COLUMN IF EXISTS phase_status_json;

    ALTER TABLE deep_analyses DROP CONSTRAINT IF EXISTS deep_analyses_status_check;
    ALTER TABLE deep_analyses ADD CONSTRAINT deep_analyses_status_check
      CHECK (status IN ('queued','running','completed','failed'));
  `);
};
