// Adds a column to persist the dashboard/preview image scraped from a
// Colaberry project page (colaberryProjectScraper.js's extractProjectImage())
// — the scraper already captures this, but routes/colaberryImport.js never
// saved it, so imported Colaberry projects never had an image available for
// the GitHub push cards or the public portfolio page. See PROGRESS.md M64.3.
exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE repositories ADD COLUMN image_url TEXT;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE repositories DROP COLUMN IF EXISTS image_url;
  `);
};
