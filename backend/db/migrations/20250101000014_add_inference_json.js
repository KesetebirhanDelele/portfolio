exports.up = pgm => {
  pgm.sql(`
    -- Phase 6 (Inference Engine) output: cross-phase synthesis, confidence metrics,
    -- pattern detection, and overall assessment. Separate from intelligence_json
    -- (Phase 5) to keep each phase's output independently addressable.
    ALTER TABLE deep_analyses
      ADD COLUMN IF NOT EXISTS inference_json JSONB;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE deep_analyses DROP COLUMN IF EXISTS inference_json;
  `);
};
