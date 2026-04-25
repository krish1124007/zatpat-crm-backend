import { z } from 'zod';
import DisbursementTracker from '../models/DisbursementTracker.js';
import { recordAudit } from '../middleware/auditLog.js';

const partPaymentSchema = z.object({
  date: z.coerce.date().optional(),
  amount: z.number().int().nonnegative(),
});

const disbursementTrackerSchema = z.object({
  customerName: z.string().min(1),
  mobileNumber: z.string().min(1),
  loanAmount: z.number().int().nonnegative().optional(),
  saleDeedAmount: z.number().int().nonnegative().optional(),
  ocrAmount: z.number().int().nonnegative().optional(),
  parallelFundingAmount: z.number().int().nonnegative().optional(),
  insuranceAmount: z.number().int().nonnegative().optional(),
  processingFeeAmount: z.number().int().nonnegative().optional(),
  partPayments: z.array(partPaymentSchema).optional(),
  isFullDisbursed: z.boolean().optional(),
});

export async function listDisbursementTrackers(req, res) {
  const { search, page = 1, limit = 100 } = req.query;
  const filter = {};
  
  if (search) {
    filter.$or = [
      { customerName: { $regex: search, $options: 'i' } },
      { mobileNumber: { $regex: search, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);

  const [items, total] = await Promise.all([
    DisbursementTracker.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    DisbursementTracker.countDocuments(filter),
  ]);

  res.json({
    items,
    total,
    page: pageNum,
    limit: limitNum,
  });
}

export async function createDisbursementTracker(req, res) {
  const parsed = disbursementTrackerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const data = { ...parsed.data, createdBy: req.user._id, updatedBy: req.user._id };
  const doc = await DisbursementTracker.create(data);
  await recordAudit({ req, action: 'create', resource: 'DisbursementTracker', resourceId: doc.id });
  res.status(201).json({ item: doc });
}

export async function updateDisbursementTracker(req, res) {
  const parsed = disbursementTrackerSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const data = { ...parsed.data, updatedBy: req.user._id };
  const doc = await DisbursementTracker.findByIdAndUpdate(req.params.id, data, { new: true });
  if (!doc) return res.status(404).json({ error: 'Not found' });
  await recordAudit({ req, action: 'update', resource: 'DisbursementTracker', resourceId: doc.id });
  res.json({ item: doc });
}

export async function deleteDisbursementTracker(req, res) {
  const doc = await DisbursementTracker.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  await recordAudit({ req, action: 'delete', resource: 'DisbursementTracker', resourceId: req.params.id });
  res.json({ ok: true });
}
