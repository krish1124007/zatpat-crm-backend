import { z } from 'zod';
import LoanCase, {
  LOAN_STATUSES,
  PROFESSIONS,
  PRODUCTS,
  PROPERTY_TYPES,
  DISBURSEMENT_TYPES,
  POST_DISBURSEMENT_STAGES,
  FOLLOWUP_TYPES,
} from '../models/LoanCase.js';
import DropdownOption, { DROPDOWN_TYPES } from '../models/DropdownOption.js';
import { recordAudit } from '../middleware/auditLog.js';
import { streamExpenseSheetPDF, streamOfferLetterPDF } from '../services/casePdfs.js';

export async function downloadExpenseSheet(req, res) {
  const c = await LoanCase.findById(req.params.id).lean();
  if (!c) return res.status(404).json({ error: 'Not found' });
  streamExpenseSheetPDF(c, res);
}

export async function downloadOfferLetter(req, res) {
  const c = await LoanCase.findById(req.params.id).lean();
  if (!c) return res.status(404).json({ error: 'Not found' });
  const stage = req.query.stage === 'after' ? 'after' : 'before';
  streamOfferLetterPDF(c, stage, res);
}

// Fields the client is allowed to update directly via PATCH.
const UPDATABLE_FIELDS = new Set([
  'customerName', 'phone', 'email', 'profession',
  'product', 'loanAmount', 'sanctionedAmount', 'disbursedAmount', 'roi', 'tenure', 'cibilIssue',
  'bankName', 'bankBranch', 'bankSMName', 'bankSMContact', 'bankSMEmail', 'channelName', 'appId',
  'entryDate', 'followDate', 'loginDate', 'sanctionDate', 'disbursementDate', 'handoverDate',
  'currentStatus', 'confirmationStatus', 'handoverStatus',
  'documents',
  'legalAdvocateName', 'valuationAmount', 'technicalDetails',
  'specialNotes', 'handledBy',
  // New fields
  'fileNumber', 'bankUserId', 'bankPassword',
  'propertyType', 'provisionalBanks',
  'referralId', 'referenceName', 'referencePhone', 'referenceDetails', 'referencePartner',
  'bankerDetails',
  'disbursementType', 'postDisbursementStage',
  // Insurance
  'insuranceCompany', 'insuranceAmount', 'insurancePolicyNumber', 'insuranceStatus',
  // Sanction letter
  'sanctionLetterFile',
  // Franking & Notary
  'frankingNotary',
  // Loan expenses
  'loanExpenses',
  // Disbursement Tracker
  'saleDeedAmount', 'ocrAmount', 'parallelFundingAmount', 'isFullDisbursed', 'partPayments',
  // Communication
  'sendFeedbackForm', 'sendReviewLink',
  // Referral Payout
  'referralPayout'
]);

function pickUpdatable(body) {
  const out = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (UPDATABLE_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

const createSchema = z.object({
  customerName: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional().or(z.literal('')),
  profession: z.enum(PROFESSIONS).optional(),
  product: z.string().optional(),
  loanAmount: z.number().int().nonnegative().optional(),
  cibilIssue: z.enum(['Yes', 'No', '']).optional(),
  bankName: z.string().optional(),
  channelName: z.string().optional(),
  currentStatus: z.string().optional(),
  fileNumber: z.string().optional(),
  bankUserId: z.string().optional(),
  bankPassword: z.string().optional(),
  propertyType: z.string().optional(),
  provisionalBanks: z.array(z.string()).optional(),
  referralId: z.string().optional(),
  entryDate: z.coerce.date().optional(),
  referenceName: z.string().optional(),
  referencePhone: z.string().optional(),
  referenceDetails: z.object({
    mobileNumber: z.string().optional(),
    bankName: z.string().optional(),
    bankBranch: z.string().optional(),
    accountNumber: z.string().optional(),
    ifscCode: z.string().optional(),
  }).optional(),
  referencePartner: z.string().optional(),
  bankerDetails: z.object({
    name: z.string().optional(),
    mobileNumber: z.string().optional(),
    emailId: z.string().optional(),
    handoverConfirmation: z.enum(['', 'Done', 'Pending']).optional(),
    bankerConfirmation: z.enum(['', 'Done', 'Pending']).optional(),
    invoiceStatus: z.enum(['', 'Done', 'Pending']).optional(),
  }).optional(),
  handledBy: z.string().optional(),
  loginDate: z.coerce.date().optional(),
  sanctionDate: z.coerce.date().optional(),
  disbursementDate: z.coerce.date().optional(),
  handoverDate: z.coerce.date().optional(),
  saleDeedAmount: z.number().int().nonnegative().optional(),
  ocrAmount: z.number().int().nonnegative().optional(),
  parallelFundingAmount: z.number().int().nonnegative().optional(),
  isFullDisbursed: z.boolean().optional(),
  partPayments: z.array(z.object({
    amount: z.number().int().nonnegative().optional(),
    date: z.coerce.date().optional()
  })).optional(),
  sendFeedbackForm: z.enum(['', 'Done', 'Pending']).optional(),
  sendReviewLink: z.enum(['', 'Done', 'Pending']).optional(),
  referralPayout: z.object({
    percentage: z.number().optional(),
    amount: z.number().optional(),
    status: z.enum(['Paid', 'Unpaid', '']).optional(),
    date: z.coerce.date().optional(),
    mode: z.enum(['Cash', 'Bank', '']).optional(),
    bankName: z.string().optional(),
  }).optional(),
});

export async function listCases(req, res) {
  const {
    page = 1,
    limit = 50,
    status,
    channelName,
    bankName,
    search,
    dateFrom,
    dateTo,
    pendingPayment,
    sortBy = 'srNo',
    sortDir = 'desc',
    handledBy,
    postDisbursementStage,
    propertyType,
    disbursementType,
    referenceName,
    bankerConfirmation,
    handoverConfirmation,
    insuranceStatus,
    profession,
    sendFeedbackForm,
    sendReviewLink,
    isDeleted,
  } = req.query;

  const filter = {};
  if (isDeleted === 'true') {
    filter.isDeleted = true;
  } else {
    filter.isDeleted = { $ne: true };
  }

  if (status) {
    if (status.includes(',')) {
      filter.currentStatus = { $in: status.split(',') };
    } else {
      filter.currentStatus = status;
    }
  }
  if (channelName && channelName !== 'All') filter.channelName = channelName;
  if (bankName) filter.bankName = bankName;
  if (handledBy) filter.handledBy = handledBy;
  if (postDisbursementStage) filter.postDisbursementStage = postDisbursementStage;
  if (propertyType) filter.propertyType = propertyType;
  if (disbursementType) filter.disbursementType = disbursementType;
  if (bankerConfirmation) filter['bankerDetails.bankerConfirmation'] = bankerConfirmation;
  if (handoverConfirmation) filter['bankerDetails.handoverConfirmation'] = handoverConfirmation;
  if (insuranceStatus) filter.insuranceStatus = insuranceStatus;
  if (profession) filter.profession = profession;
  if (sendFeedbackForm) filter.sendFeedbackForm = sendFeedbackForm;
  if (sendReviewLink) filter.sendReviewLink = sendReviewLink;
  if (pendingPayment === 'true') filter.pendingPaymentAmount = { $gt: 0 };
  if (req.query.hasPartPayment === 'true') filter['partPayments.0'] = { $exists: true };
  if (referenceName) {
    filter.referenceName = new RegExp(referenceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filter.createdAt.$lte = new Date(dateTo);
  }
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { customerName: rx },
      { phone: rx },
      { appId: rx },
      { bankName: rx },
      { fileNumber: rx },
      { referenceName: rx },
    ];
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const sort = { [sortBy]: sortDir === 'asc' ? 1 : -1 };

  const [items, total] = await Promise.all([
    LoanCase.find(filter)
      .sort(sort)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('handledBy', 'name role')
      .populate('referencePartner', 'name phone commissionPercent')
      .lean(),
    LoanCase.countDocuments(filter),
  ]);

  res.json({ items, total, page: pageNum, limit: limitNum });
}

export async function getCase(req, res) {
  const c = await LoanCase.findById(req.params.id)
    .populate('handledBy', 'name role')
    .populate('referencePartner', 'name phone commissionPercent')
    .lean();
  if (!c) return res.status(404).json({ error: 'Case not found' });
  res.json({ case: c });
}

export async function createCase(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  if (parsed.data.bankName && !parsed.data.currentStatus) {
    parsed.data.currentStatus = 'Bank finalized';
  }
  const doc = await LoanCase.create({
    ...parsed.data,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  await recordAudit({ req, action: 'create', resource: 'LoanCase', resourceId: doc.id });
  res.status(201).json({ case: doc });
}

export async function updateCase(req, res) {
  const updates = pickUpdatable(req.body);
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided' });
  }
  updates.updatedBy = req.user._id;

  const doc = await LoanCase.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Case not found' });

  // Auto-status logic for Bank Finalized
  if (updates.bankName && !req.body.currentStatus) {
    const earlyStatuses = ['Query', 'Hold', 'Ready Login'];
    if (earlyStatuses.includes(doc.currentStatus)) {
      doc.currentStatus = 'Bank finalized';
    }
  }

  Object.assign(doc, updates);
  await doc.save();
  // Re-populate for response
  await doc.populate('handledBy', 'name role');
  await recordAudit({
    req, action: 'update', resource: 'LoanCase', resourceId: doc.id,
    meta: { fields: Object.keys(updates) },
  });
  res.json({ case: doc });
}

export async function deleteCase(req, res) {
  const doc = await LoanCase.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Case not found' });
  
  doc.isDeleted = true;
  doc.updatedBy = req.user._id;
  await doc.save();

  await recordAudit({ req, action: 'delete', resource: 'LoanCase', resourceId: req.params.id });
  res.json({ ok: true });
}

export async function restoreCase(req, res) {
  const doc = await LoanCase.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Case not found' });
  
  doc.isDeleted = false;
  doc.updatedBy = req.user._id;
  await doc.save();

  await recordAudit({ req, action: 'restore', resource: 'LoanCase', resourceId: req.params.id });
  res.json({ ok: true });
}

const followUpSchema = z.object({
  date: z.coerce.date().optional(),
  details: z.string().min(1),
  nextFollowUpDate: z.coerce.date().optional(),
  nextFollowUpDetails: z.string().optional(),
  followUpType: z.enum(FOLLOWUP_TYPES).optional(),
});

export async function addFollowUp(req, res) {
  const parsed = followUpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const doc = await LoanCase.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Case not found' });
  doc.followUps.push({ ...parsed.data, updatedBy: req.user._id });
  await doc.save();
  res.status(201).json({ case: doc });
}

const paymentZodSchema = z.object({
  // Row 1
  invoiceNumber: z.string().optional(),
  invoiceDate: z.coerce.date().optional(),
  disbursedAmount: z.number().int().nonnegative().optional(), // paisa
  // Row 2
  invoiceAmount: z.number().int().nonnegative().optional(), // paisa
  amountDoneStatus: z.string().optional(),
  amountDoneDate: z.coerce.date().optional(),
  // Row 3
  gstAmount: z.number().int().nonnegative().optional(),
  gstStatus: z.string().optional(),
  gstDate: z.coerce.date().optional(),
  // Row 4
  bankName: z.string().optional(),
  reference: z.string().optional(),
  shortfall: z.number().int().nonnegative().optional(),
  shortfallReason: z.string().optional(),
  
  // Legacy / other
  date: z.coerce.date().optional(),
  amount: z.number().int().nonnegative().optional(), // legacy actual amount
  mode: z.string().optional(),
  note: z.string().optional(),
  party: z.string().optional(),
  disbursementNumber: z.string().optional(),
  paymentDate: z.coerce.date().optional(),
});

export async function addPayment(req, res) {
  const { kind } = req.params; // 'received' | 'done'
  if (!['received', 'done'].includes(kind)) {
    return res.status(400).json({ error: 'Invalid payment kind' });
  }
  const parsed = paymentZodSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const doc = await LoanCase.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Case not found' });
  const target = kind === 'received' ? doc.paymentReceived : doc.paymentDone;
  target.push(parsed.data);
  await doc.save();
  res.status(201).json({ case: doc });
}

// Upload sanction letter file
export async function uploadSanctionLetter(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const doc = await LoanCase.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Case not found' });
  doc.sanctionLetterFile = `/uploads/${req.file.filename}`;
  doc.updatedBy = req.user._id;
  await doc.save();
  await doc.populate('handledBy', 'name role');
  res.json({ case: doc });
}

// Distinct values used to populate filter dropdowns on the client.
export async function getCaseFacets(_req, res) {
  const [channelNames, bankNames, handlers] = await Promise.all([
    LoanCase.distinct('channelName'),
    LoanCase.distinct('bankName'),
    LoanCase.distinct('handledBy'),
  ]);
  res.json({
    channelNames: channelNames.filter(Boolean),
    bankNames: bankNames.filter(Boolean),
    statuses: LOAN_STATUSES,
    products: PRODUCTS,
    professions: PROFESSIONS,
    propertyTypes: PROPERTY_TYPES,
    disbursementTypes: DISBURSEMENT_TYPES,
    postDisbursementStages: POST_DISBURSEMENT_STAGES,
    followUpTypes: FOLLOWUP_TYPES,
  });
}

// Reference partners: aggregate cases by referenceName to show all unique references
export async function listReferencePartners(req, res) {
  const { search } = req.query;
  const match = { referenceName: { $nin: [null, ''] } };
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    match.$or = [{ referenceName: rx }, { referencePhone: rx }];
  }

  const items = await LoanCase.aggregate([
    { $match: match },
    {
      $group: {
        _id: { name: '$referenceName', phone: '$referencePhone' },
        totalCases: { $sum: 1 },
        disbursedCases: {
          $sum: { $cond: [{ $eq: ['$currentStatus', 'Disbursed'] }, 1, 0] },
        },
        totalLoanAmount: { $sum: '$loanAmount' },
        totalDisbursedAmount: {
          $sum: { $cond: [{ $eq: ['$currentStatus', 'Disbursed'] }, '$disbursedAmount', 0] },
        },
        totalPayoutAmount: { $sum: { $ifNull: ['$referralPayout.amount', 0] } },
        totalPaidPayout: {
          $sum: { $cond: [{ $eq: ['$referralPayout.status', 'Paid'] }, { $ifNull: ['$referralPayout.amount', 0] }, 0] },
        },
        cases: {
          $push: {
            _id: '$_id',
            srNo: '$srNo',
            customerName: '$customerName',
            phone: '$phone',
            bankName: '$bankName',
            currentStatus: '$currentStatus',
            loanAmount: '$loanAmount',
            disbursedAmount: '$disbursedAmount',
            referralPayout: '$referralPayout',
          },
        },
      },
    },
    { $sort: { totalCases: -1 } },
  ]);

  const formatted = items.map((it) => ({
    referenceName: it._id.name,
    referencePhone: it._id.phone || '',
    totalCases: it.totalCases,
    disbursedCases: it.disbursedCases,
    totalLoanAmount: it.totalLoanAmount,
    totalDisbursedAmount: it.totalDisbursedAmount,
    totalPayoutAmount: it.totalPayoutAmount,
    totalPaidPayout: it.totalPaidPayout,
    cases: it.cases,
  }));

  res.json({ items: formatted });
}

export async function referencePartnersAutocomplete(req, res) {
  // Get unique reference partners with their latest details
  const items = await LoanCase.aggregate([
    { $match: { referenceName: { $nin: [null, ''] } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$referenceName',
        referencePhone: { $first: '$referencePhone' },
        referenceDetails: { $first: '$referenceDetails' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const formatted = items.map((it) => ({
    referenceName: it._id,
    referencePhone: it.referencePhone || '',
    referenceDetails: it.referenceDetails || {},
  }));

  res.json({ items: formatted });
}

// Get dropdown options by type
export async function getDropdownOptions(req, res) {
  const { type } = req.query;
  
  if (!type || !DROPDOWN_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Invalid dropdown type' });
  }

  const options = await DropdownOption.find({ type, isActive: true })
    .sort({ 'metadata.sortOrder': 1, label: 1 })
    .lean();

  res.json({ options });
}

// Create a new dropdown option
export async function createDropdownOption(req, res) {
  const { type, label, value, description } = req.body;

  if (!type || !DROPDOWN_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Invalid dropdown type' });
  }

  if (!label || !value) {
    return res.status(400).json({ error: 'Label and value are required' });
  }

  try {
    // Check if already exists
    const existing = await DropdownOption.findOne({ type, value });
    if (existing) {
      return res.status(409).json({ error: 'Option already exists' });
    }

    const newOption = new DropdownOption({
      type,
      label,
      value,
      isActive: true,
      createdBy: req.user._id,
      metadata: {
        description: description || '',
        sortOrder: 0,
      },
    });

    await newOption.save();

    // Record audit log
    await recordAudit({
      action: 'CREATE_DROPDOWN_OPTION',
      userId: req.user._id,
      resourceType: 'DropdownOption',
      resourceId: newOption._id.toString(),
      details: { type, label, value },
    });

    res.status(201).json({ option: newOption });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Option already exists' });
    }
    throw err;
  }
}

// Get all dropdown options grouped by type
export async function getAllDropdownOptions(req, res) {
  const result = {};
  
  for (const type of DROPDOWN_TYPES) {
    const options = await DropdownOption.find({ type, isActive: true })
      .sort({ 'metadata.sortOrder': 1, label: 1 })
      .select('label value')
      .lean();
    
    result[type] = options.map(o => ({ label: o.label, value: o.value }));
  }

  res.json(result);
}

