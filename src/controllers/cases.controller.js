import { z } from 'zod';
import LoanCase, {
  LOAN_STATUSES,
  PROFESSIONS,
  PRODUCTS,
  PROPERTY_TYPES,
  DISBURSEMENT_TYPES,
  POST_DISBURSEMENT_STAGES,
  FOLLOWUP_TYPES,
  TRANSACTION_TYPES,
  LOAN_TYPES,
} from '../models/LoanCase.js';
import DropdownOption, { DROPDOWN_TYPES } from '../models/DropdownOption.js';
import { recordAudit, recordActivity } from '../middleware/auditLog.js';
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
  'product', 'loanAmount', 'loanAmountDisplay', 'sanctionedAmount', 'disbursedAmount', 'roi', 'tenure', 'cibilIssue',
  'bankName', 'bankBranch', 'bankSMName', 'bankSMContact', 'bankSMEmail', 'channelName', 'appId',
  // NOTE: entryDate is intentionally NOT updatable — first-entry date is immutable.
  'followDate', 'loginDate', 'sanctionDate', 'disbursementDate', 'handoverDate',
  'currentStatus', 'confirmationStatus', 'handoverStatus',
  'documents',
  'legalAdvocateName', 'valuationAmount', 'technicalDetails',
  'specialNotes', 'queryNotes', 'handledBy',
  // New fields
  'fileNumber', 'bankUserId', 'bankPassword',
  'propertyType', 'provisionalBanks',
  'referralId', 'referenceName', 'referencePhone', 'referenceDetails', 'referencePartner',
  'bankerDetails',
  'disbursementType', 'postDisbursementStage', 'slaExtensionDays',
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
  'referralPayout',
  // New Loan Detail fields
  'transactionType', 'constructionStage',
  // Lead / Profile fields
  'cibilRemark', 'profileDetails', 'obligation', 'propertyDetails',
  'loanRequiredAmount', 'loanType', 'specialRemark',
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
  loanAmountDisplay: z.string().optional(),
  cibilIssue: z.enum(['Yes', 'No', '']).optional(),
  cibilRemark: z.string().optional(),
  // Lead / profile
  profileDetails: z.object({
    companyName: z.string().optional(),
    grossSalary: z.number().int().nonnegative().optional(),
    netSalary: z.number().int().nonnegative().optional(),
    itr: z.number().int().nonnegative().optional(),
    turnover: z.number().int().nonnegative().optional(),
  }).optional(),
  obligation: z.number().int().nonnegative().optional(),
  propertyDetails: z.object({
    marketValue: z.number().int().nonnegative().optional(),
    saleDeedValue: z.number().int().nonnegative().optional(),
  }).optional(),
  loanRequiredAmount: z.number().int().nonnegative().optional(),
  loanType: z.string().optional(),
  specialRemark: z.string().optional(),
  // Query / pendency note — same field as the grid's "Query" column.
  queryNotes: z.string().optional(),
  specialNotes: z.string().optional(),
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
  transactionType: z.enum([...TRANSACTION_TYPES, '']).optional(),
  constructionStage: z.number().min(0).max(100).nullable().optional(),
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
    invoiceStatus,
    paymentStatus,
    gstStatus,
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

  // Multi-select aware: a comma-separated value becomes an $in query.
  const multi = (val) => (String(val).includes(',') ? { $in: String(val).split(',').filter(Boolean) } : val);

  if (status) filter.currentStatus = multi(status);
  if (channelName && channelName !== 'All') filter.channelName = multi(channelName);
  if (bankName) filter.bankName = multi(bankName);
  if (handledBy) filter.handledBy = multi(handledBy);
  if (postDisbursementStage) filter.postDisbursementStage = multi(postDisbursementStage);
  if (propertyType) filter.propertyType = multi(propertyType);
  if (req.query.product) filter.product = multi(req.query.product);
  if (req.query.loanType) filter.loanType = multi(req.query.loanType);
  if (disbursementType) filter.disbursementType = multi(disbursementType);
  if (bankerConfirmation) filter['bankerDetails.bankerConfirmation'] = bankerConfirmation;
  if (handoverConfirmation) filter['bankerDetails.handoverConfirmation'] = handoverConfirmation;
  if (invoiceStatus) filter['bankerDetails.invoiceStatus'] = invoiceStatus;
  if (insuranceStatus) filter.insuranceStatus = insuranceStatus;
  if (profession) filter.profession = multi(profession);
  if (req.query.cibilIssue) filter.cibilIssue = req.query.cibilIssue;
  if (sendFeedbackForm) filter.sendFeedbackForm = sendFeedbackForm;
  if (sendReviewLink) filter.sendReviewLink = sendReviewLink;
  if (pendingPayment === 'true') filter.pendingPaymentAmount = { $gt: 0 };
  // Invoices folder: payment & GST status tabs.
  if (paymentStatus === 'pending') filter.pendingPaymentAmount = { $gt: 0 };
  else if (paymentStatus === 'done') filter.pendingPaymentAmount = { $lte: 0 };
  if (gstStatus) filter['paymentReceived.gstStatus'] = gstStatus;
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
  await recordActivity({
    req, action: 'create', caseDoc: doc,
    message: `added new case for ${doc.customerName} (#${doc.srNo})`,
  });
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

  const prevStatus = doc.currentStatus;

  // Auto-status logic for Bank Finalized
  if (updates.bankName && !req.body.currentStatus) {
    const earlyStatuses = ['New Inquiry', 'Query', 'Hold', 'Ready Login'];
    if (earlyStatuses.includes(doc.currentStatus)) {
      doc.currentStatus = 'Bank finalized';
    }
  }

  // Conversion Ratios Auto-Dates
  const targetStatus = updates.currentStatus || doc.currentStatus;
  if (targetStatus === 'Login done - under process' && !doc.loginDate && !updates.loginDate) {
    updates.loginDate = new Date();
  } else if (targetStatus === 'Sanctioned' && !doc.sanctionDate && !updates.sanctionDate) {
    updates.sanctionDate = new Date();
  } else if (targetStatus === 'Disbursed' && !doc.disbursementDate && !updates.disbursementDate) {
    updates.disbursementDate = new Date();
  }

  Object.assign(doc, updates);
  await doc.save();
  // Re-populate for response
  await doc.populate('handledBy', 'name role');
  await recordAudit({
    req, action: 'update', resource: 'LoanCase', resourceId: doc.id,
    meta: { fields: Object.keys(updates) },
  });
  if (doc.currentStatus !== prevStatus) {
    await recordActivity({
      req, action: 'status_change', caseDoc: doc,
      message: `changed status from ${prevStatus} to ${doc.currentStatus} in ${doc.customerName} client`,
      meta: { from: prevStatus, to: doc.currentStatus },
    });
  }
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
  await recordActivity({
    req, action: 'followup', caseDoc: doc,
    message: `added new follow up remark in ${doc.customerName} client`,
  });
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
  const [channelNames, bankNames, handlers, dataProfessions, professionOptions] = await Promise.all([
    LoanCase.distinct('channelName'),
    LoanCase.distinct('bankName'),
    LoanCase.distinct('handledBy'),
    LoanCase.distinct('profession'),
    DropdownOption.find({ type: 'profession', isActive: true }).select('value').lean(),
  ]);
  // Profession ("Type") filter options: standard list + any custom types the
  // user created or actually assigned to a case.
  const professions = [...new Set([
    ...PROFESSIONS,
    ...dataProfessions.filter(Boolean),
    ...professionOptions.map((o) => o.value).filter(Boolean),
  ])];
  res.json({
    channelNames: channelNames.filter(Boolean),
    bankNames: bankNames.filter(Boolean),
    statuses: LOAN_STATUSES,
    products: PRODUCTS,
    professions,
    loanTypes: LOAN_TYPES,
    propertyTypes: PROPERTY_TYPES,
    disbursementTypes: DISBURSEMENT_TYPES,
    postDisbursementStages: POST_DISBURSEMENT_STAGES,
    followUpTypes: FOLLOWUP_TYPES,
  });
}

// Reference partners: aggregate cases by referenceName to show all unique references
export async function listReferencePartners(req, res) {
  const { search, dateFrom, dateTo } = req.query;
  const match = { referenceName: { $nin: [null, ''] } };
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    match.$or = [{ referenceName: rx }, { referencePhone: rx }];
  }
  // Date-wise filtering: only include cases created in the given window.
  if (dateFrom || dateTo) {
    match.createdAt = {};
    if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      match.createdAt.$lte = end;
    }
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
            createdAt: '$createdAt',
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

// Distinct bankers previously entered (name + mobile + email) for auto-fill.
export async function bankersAutocomplete(_req, res) {
  const items = await LoanCase.aggregate([
    { $match: { 'bankerDetails.name': { $nin: [null, ''] } } },
    { $sort: { updatedAt: -1 } },
    {
      $group: {
        _id: '$bankerDetails.name',
        mobileNumber: { $first: '$bankerDetails.mobileNumber' },
        emailId: { $first: '$bankerDetails.emailId' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({
    items: items.map((it) => ({
      name: it._id,
      mobileNumber: it.mobileNumber || '',
      emailId: it.emailId || '',
    })),
  });
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
      .select('label value _id')
      .lean();
    
    result[type] = options.map(o => ({ label: o.label, value: o.value, _id: o._id }));
  }

  res.json(result);
}

// Delete (deactivate) a dropdown option by its ID
export async function deleteDropdownOption(req, res) {
  const { optionId } = req.params;

  const option = await DropdownOption.findById(optionId);
  if (!option) return res.status(404).json({ error: 'Option not found' });

  // Soft-delete: mark isActive = false so it doesn't appear in dropdowns
  option.isActive = false;
  await option.save();

  await recordAudit({
    action: 'DELETE_DROPDOWN_OPTION',
    userId: req.user._id,
    resourceType: 'DropdownOption',
    resourceId: option._id.toString(),
    details: { type: option.type, label: option.label, value: option.value },
  });

  res.json({ ok: true });
}

