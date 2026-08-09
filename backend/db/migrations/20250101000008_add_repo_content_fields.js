exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE repositories ADD COLUMN description   TEXT;
    ALTER TABLE repositories ADD COLUMN topics        JSONB;
    ALTER TABLE repositories ADD COLUMN readme_content TEXT;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE repositories DROP COLUMN IF EXISTS description;
    ALTER TABLE repositories DROP COLUMN IF EXISTS topics;
    ALTER TABLE repositories DROP COLUMN IF EXISTS readme_content;
  `);
};
