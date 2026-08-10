// Caches the AI-generated project case study (businessProblem, objectives,
// tools, workflow, keyInsights, businessImpact) used to build each project's
// project-*/README.md on GitHub publish — the Kalkidan-parity feature (M65).
// Cached per repository so republishing an unchanged project doesn't re-call
// OpenAI every time.
exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE repositories ADD COLUMN case_study_json JSONB;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE repositories DROP COLUMN IF EXISTS case_study_json;
  `);
};
