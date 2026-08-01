/**
 * One-time migration: move untouched 'Query' cases to the new 'New Inquiry'
 * status, so the New Inquiry page shows fresh leads instead of query-stage work.
 *
 * Only cases that have NEVER moved past their first status are converted
 * (statusHistory has at most one entry) and that show no bank / login progress —
 * anything already being worked on stays in Query.
 *
 * Dry run (default):  node src/scripts/migrateNewInquiry.js
 * Apply changes:      node src/scripts/migrateNewInquiry.js --apply
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import LoanCase from '../models/LoanCase.js';

const APPLY = process.argv.includes('--apply');

const FILTER = {
  currentStatus: 'Query',
  isDeleted: { $ne: true },
  loginDate: null,
  'statusHistory.1': { $exists: false },
  $or: [{ bankName: '' }, { bankName: null }, { bankName: { $exists: false } }],
};

async function run() {
  await connectDB();

  const candidates = await LoanCase.find(FILTER).select('srNo customerName').lean();
  console.log(`[migrate] ${candidates.length} untouched 'Query' case(s) match:`);
  for (const c of candidates) {
    console.log(`  #${c.srNo}  ${c.customerName}`);
  }

  if (!APPLY) {
    console.log('\n[migrate] DRY RUN - nothing changed. Re-run with --apply to update.');
  } else {
    const ids = candidates.map((c) => c._id);
    const r = await LoanCase.updateMany({ _id: { $in: ids } }, { $set: { currentStatus: 'New Inquiry' } });
    // The first history row is the same (never-changed) status, so relabel it too.
    await LoanCase.updateMany(
      { _id: { $in: ids }, 'statusHistory.0.status': 'Query' },
      { $set: { 'statusHistory.0.status': 'New Inquiry' } }
    );
    console.log(`\n[migrate] updated ${r.modifiedCount} case(s) to 'New Inquiry'.`);
  }

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error('[migrate] failed:', e);
  process.exit(1);
});
