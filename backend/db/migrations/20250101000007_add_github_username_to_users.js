exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE users ADD COLUMN github_username TEXT UNIQUE;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE users DROP COLUMN IF EXISTS github_username;
  `);
};
