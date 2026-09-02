import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const CRM_COLLECTIONS = [
  'users',
  'loancases',
  'partners',
  'invoices',
  'expenses',
  'salaries',
  'insurances',
  'contests',
  'ipwhitelists',
  'activities',
  'auditlogs',
  'counters',
  'dropdownoptions',
  'gstpayments',
  'settings',
];

const TARGET_INDEXES = {
  users: [
    {
      key: { email: 1 },
      options: { name: 'email_1', unique: true, partialFilterExpression: { email: { $type: 'string' } } },
    },
    {
      key: { phone: 1 },
      options: { name: 'phone_1', unique: true, partialFilterExpression: { phone: { $type: 'string' } } },
    },
    {
      key: { username: 1 },
      options: { name: 'username_1', unique: true, partialFilterExpression: { username: { $type: 'string' } } },
    },
  ],
};

/**
 * Transfers CRM collections from source DB to target DB.
 *
 * @param {Object} opts
 * @param {string} opts.sourceUri - Connection URI for source MongoDB
 * @param {string} opts.targetUri - Connection URI for target MongoDB
 * @param {string[]} [opts.collections] - Optional list of collections (defaults to CRM_COLLECTIONS)
 * @param {boolean} [opts.dryRun=false] - If true, counts documents without writing
 * @returns {Promise<Object>} Summary of transfer results
 */
export async function executeTransfer({
  sourceUri = process.env.MONGODB_URI,
  targetUri,
  collections = CRM_COLLECTIONS,
  dryRun = false,
}) {
  if (!sourceUri) throw new Error('Source MONGODB_URI is required.');
  if (!targetUri) throw new Error('Target MONGODB_URI is required.');
  if (sourceUri === targetUri) throw new Error('Source and Target MongoDB URIs must be different.');

  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);

  try {
    await sourceClient.connect();
    await targetClient.connect();

    const sourceDb = sourceClient.db();
    const targetDb = targetClient.db();

    const results = [];
    let totalTransferred = 0;

    for (const colName of collections) {
      const sourceCol = sourceDb.collection(colName);
      const docs = await sourceCol.find({}).toArray();
      const count = docs.length;

      if (dryRun) {
        results.push({ collection: colName, count, status: 'dry-run' });
        continue;
      }

      const targetCol = targetDb.collection(colName);

      if (count > 0) {
        // Clear target collection first to prevent duplicate key errors on rerun
        await targetCol.deleteMany({});
        
        // Bulk insert to preserve ObjectIds, dates, BSON types
        const insertRes = await targetCol.insertMany(docs);
        const insertedCount = insertRes.insertedCount;
        totalTransferred += insertedCount;

        results.push({ collection: colName, count: insertedCount, status: 'success' });
      } else {
        results.push({ collection: colName, count: 0, status: 'skipped (empty)' });
      }

      // Recreate custom or predefined indexes for collection
      if (TARGET_INDEXES[colName]) {
        for (const ix of TARGET_INDEXES[colName]) {
          try {
            await targetCol.createIndex(ix.key, ix.options);
          } catch (e) {
            console.warn(`[index-warn] ${colName} index ${ix.options?.name}:`, e.message);
          }
        }
      }
    }

    return {
      success: true,
      dryRun,
      sourceDatabase: sourceDb.databaseName,
      targetDatabase: targetDb.databaseName,
      totalTransferred,
      collections: results,
    };
  } finally {
    await sourceClient.close().catch(() => {});
    await targetClient.close().catch(() => {});
  }
}

// Support CLI execution: node src/scripts/transferDatabase.js --target="mongodb+srv://..."
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const getArg = (flag) => {
    const match = process.argv.find((a) => a.startsWith(`${flag}=`));
    if (match) return match.split('=').slice(1).join('=');
    const idx = process.argv.indexOf(flag);
    if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
    return null;
  };

  const targetUri = getArg('--target') || process.env.TARGET_MONGODB_URI;
  const dryRun = process.argv.includes('--dry-run');

  if (!targetUri) {
    console.error('Error: Please specify target MongoDB URI using --target="<mongodb_uri>"');
    console.error('Example: node src/scripts/transferDatabase.js --target="mongodb+srv://user:pass@cluster.mongodb.net/zatpat_crm"');
    process.exit(1);
  }

  console.log(`Starting Database Transfer...`);
  console.log(`Dry Run Mode: ${dryRun ? 'YES' : 'NO'}`);

  executeTransfer({ targetUri, dryRun })
    .then((res) => {
      console.log('\n--- Transfer Summary ---');
      console.log(`Source DB: ${res.sourceDatabase}`);
      console.log(`Target DB: ${res.targetDatabase}`);
      console.table(res.collections);
      console.log(`\nTotal Documents Transferred: ${res.totalTransferred}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('\nTransfer Failed:', err.message);
      process.exit(1);
    });
}
