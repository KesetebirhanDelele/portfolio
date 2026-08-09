exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE deep_analyses
      ADD COLUMN phase_metrics_json JSONB;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE deep_analyses
      DROP COLUMN IF EXISTS phase_metrics_json;
  `);
};
