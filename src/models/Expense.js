import mongoose from 'mongoose';

export const EXPENSE_CATEGORIES = [
  'Petrol',
  'Tea',
  'Stationary',
  'Franking',
  'Notary',
  'Office',
  'Travel',
  'Marketing',
  'Legal',
  'Utilities',
  'Rent',
  'Other',
];

export const PAYMENT_TYPES = [
  'Cash',
  'Bank Transfer',
  'UPI',
  'Cheque',
  'Card',
  'Other',
];

const expenseSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now, index: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, default: 'Other', index: true },
    amount: { type: Number, required: true, default: 0 }, // paisa
    description: { type: String, default: '' },

    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiptFile: { type: String, default: '' },

    paymentType: { type: String, default: 'Cash' },
    isRecurring: { type: Boolean, default: false },

    // Optional link to a loan case (for franking/notary linked to a specific case).
    loanCase: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanCase' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1, date: -1 });

export default mongoose.model('Expense', expenseSchema);
