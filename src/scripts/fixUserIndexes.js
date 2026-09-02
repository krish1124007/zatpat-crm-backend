/**
 * Repairs the unique indexes on the `users` collection.
 *
 * The CRM shares its database with an older application, and both keep their
 * accounts in `users`. The two document shapes have no fields in common:
 *
 *   legacy app -> { username, password, branch, expoToken }
 *   CRM        -> { name, email, phone, password, role, ... }
 *
 * The legacy app left a plain `unique` index on `username`. CRM users have no
 * username, so Mongo indexed every one of them as null and rejected all but the
 * first — which is why creating a second CRM user failed with E11000, surfaced
 * in the UI as "Email or phone already in use". The same trap applies in
 * reverse to the CRM's own email/phone indexes, since legacy documents have
 * neither field.
 *
 * The fix is to scope each unique index to the documents that actually carry
 * the field, using a partial filter. Uniqueness is fully preserved for both
 * apps; only the null-vs-null collisions between them go away.
 *
 * Safe to re-run: an index already in the right shape is left alone.
 *
 * Dry run (default):  node src/scripts/fixUserIndexes.js
 * Apply changes:      node src/scripts/fixUserIndexes.js --apply
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';

const APPLY = process.argv.includes('--apply');

const WANTED = [
  {
    name: 'username_1',
    key: { username: 1 },
    options: {
      unique: true,
      partialFilterExpression: { username: { $type: 'string' } },
    },
    note: "legacy app's index — narrowed so CRM users (no username) are exempt",
  },
  {
    name: 'email_1',
    key: { email: 1 },
    options: {
      unique: true,
      partialFilterExpression: { email: { $type: 'string' } },
    },
    note: 'CRM email uniqueness',
  },
  {
    name: 'phone_1',
    key: { phone: 1 },
    options: {
      unique: true,
      partialFilterExpression: { phone: { $type: 'string' } },
    },
    note: 'CRM phone uniqueness',
  },
];

function matches(existing, wanted) {
  return (
    existing.unique === true &&
    JSON.stringify(existing.key) === JSON.stringify(wanted.key) &&
    JSON.stringify(existing.partialFilterExpression) ===
      JSON.stringify(wanted.options.partialFilterExpression)
  );
}

// Refuses to build a unique index that the current data would violate, so a
// real duplicate is reported rather than half-applied.
async function reportDuplicates(col, field) {
  const dupes = await col
    .aggregate([
      { $match: { [field]: { $type: 'string' } } },
      { $group: { _id: `$${field}`, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();
  if (dupes.length) {
    console.log(
      `  ! ${dupes.length} duplicate ${field} value(s) already in the data: ` +
        dupes.map((d) => `${d._id} (x${d.n})`).join(', ')
    );
    console.log('    Resolve these first — the unique index cannot be built.');
  }
  return dupes.length === 0;
}

async function run() {
  await connectDB();
  const col = mongoose.connection.db.collection('users');

  const existing = await col.indexes();
  console.log('[indexes] before:');
  for (const ix of existing) console.log('  ', JSON.stringify(ix));
  console.log('');

  for (const wanted of WANTED) {
    const current = existing.find((ix) => ix.name === wanted.name);

    if (current && matches(current, wanted)) {
      console.log(`[skip] ${wanted.name} is already correct`);
      continue;
    }

    const field = Object.keys(wanted.key)[0];
    if (!(await reportDuplicates(col, field))) continue;

    if (!APPLY) {
      console.log(
        `[dry-run] would ${current ? 'drop and rebuild' : 'create'} ${wanted.name} ` +
          `as a partial unique index — ${wanted.note}`
      );
      continue;
    }

    if (current) {
      await col.dropIndex(wanted.name);
      console.log(`[drop] ${wanted.name}`);
    }
    await col.createIndex(wanted.key, { name: wanted.name, ...wanted.options });
    console.log(`[create] ${wanted.name} — ${wanted.note}`);
  }

  if (APPLY) {
    console.log('\n[indexes] after:');
    for (const ix of await col.indexes()) console.log('  ', JSON.stringify(ix));
  } else {
    console.log('\nDry run only. Re-run with --apply to make these changes.');
  }

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
