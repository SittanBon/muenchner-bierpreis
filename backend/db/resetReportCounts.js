// One-off, idempotent: recomputes `beers.reports` for every beer from real
// approved submissions (COUNT(*) matched by venue_id + brand — see
// database.resetReportCounts). Fixes two sources of invented numbers: the
// seed data's literal `reports: N` values, and any row a past drifted
// increment left wrong (the "N reports" badge used to bump a stored counter
// on every approval instead of counting real submissions).
//
//   node backend/db/resetReportCounts.js   (also runs on every server boot,
//                                            right after removeSeededSubmissions)
//
// Matches submissions to a beer by (venue_id, brand) — there is no beer_id
// column on `submissions`, so this is the same pairing getBeerHistory and
// applyApprovedPrice already use. Before writing it takes a consistent
// backup (`<db>.pre-reset-report-counts-<ts>.bak`, gitignored); if the backup
// fails nothing is updated. Once every row already matches, a boot is a
// silent no-op, so it can't touch anything a later approval already set
// correctly.
require('dotenv').config();
const { db, logAdminAction, resetReportCounts } = require('./database');

function run() {
  try {
    const result = resetReportCounts();
    if (result.updated > 0) {
      logAdminAction('RESET_REPORT_COUNTS', {
        performedBy: 'system',
        details: { updated: result.updated, backup: result.backup },
      });
      console.log(`🔢 Recomputed "reports" from real approved submissions on ${result.updated} beer(s) (backup: ${result.backup})`);
    }
    return result;
  } catch (err) {
    // A failed backup/update must never stop the server from booting.
    console.error(`⚠️  Report-count reset skipped: ${err.message}`);
    return { updated: 0, backup: null, error: err.message };
  }
}

module.exports = { run };

if (require.main === module) {
  const r = run();
  console.log(r.updated === 0 && !r.error ? 'Nothing to reset.' : r);
  db.close();
}
