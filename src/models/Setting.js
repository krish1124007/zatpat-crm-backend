import mongoose from 'mongoose';

// Default overdue day-limit per stage. A case sitting in a stage longer than
// its limit is flagged "overdue" on the dashboard. 0 = no limit (never flagged).
// Only the active pipeline stages have a default; closed/terminal stages don't.
export const DEFAULT_SLA_DAYS = {
  'Query': 15,
  'Hold': 7,
  'Ready Login': 7,
  'Bank finalized': 7,
  'Under Bank Workout': 7,
  'Under Login Query': 7,
  'Login done - under process': 10,
  'Sanctioned': 7,
};

const settingSchema = new mongoose.Schema(
  {
    // Singleton document; there is exactly one row with key 'global'.
    key: { type: String, unique: true, default: 'global', index: true },
    // status -> max days allowed in that stage before a case is "overdue".
    slaDaysByStatus: { type: Map, of: Number, default: () => ({ ...DEFAULT_SLA_DAYS }) },
  },
  { timestamps: true }
);

// Fetch (and lazily create) the single global settings document.
settingSchema.statics.getGlobal = async function getGlobal() {
  let doc = await this.findOne({ key: 'global' });
  if (!doc) doc = await this.create({ key: 'global' });
  return doc;
};

export default mongoose.model('Setting', settingSchema);
