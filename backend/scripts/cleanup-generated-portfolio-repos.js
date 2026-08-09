// One-off cleanup: removes already-imported repos that are actually
// Portfolioforge-generated portfolios (markdown/narrative, not source code),
// imported into R2R BEFORE the guardrail existed (see PROGRESS.md M47.3/M48).
// The guardrail only prevents *future* imports — it can't retroactively catch
// rows already in the DB, since Portfolioforge never set the topic marker
// that the guardrail checks for.
//
// Dry-run by default — lists candidates without deleting anything. Pass
// --confirm to actually delete. Per CLAUDE.md's Intern Safety Rules: no
// destructive scripts without confirmation.
//
// Usage:
//   node scripts/cleanup-generated-portfolio-repos.js                 # dry run
//   node scripts/cleanup-generated-portfolio-repos.js --confirm       # actually delete
//   node scripts/cleanup-generated-portfolio-repos.js --full-name=kalii --confirm

require('dotenv').config();
const pool = require('../db/postgres');

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const fullNameArg = args.find(a => a.startsWith('--full-name='))?.split('=')[1];

// Known generated-portfolio repo(s) found before the guardrail existed.
// Add more full_name values here if other pre-guardrail imports turn up.
const KNOWN_GENERATED_PORTFOLIO_NAMES = fullNameArg ? [fullNameArg] : ['kalii'];

async function main() {
  console.log(`[cleanup] Mode: ${confirm ? 'DELETE (--confirm passed)' : 'DRY RUN (pass --confirm to actually delete)'}`);
  console.log(`[cleanup] Looking for repositories named:`, KNOWN_GENERATED_PORTFOLIO_NAMES);

  const candidates = await pool.query(
    `SELECT id, user_id, provider, name, full_name, imported_at
     FROM repositories
     WHERE provider = 'github' AND name = ANY($1::text[])`,
    [KNOWN_GENERATED_PORTFOLIO_NAMES]
  );

  if (candidates.rows.length === 0) {
    console.log('[cleanup] No matching repositories found. Nothing to do.');
    process.exit(0);
  }

  console.log(`[cleanup] Found ${candidates.rows.length} candidate(s):`);
  for (const row of candidates.rows) {
    console.log(`  - id=${row.id} user_id=${row.user_id} full_name=${row.full_name} imported_at=${row.imported_at}`);
  }

  if (!confirm) {
    console.log('\n[cleanup] Dry run only — nothing deleted. Re-run with --confirm to delete these rows.');
    process.exit(0);
  }

  for (const row of candidates.rows) {
    // ON DELETE CASCADE on analyses/deep_analyses/import_jobs handles the rest.
    await pool.query('DELETE FROM repositories WHERE id = $1', [row.id]);
    console.log(`[cleanup] Deleted repository ${row.id} (${row.full_name})`);
  }

  console.log(`[cleanup] Done — deleted ${candidates.rows.length} repository row(s).`);
  process.exit(0);
}

main().catch(err => {
  console.error('[cleanup] Failed:', err.message);
  process.exit(1);
});
