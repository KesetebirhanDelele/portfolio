exports.up = pgm => {
  pgm.sql(`
    -- Which pipeline version produced this record.
    -- v1 = legacy README/metadata analysis (analyses table)
    -- v2 = repository intelligence pipeline (deep_analyses table)
    ALTER TABLE deep_analyses
      ADD COLUMN IF NOT EXISTS analysis_version TEXT NOT NULL DEFAULT 'v2';

    -- Human-readable flag: true when produced by a now-deprecated pipeline version.
    -- Set manually or via migration when a newer version supersedes this one.
    ALTER TABLE deep_analyses
      ADD COLUMN IF NOT EXISTS legacy BOOLEAN NOT NULL DEFAULT false;

    -- Flexible JSON bag for run-time metadata that doesn't warrant a dedicated column:
    --   reanalyzeMode, triggeredBy, previousAnalysisId, etc.
    ALTER TABLE deep_analyses
      ADD COLUMN IF NOT EXISTS analysis_metadata_json JSONB;

    -- Index to support efficient version-filtered queries on the history endpoint.
    CREATE INDEX IF NOT EXISTS idx_deep_analyses_version
      ON deep_analyses(repository_id, analysis_version, created_at DESC);
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP INDEX  IF EXISTS idx_deep_analyses_version;
    ALTER TABLE deep_analyses DROP COLUMN IF EXISTS analysis_metadata_json;
    ALTER TABLE deep_analyses DROP COLUMN IF EXISTS legacy;
    ALTER TABLE deep_analyses DROP COLUMN IF EXISTS analysis_version;
  `);
};
