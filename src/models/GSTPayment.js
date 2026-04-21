import mongoose from 'mongoose';

// Records of actual GST returns filed / payments made. The monthly _summary_ (collected vs payable)
// is computed on-the-fly from invoices in the reports controller.
const gstPaymentSchema = new mongoose.Schema(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000, max: 2100 },

    igst: { type: Number, default: 0 }, // paisa
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },

    paymentDate: { type: Date },
    challanNo: { type: String, default: '' },
    status: { type: String, enum: ['Pending', 'Filed', 'Paid'], default: 'Pending' },

    filedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

gstPaymentSchema.index({ year: 1, month: 1 }, { unique: true });

gstPaymentSchema.pre('save', function recompute(next) {
  this.totalPaid = (this.igst || 0) + (this.cgst || 0) + (this.sgst || 0);
  next();
});

export default mongoose.model('GSTPayment', gstPaymentSchema);
