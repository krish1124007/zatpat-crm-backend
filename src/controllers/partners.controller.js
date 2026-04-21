import { z } from 'zod';
import Partner from '../models/Partner.js';
import { recordAudit } from '../middleware/auditLog.js';

const partnerSchema = z.object({
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  gstNumber: z.string().optional(),
  linkedLeader: z.string().optional().nullable(),
  commissionPercent: z.number().min(0).max(100).optional(),
  bankDetails: z
    .object({
      accountName: z.string().optional(),
      accountNumber: z.string().optional(),
      ifsc: z.string().optional(),
      bankName: z.string().optional(),
    })
    .optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function listPartners(req, res) {
  const { search, active } = req.query;
  const filter = {};
  if (active === 'true') filter.isActive = true;
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { contactPerson: rx }, { phone: rx }, { email: rx }];
  }
  const items = await Partner.find(filter).sort({ name: 1 }).populate('linkedLeader', 'name email').lean();
  res.json({ items, total: items.length });
}

export async function getPartner(req, res) {
  const p = await Partner.findById(req.params.id).populate('linkedLeader', 'name email').lean();
  if (!p) return res.status(404).json({ error: 'Partner not found' });
  res.json({ partner: p });
}

export async function createPartner(req, res) {
  const parsed = partnerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const data = { ...parsed.data, createdBy: req.user._id };
  if (data.linkedLeader === '') data.linkedLeader = null;
  const doc = await Partner.create(data);
  await recordAudit({ req, action: 'create', resource: 'Partner', resourceId: doc.id });
  res.status(201).json({ partner: doc });
}

export async function updatePartner(req, res) {
  const parsed = partnerSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const data = parsed.data;
  if (data.linkedLeader === '') data.linkedLeader = null;
  const doc = await Partner.findByIdAndUpdate(req.params.id, data, { new: true });
  if (!doc) return res.status(404).json({ error: 'Partner not found' });
  await recordAudit({ req, action: 'update', resource: 'Partner', resourceId: doc.id });
  res.json({ partner: doc });
}

export async function deletePartner(req, res) {
  const doc = await Partner.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Partner not found' });
  await recordAudit({ req, action: 'delete', resource: 'Partner', resourceId: req.params.id });
  res.json({ ok: true });
}
