import mongoose from 'mongoose';
import { nextSeq } from './Counter.js';

export const LOAN_STATUSES = [
  'Query',
  'ReadyLogin',
  'Hold',
  'LoginDone',
  'UnderProcess',
  'BankFinalized',
  'Sanctioned',
  'Disbursed',
  'Rejected',
  'Cancelled',
  'NotInterested',
];

export const PROFESSIONS = ['Salaried', 'Businessman', 'Professional'];
export const PRODUCTS = ['HL', 'LAP', 'BT', 'TOPUP', 'ML', 'CommercialPurchase', 'Other'];

export const PROPERTY_TYPES = [
  'Flat',
  'Bungalow',
  'Row House',
  'Plot',
  'Commercial Shop',
  'Commercial Office',
  'Industrial',
  'Agricultural Land',
  'Other',
];

export const DISBURSEMENT_TYPES = ['Full', 'Part'];

export const POST_DISBURSEMENT_STAGES = [
  'HandoverPending',
  'HandoverDone',
  'BankConfirmationPending',
  'BankConfirmationDone',
  'InvoicePrepared',
  'InvoicePending',
  'PaymentReceived',
  'PaymentPending',
];

export const FOLLOWUP_TYPES = ['FollowUp', 'Login', 'Disbursement'];

const followUpSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    details: { type: String, default: '' },
    nextFollowUpDate: { type: Date },
    nextFollowUpDetails: { type: String, default: '' },
    followUpType: { type: String, enum: FOLLOWUP_TYPES, default: 'FollowUp' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const paymentSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    amount: { type: Number, default: 0 }, // paisa
    mode: { type: String, default: 'Cash' }, // Cash / Bank / UPI / Cheque
    reference: { type: String, default: '' },
    note: { type: String, default: '' },
    party: { type: String, default: '' }, // for paymentDone: who got paid
    disbursementNumber: { type: String, default: '' }, // 1st, 2nd, 3rd disbursement etc.
    gstStatus: { type: String, enum: ['Pending', 'Received', ''], default: '' },
    gstAmount: { type: Number, default: 0 }, // paisa
    shortfall: { type: Number, default: 0 }, // paisa - any amount cut by bank/party
    shortfallReason: { type: String, default: '' },
    paymentDate: { type: Date }, // actual date payment received
  },
  { _id: true, timestamps: true }
);

const partDisbursementSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    amount: { type: Number, default: 0 }, // paisa
    bankRef: { type: String, default: '' },
    note: { type: String, default: '' },
    disbursementNumber: { type: String, default: '' }, // 1st, 2nd etc.
  },
  { _id: true }
);

const creditNoteSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    amount: { type: Number, default: 0 }, // paisa
    reason: { type: String, default: '' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const offerSchema = new mongoose.Schema(
  {
    details: { type: String, default: '' },
    conditions: { type: String, default: '' },
    sentToCustomer: { type: Boolean, default: false },
    sentDate: { type: Date },
  },
  { _id: false }
);

const loanCaseSchema = new mongoose.Schema(
  {
    srNo: { type: Number, unique: true, index: true },
    fileNumber: { type: String, default: '', trim: true, index: true },

    // Customer
    customerName: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    profession: { type: String, enum: PROFESSIONS, default: 'Salaried' },

    // Bank login credentials (for bank portal)
    bankUserId: { type: String, default: '', trim: true },
    bankPassword: { type: String, default: '', trim: true },

    // Loan
    product: { type: String, enum: PRODUCTS, default: 'HL' },
    loanAmount: { type: Number, default: 0 }, // paisa
    sanctionedAmount: { type: Number, default: 0 }, // paisa
    disbursedAmount: { type: Number, default: 0 }, // paisa
    roi: { type: Number, default: 0 }, // percent, 2dp -> store as Number e.g. 8.75
    tenure: { type: Number, default: 0 }, // months

    // Property
    propertyType: { type: String, enum: [...PROPERTY_TYPES, ''], default: '' },

    // Bank / channel
    bankName: { type: String, default: '', index: true },
    bankBranch: { type: String, default: '' },
    bankSMName: { type: String, default: '' },
    bankSMContact: { type: String, default: '' },
    bankSMEmail: { type: String, default: '' },
    channelName: { type: String, default: 'Zatpat', index: true },
    appId: { type: String, default: '', index: true },

    // Provisional banks (multiple options customer is exploring)
    provisionalBanks: { type: [String], default: [] },

    // Reference — who referred this case
    referralId: { type: String, default: '', trim: true, index: true },
    referenceName: { type: String, default: '', trim: true },
    referencePhone: { type: String, default: '', trim: true },
    referenceDetails: {
      mobileNumber: { type: String, default: '' },
      bankName: { type: String, default: '' },
      bankBranch: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
    },
    referencePartner: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },

    // Banker/Bank Details
    bankerDetails: {
      name: { type: String, default: '' },
      mobileNumber: { type: String, default: '' },
      emailId: { type: String, default: '' },
      handoverConfirmation: { type: String, enum: ['', 'Done', 'Pending'], default: '' },
    },

    // Dates
    entryDate: { type: Date, default: Date.now },
    followDate: { type: Date },
    loginDate: { type: Date },
    sanctionDate: { type: Date },
    disbursementDate: { type: Date },
    handoverDate: { type: Date },

    // Status
    currentStatus: { type: String, enum: LOAN_STATUSES, default: 'Query', index: true },
    confirmationStatus: { type: String, default: '' },
    handoverStatus: { type: String, default: '' },

    // Disbursement type
    disbursementType: { type: String, enum: [...DISBURSEMENT_TYPES, ''], default: '' },

    // Post-disbursement tracking
    postDisbursementStage: { type: String, enum: [...POST_DISBURSEMENT_STAGES, ''], default: '' },

    // Document checklist
    documents: {
      kycDone: { type: Boolean, default: false },
      itrDone: { type: Boolean, default: false },
      bankStatementDone: { type: Boolean, default: false },
      propertyDocsDone: { type: Boolean, default: false },
      salarySlipDone: { type: Boolean, default: false },
      form16Done: { type: Boolean, default: false },
      gstReturnDone: { type: Boolean, default: false },
    },

    // Legal & Technical
    legalAdvocateName: { type: String, default: '' },
    legalReportFile: { type: String, default: '' },
    valuationAmount: { type: Number, default: 0 }, // paisa
    technicalDetails: { type: String, default: '' },
    technicalReportFile: { type: String, default: '' },

    // Sanction letter file (path or URL)
    sanctionLetterFile: { type: String, default: '' },

    // Insurance (post-disbursement)
    insuranceCompany: { type: String, default: '', trim: true },
    insuranceAmount: { type: Number, default: 0 }, // paisa
    insurancePolicyNumber: { type: String, default: '', trim: true },
    insuranceStatus: { type: String, enum: ['', 'Pending', 'Active', 'Claimed', 'Expired'], default: '' },

    // Loan expenses (paisa)
    loanExpenses: {
      processingFee: { type: Number, default: 0 },
      insurancePremium: { type: Number, default: 0 },
      franking: { type: Number, default: 0 },
      notary: { type: Number, default: 0 },
      stampDuty: { type: Number, default: 0 },
      legalCharge: { type: Number, default: 0 },
      technicalCharge: { type: Number, default: 0 },
      otherExpenses: [{ label: String, amount: Number }],
      totalExpenses: { type: Number, default: 0 },
    },

    // Franking & Notary — per-case tracking of charges taken from customer vs actual cost
    frankingNotary: {
      frankingActual: { type: Number, default: 0 },     // paisa — actual franking cost
      notaryActual: { type: Number, default: 0 },        // paisa — actual notary cost
      otherChargesActual: { type: Number, default: 0 },  // paisa — any other misc charges
      otherChargesLabel: { type: String, default: '' },
      amountTakenFromCustomer: { type: Number, default: 0 }, // paisa — total taken from customer
      notes: { type: String, default: '' },
    },

    // Payments
    paymentReceived: { type: [paymentSchema], default: [] },
    paymentDone: { type: [paymentSchema], default: [] },
    pendingPaymentAmount: { type: Number, default: 0 }, // paisa

    // Disbursement Tracker Fields
    saleDeedAmount: { type: Number, default: 0 }, // paisa
    ocrAmount: { type: Number, default: 0 }, // paisa
    parallelFundingAmount: { type: Number, default: 0 }, // paisa
    isFullDisbursed: { type: Boolean, default: false },

    // Sub-collections
    followUps: { type: [followUpSchema], default: [] },
    partDisbursements: { type: [partDisbursementSchema], default: [] },
    partPayments: { type: [partDisbursementSchema], default: [] },
    creditNotes: { type: [creditNoteSchema], default: [] },

    offerBeforeProcess: { type: offerSchema, default: () => ({}) },
    offerAfterSanction: { type: offerSchema, default: () => ({}) },

    specialNotes: { type: String, default: '' },

    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-increment srNo on creation.
loanCaseSchema.pre('validate', async function assignSrNo(next) {
  if (this.isNew && this.srNo == null) {
    this.srNo = await nextSeq('loanCase');
  }
  next();
});

// Recompute pending payment whenever amounts change.
loanCaseSchema.pre('save', function recomputePending(next) {
  const totalReceived = (this.paymentReceived || []).reduce((a, p) => a + (p.amount || 0), 0);
  const target = this.sanctionedAmount || this.loanAmount || 0;
  this.pendingPaymentAmount = Math.max(target - totalReceived, 0);
  next();
});

// Helpful compound indexes for common queries.
loanCaseSchema.index({ channelName: 1, currentStatus: 1, createdAt: -1 });
loanCaseSchema.index({ customerName: 'text', phone: 'text', appId: 'text', fileNumber: 'text' });

export default mongoose.model('LoanCase', loanCaseSchema);
