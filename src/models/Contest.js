import mongoose from 'mongoose';

export const CONTEST_METRICS = ['DisbursedCount', 'DisbursedAmount', 'CommissionEarned'];
export const CONTEST_STATUSES = ['Draft', 'Active', 'Closed'];

const prizeSchema = new mongoose.Schema(
  {
    rank: { type: Number, required: true },
    title: { type: String, default: '' },
    rewardAmount: { type: Number, default: 0 }, // paisa
  },
  { _id: false }
);

const contestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    // Bank contest details
    bankName: { type: String, default: '', trim: true },
    productName: { type: String, default: '', trim: true },
    contestPercentage: { type: Number, default: 0 }, // e.g. 0.5% payout
    contestDetails: { type: String, default: '' },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    metric: { type: String, enum: CONTEST_METRICS, default: 'DisbursedCount' },
    target: { type: Number, default: 0 }, // count or paisa depending on metric

    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    prizes: { type: [prizeSchema], default: [] },

    status: { type: String, enum: CONTEST_STATUSES, default: 'Draft', index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Contest', contestSchema);
