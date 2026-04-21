import mongoose from 'mongoose';

export const INSURANCE_TYPES = ['Life', 'Health', 'Property', 'Vehicle', 'Term', 'Other'];
export const INSURANCE_STATUSES = ['Lead', 'Quoted', 'Active', 'Lapsed', 'Cancelled'];

const insuranceSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },

    type: { type: String, enum: INSURANCE_TYPES, default: 'Life', index: true },
    insurer: { type: String, default: '' },
    policyNumber: { type: String, default: '', index: true },

    sumAssured: { type: Number, default: 0 }, // paisa
    premium: { type: Number, default: 0 }, // paisa, annual
    commission: { type: Number, default: 0 }, // paisa, our cut

    startDate: { type: Date },
    renewalDate: { type: Date, index: true },

    status: { type: String, enum: INSURANCE_STATUSES, default: 'Lead', index: true },
    notes: { type: String, default: '' },

    // Optional link to a loan case if this came in via a loan customer.
    loanCase: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanCase' },

    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

insuranceSchema.index({ customerName: 'text', phone: 'text', policyNumber: 'text' });

export default mongoose.model('Insurance', insuranceSchema);
