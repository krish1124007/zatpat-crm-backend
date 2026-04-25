import mongoose from 'mongoose';
import { nextSeq } from './Counter.js';

const partPaymentSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    amount: { type: Number, default: 0 }, // paisa
  },
  { _id: true }
);

const disbursementTrackerSchema = new mongoose.Schema(
  {
    srNo: { type: Number, unique: true, index: true },
    customerName: { type: String, required: true, trim: true, index: true },
    mobileNumber: { type: String, required: true, trim: true, index: true },
    
    loanAmount: { type: Number, default: 0 }, // paisa
    saleDeedAmount: { type: Number, default: 0 }, // paisa
    ocrAmount: { type: Number, default: 0 }, // paisa
    parallelFundingAmount: { type: Number, default: 0 }, // paisa
    insuranceAmount: { type: Number, default: 0 }, // paisa
    processingFeeAmount: { type: Number, default: 0 }, // paisa
    
    partPayments: { type: [partPaymentSchema], default: [] },
    isFullDisbursed: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-increment srNo on creation.
disbursementTrackerSchema.pre('validate', async function assignSrNo(next) {
  if (this.isNew && this.srNo == null) {
    this.srNo = await nextSeq('disbursementTracker');
  }
  next();
});

export default mongoose.model('DisbursementTracker', disbursementTrackerSchema);
