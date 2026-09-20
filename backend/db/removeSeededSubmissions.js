// One-off, idempotent: deletes the fabricated "seeded price-trend history"
// submissions (36 of them in a seeded database — a `Community` reporter, note
// 'seeded price-trend history', invented month-by-month prices). They were never
// customer reports, yet the public Price Trends chart was built on them.
//
//   node backend/db/removeSeededSubmissions.js   (also runs on every server boot)
//
// Matches on the note only: the `submissions` table has no source_type column
// (a 'SEED_ESTIMATE' value was never stored anywhere). Real approved
// submissions — including the QA/“Anonym” ones — are untouched. Before deleting
// it writes a consistent backup (`<db>.pre-remove-seeded-submissions-<ts>.bak`,
// gitignored); if the backup fails nothing is deleted. Once nothing matches, a
// boot is a silent no-op, so it can't touch anything a human adds later.
require('dotenv').config();
const { db, logAdminAction, removeSeededSubmissions } = require('./database');

function run() {
  try {
    const result = removeSeededSubmissions();
    if (result.deleted > 0) {
      logAdminAction('DELETE_SEEDED_SUBMISSIONS', {
        performedBy: 'system',
        details: { deleted: result.deleted, ids: result.ids, backup: result.backup },
      });
      console.log(`🧹 Removed ${result.deleted} fabricated "seeded price-trend history" submissions (backup: ${result.backup})`);
    }
    return result;
  } catch (err) {
    // A failed backup/delete must never stop the server from booting.
    console.error(`⚠️  Seeded-submission cleanup skipped: ${err.message}`);
    return { deleted: 0, ids: [], backup: null, error: err.message };
  }
}

module.exports = { run };

if (require.main === module) {
  const r = run();
  console.log(r.deleted === 0 && !r.error ? 'Nothing to remove.' : r);
  db.close();
}
