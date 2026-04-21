import mongoose from 'mongoose';
import { nextSeq } from './Counter.js';

export const INVOICE_STATUSES = ['Pending', 'Paid', 'Cancelled'];

// Indian financial year string for a given date, e.g. "2025-26".
export function getFinancialYear(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-11
  const startYear = m >= 3 ? y : y - 1; // FY starts April
  const end = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${end}`;
}

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, unique: true, index: true },
    financialYear: { type: String, index: true },
    date: { type: Date, default: Date.now },

    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
    loanCase: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanCase' },

    // Snapshot of customer/case at invoice time so display doesn't break if case is edited.
    snapshot: {
      customerName: String,
      bankName: String,
      product: String,
      loanAmount: Number, // paisa
      disbursedAmount: Number, // paisa
      partnerName: String,
      partnerGST: String,
    },

    // All money in paisa.
    amount: { type: Number, required: true, default: 0 }, // base/commission amount
    gstRate: { type: Number, default: 18 }, // percent
    gstAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },

    status: { type: String, enum: INVOICE_STATUSES, default: 'Pending', index: true },

    payment: {
      paidDate: Date,
      mode: String, // Bank/UPI/Cash/Cheque
      reference: String,
      amount: Number, // paisa
    },

    notes: { type: String, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Recompute GST + total whenever amount/rate change.
invoiceSchema.pre('validate', function recomputeTotals(next) {
  const base = this.amount || 0;
  const rate = this.gstRate || 0;
  this.gstAmount = Math.round((base * rate) / 100);
  this.totalAmount = base + this.gstAmount;
  next();
});

// Auto-assign invoiceNo on creation: ZPL/2025-26/001
invoiceSchema.pre('validate', async function assignInvoiceNo(next) {
  if (this.isNew && !this.invoiceNo) {
    const fy = getFinancialYear(this.date || new Date());
    this.financialYear = fy;
    const seq = await nextSeq(`invoice_${fy}`);
    this.invoiceNo = `ZPL/${fy}/${String(seq).padStart(3, '0')}`;
  }
  next();
});

export default mongoose.model('Invoice', invoiceSchema);
