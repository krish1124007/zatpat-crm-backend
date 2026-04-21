import { z } from 'zod';
import Invoice, { INVOICE_STATUSES } from '../models/Invoice.js';
import Partner from '../models/Partner.js';
import LoanCase from '../models/LoanCase.js';
import { recordAudit } from '../middleware/auditLog.js';
import { streamInvoicePDF } from '../services/invoicePdf.js';

const createSchema = z.object({
  partner: z.string().min(1),
  loanCase: z.string().optional().nullable(),
  date: z.coerce.date().optional(),
  amount: z.number().int().nonnegative(), // paisa
  gstRate: z.number().min(0).max(50).optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  date: z.coerce.date().optional(),
  amount: z.number().int().nonnegative().optional(),
  gstRate: z.number().min(0).max(50).optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  notes: z.string().optional(),
  payment: z
    .object({
      paidDate: z.coerce.date().optional(),
      mode: z.string().optional(),
      reference: z.string().optional(),
      amount: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

async function buildSnapshot(partnerId, caseId) {
  const partner = await Partner.findById(partnerId).lean();
  if (!partner) throw Object.assign(new Error('Partner not found'), { status: 404 });
  const snapshot = {
    partnerName: partner.name,
    partnerGST: partner.gstNumber,
  };
  if (caseId) {
    const c = await LoanCase.findById(caseId).lean();
    if (c) {
      snapshot.customerName = c.customerName;
      snapshot.bankName = c.bankName;
      snapshot.product = c.product;
      snapshot.loanAmount = c.loanAmount;
      snapshot.disbursedAmount = c.disbursedAmount;
    }
  }
  return snapshot;
}

export async function listInvoices(req, res) {
  const { status, partner, financialYear, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (partner) filter.partner = partner;
  if (financialYear) filter.financialYear = financialYear;
  if (dateFrom || dateTo) {
    filter.date = {};
    if (dateFrom) filter.date.$gte = new Date(dateFrom);
    if (dateTo) filter.date.$lte = new Date(dateTo);
  }
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ date: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('partner', 'name gstNumber email phone')
      .populate('loanCase', 'srNo customerName bankName')
      .lean(),
    Invoice.countDocuments(filter),
  ]);
  res.json({ items, total, page: pageNum, limit: limitNum });
}

export async function getInvoice(req, res) {
  const inv = await Invoice.findById(req.params.id)
    .populate('partner')
    .populate('loanCase', 'srNo customerName bankName product disbursedAmount')
    .lean();
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  res.json({ invoice: inv });
}

export async function createInvoice(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const { partner, loanCase, date, amount, gstRate, notes } = parsed.data;
  const snapshot = await buildSnapshot(partner, loanCase);

  const doc = await Invoice.create({
    partner,
    loanCase: loanCase || undefined,
    date: date || new Date(),
    amount,
    gstRate: gstRate ?? 18,
    notes,
    snapshot,
    createdBy: req.user._id,
  });

  await recordAudit({ req, action: 'create', resource: 'Invoice', resourceId: doc.id });
  res.status(201).json({ invoice: doc });
}

// Generate an invoice from a disbursed case using the partner's default commission %.
export async function generateFromCase(req, res) {
  const { caseId } = req.params;
  const c = await LoanCase.findById(caseId).lean();
  if (!c) return res.status(404).json({ error: 'Case not found' });

  const partnerId = req.body.partnerId;
  if (!partnerId) return res.status(400).json({ error: 'partnerId is required' });

  const partner = await Partner.findById(partnerId).lean();
  if (!partner) return res.status(404).json({ error: 'Partner not found' });

  const base = c.disbursedAmount || c.sanctionedAmount || 0;
  const amount = Math.round((base * (partner.commissionPercent || 0)) / 100);

  const snapshot = await buildSnapshot(partnerId, caseId);
  const doc = await Invoice.create({
    partner: partnerId,
    loanCase: caseId,
    amount,
    gstRate: req.body.gstRate ?? 18,
    snapshot,
    notes: `Auto-generated from case #${c.srNo}`,
    createdBy: req.user._id,
  });

  await recordAudit({ req, action: 'create', resource: 'Invoice', resourceId: doc.id, meta: { source: 'generate' } });
  res.status(201).json({ invoice: doc });
}

export async function updateInvoice(req, res) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  // Use save() so the pre-validate hook recomputes gstAmount/totalAmount.
  const doc = await Invoice.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Invoice not found' });
  Object.assign(doc, parsed.data);
  await doc.save();
  await recordAudit({ req, action: 'update', resource: 'Invoice', resourceId: doc.id });
  res.json({ invoice: doc });
}

export async function deleteInvoice(req, res) {
  const doc = await Invoice.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Invoice not found' });
  await recordAudit({ req, action: 'delete', resource: 'Invoice', resourceId: req.params.id });
  res.json({ ok: true });
}

export async function downloadPDF(req, res, next) {
  try {
    const inv = await Invoice.findById(req.params.id)
      .populate('partner')
      .populate('loanCase', 'srNo customerName bankName product disbursedAmount')
      .lean();
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    await recordAudit({ req, action: 'export', resource: 'Invoice', resourceId: inv._id });
    streamInvoicePDF(inv, res);
  } catch (err) {
    next(err);
  }
}
