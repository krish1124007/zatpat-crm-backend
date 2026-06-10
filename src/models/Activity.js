import mongoose from 'mongoose';

// Live activity feed — a human-readable log of meaningful actions employees take
// (case created, status changed, follow-up added, etc.). Shown on the Dashboard.
const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, default: '' },
    action: { type: String, default: '' }, // create | status_change | followup | update | payment
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanCase' },
    srNo: { type: Number },
    customerName: { type: String, default: '' },
    message: { type: String, default: '' }, // e.g. "changed status from Login to Sanction"
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

activitySchema.index({ createdAt: -1 });

export default mongoose.model('Activity', activitySchema);
