import { z } from 'zod';
import IPWhitelist from '../models/IPWhitelist.js';
import AuditLog from '../models/AuditLog.js';
import LoanCase from '../models/LoanCase.js';
import Partner from '../models/Partner.js';
import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import Salary from '../models/Salary.js';
import Insurance from '../models/Insurance.js';
import Contest from '../models/Contest.js';
import User from '../models/User.js';

// ──────────────── IP Whitelist ────────────────

export async function listIPs(_req, res) {
  const items = await IPWhitelist.find({}).sort({ createdAt: -1 }).lean();
  res.json({ items });
}

const ipSchema = z.object({
  ip: z.string().min(3),
  label: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function addIP(req, res) {
  const parsed = ipSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const item = await IPWhitelist.create({
      ...parsed.data,
      createdBy: req.user?._id,
    });
    res.status(201).json(item);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'IP already in whitelist' });
    throw e;
  }
}

export async function updateIP(req, res) {
  const updates = {};
  for (const k of ['label', 'isActive']) if (k in req.body) updates[k] = req.body[k];
  const item = await IPWhitelist.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
}

export async function deleteIP(req, res) {
  const item = await IPWhitelist.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}

// ──────────────── Audit Log ────────────────

export async function listAuditLogs(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const { action, userEmail, status } = req.query;
  const q = {};
  if (action) q.action = action;
  if (userEmail) q.userEmail = new RegExp(userEmail, 'i');
  if (status) q.status = status;

  const items = await AuditLog.find(q).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ items });
}

export async function auditFacets(_req, res) {
  const actions = await AuditLog.distinct('action');
  res.json({ actions: actions.sort() });
}

// ──────────────── Backup / Export ────────────────

// Returns a JSON snapshot of all collections. Admin/SuperAdmin only.
// Streams it inline as a download with a timestamped filename.
export async function exportBackup(_req, res) {
  const [
    users, cases, partners, invoices, expenses, salaries, insurance, contests, ipWhitelist,
  ] = await Promise.all([
    User.find({}).select('-passwordHash').lean(),
    LoanCase.find({}).lean(),
    Partner.find({}).lean(),
    Invoice.find({}).lean(),
    Expense.find({}).lean(),
    Salary.find({}).lean(),
    Insurance.find({}).lean(),
    Contest.find({}).lean(),
    IPWhitelist.find({}).lean(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    counts: {
      users: users.length,
      cases: cases.length,
      partners: partners.length,
      invoices: invoices.length,
      expenses: expenses.length,
      salaries: salaries.length,
      insurance: insurance.length,
      contests: contests.length,
      ipWhitelist: ipWhitelist.length,
    },
    data: { users, cases, partners, invoices, expenses, salaries, insurance, contests, ipWhitelist },
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="zatpat-backup-${stamp}.json"`);
  res.send(JSON.stringify(payload, null, 2));
}

// ──────────────── Staff / User Management ────────────────

export async function listUsers(_req, res) {
  const items = await User.find({}).select('-password').sort({ createdAt: -1 }).lean();
  res.json({ items });
}

const userCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(5),
  password: z.string().min(6),
  role: z.enum(['Admin', 'Manager', 'Employee']),
});

export async function createUser(req, res) {
  const parsed = userCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const user = await User.create(parsed.data);
    res.status(201).json({ user: user.toSafeJSON() });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Email or phone already in use' });
    throw e;
  }
}

const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(5).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['Admin', 'Manager', 'Employee']).optional(),
  isActive: z.boolean().optional(),
});

export async function updateUser(req, res) {
  const parsed = userUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const user = await User.findById(req.params.id).select('+password');
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'SuperAdmin') return res.status(403).json({ error: 'Cannot modify SuperAdmin' });
  Object.assign(user, parsed.data);
  await user.save();
  res.json({ user: user.toSafeJSON() });
}

export async function deleteUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'SuperAdmin') return res.status(403).json({ error: 'Cannot delete SuperAdmin' });
  await user.deleteOne();
  res.json({ ok: true });
}

// ──────────────── Super Search ────────────────

// Cross-resource search. Limited fan-out, capped per source so a noisy
// query can't spike load. Returns grouped results for the command palette.
export async function superSearch(req, res) {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ groups: [] });
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const [cases, partners, invoices, insurance] = await Promise.all([
    LoanCase.find({
      $or: [
        { customerName: re },
        { phone: re },
        { appId: re },
        { bankName: re },
      ],
    })
      .select('srNo customerName phone bankName currentStatus')
      .limit(8)
      .lean(),
    Partner.find({
      $or: [{ name: re }, { phone: re }, { gstNumber: re }],
    })
      .select('name phone commissionPercent isActive')
      .limit(5)
      .lean(),
    Invoice.find({
      $or: [{ invoiceNo: re }, { 'snapshot.customerName': re }, { 'snapshot.partnerName': re }],
    })
      .select('invoiceNo date totalAmount status snapshot')
      .limit(5)
      .lean(),
    Insurance.find({
      $or: [{ customerName: re }, { phone: re }, { policyNumber: re }],
    })
      .select('customerName phone type insurer status')
      .limit(5)
      .lean(),
  ]);

  res.json({
    groups: [
      { type: 'case', label: 'Cases', items: cases },
      { type: 'partner', label: 'Partners', items: partners },
      { type: 'invoice', label: 'Invoices', items: invoices },
      { type: 'insurance', label: 'Insurance', items: insurance },
    ].filter((g) => g.items.length > 0),
  });
}
