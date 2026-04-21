import { z } from 'zod';
import Insurance, { INSURANCE_TYPES, INSURANCE_STATUSES } from '../models/Insurance.js';

const UPDATABLE = [
  'customerName', 'phone', 'email',
  'type', 'insurer', 'policyNumber',
  'sumAssured', 'premium', 'commission',
  'startDate', 'renewalDate',
  'status', 'notes',
  'loanCase', 'handledBy',
];

const baseSchema = z.object({
  customerName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  type: z.enum(INSURANCE_TYPES).optional(),
  insurer: z.string().optional(),
  policyNumber: z.string().optional(),
  sumAssured: z.number().int().nonnegative().optional(),
  premium: z.number().int().nonnegative().optional(),
  commission: z.number().int().nonnegative().optional(),
  startDate: z.string().optional(),
  renewalDate: z.string().optional(),
  status: z.enum(INSURANCE_STATUSES).optional(),
  notes: z.string().optional(),
  loanCase: z.string().optional(),
});

export async function listInsurance(req, res) {
  const { status, type, search, renewalSoon } = req.query;
  const q = {};
  if (status) q.status = status;
  if (type) q.type = type;
  if (search) {
    q.$or = [
      { customerName: new RegExp(search, 'i') },
      { phone: new RegExp(search, 'i') },
      { policyNumber: new RegExp(search, 'i') },
    ];
  }
  if (renewalSoon === 'true') {
    const now = new Date();
    const in30 = new Date(now);
    in30.setDate(in30.getDate() + 30);
    q.renewalDate = { $gte: now, $lte: in30 };
  }
  const items = await Insurance.find(q).sort({ createdAt: -1 }).limit(500).lean();
  res.json({ items });
}

export async function getInsurance(req, res) {
  const item = await Insurance.findById(req.params.id).lean();
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
}

export async function createInsurance(req, res) {
  const parsed = baseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await Insurance.create({
    ...parsed.data,
    createdBy: req.user?._id,
  });
  res.status(201).json(item);
}

export async function updateInsurance(req, res) {
  const updates = {};
  for (const k of UPDATABLE) {
    if (k in req.body) updates[k] = req.body[k];
  }
  const item = await Insurance.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
}

export async function deleteInsurance(req, res) {
  const item = await Insurance.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}

export function getInsuranceMeta(_req, res) {
  res.json({ types: INSURANCE_TYPES, statuses: INSURANCE_STATUSES });
}
