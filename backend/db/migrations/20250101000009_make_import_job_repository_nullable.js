exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE import_jobs ALTER COLUMN repository_id DROP NOT NULL;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE import_jobs ALTER COLUMN repository_id SET NOT NULL;
  `);
};
