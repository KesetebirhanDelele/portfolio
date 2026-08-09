exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE repositories ADD COLUMN is_portfolio_export BOOLEAN NOT NULL DEFAULT FALSE;

    COMMENT ON COLUMN repositories.is_portfolio_export IS
      'TRUE when this GitHub repo was created BY this platform''s publish-portfolio feature (a generated markdown portfolio, not a source project). Excluded from Browse/import for deep analysis to prevent re-analyzing already-generated output as if it were a new project.';

    CREATE INDEX idx_repositories_portfolio_export ON repositories(user_id, is_portfolio_export);
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_repositories_portfolio_export;
    ALTER TABLE repositories DROP COLUMN IF EXISTS is_portfolio_export;
  `);
};
