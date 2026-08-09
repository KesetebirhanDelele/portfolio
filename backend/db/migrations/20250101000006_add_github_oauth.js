exports.up = pgm => {
  pgm.sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS github_access_token TEXT`);
};

exports.down = pgm => {
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS github_access_token`);
};
