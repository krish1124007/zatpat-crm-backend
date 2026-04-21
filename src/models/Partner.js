import mongoose from 'mongoose';

const partnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    contactPerson: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '', lowercase: true, trim: true },
    gstNumber: { type: String, default: '', trim: true },

    // Manager/leader who owns this partner relationship.
    linkedLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Default commission percent applied to invoices for this partner.
    commissionPercent: { type: Number, default: 0 },

    bankDetails: {
      accountName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifsc: { type: String, default: '' },
      bankName: { type: String, default: '' },
    },

    isActive: { type: Boolean, default: true },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Partner', partnerSchema);
