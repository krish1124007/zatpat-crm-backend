import mongoose from 'mongoose';

const salarySchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12 }, // 1-12
    year: { type: Number, required: true, min: 2000, max: 2100 },

    // All paisa.
    basicSalary: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    incentiveAmount: { type: Number, default: 0 },
    incentiveDetails: { type: String, default: '' },

    netPay: { type: Number, default: 0 },

    paymentDate: { type: Date },
    paymentMode: { type: String, default: 'Bank' },
    notes: { type: String, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// One row per employee per month.
salarySchema.index({ employee: 1, year: 1, month: 1 }, { unique: true });

salarySchema.pre('save', function recompute(next) {
  this.netPay =
    (this.basicSalary || 0) +
    (this.allowances || 0) +
    (this.incentiveAmount || 0) -
    (this.deductions || 0);
  next();
});

export default mongoose.model('Salary', salarySchema);
