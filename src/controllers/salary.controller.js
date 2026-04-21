import { z } from 'zod';
import Salary from '../models/Salary.js';
import User from '../models/User.js';
import LoanCase from '../models/LoanCase.js';
import { recordAudit } from '../middleware/auditLog.js';

const salarySchema = z.object({
  employee: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  basicSalary: z.number().int().nonnegative().optional(),
  allowances: z.number().int().nonnegative().optional(),
  deductions: z.number().int().nonnegative().optional(),
  incentiveAmount: z.number().int().nonnegative().optional(),
  incentiveDetails: z.string().optional(),
  paymentDate: z.coerce.date().optional(),
  paymentMode: z.string().optional(),
  notes: z.string().optional(),
});

// Default incentive slabs (in paisa). Edit here or move to a Settings collection later.
const INCENTIVE_SLABS = [
  { min: 10, amount: 1500000 }, // ₹15,000 for 10+ disbursements
  { min: 5, amount: 500000 },   // ₹5,000  for 5–9
  { min: 1, amount: 100000 },   // ₹1,000  for 1–4
  { min: 0, amount: 0 },
];

function computeIncentive(disbursedCount) {
  for (const slab of INCENTIVE_SLABS) {
    if (disbursedCount >= slab.min) return slab.amount;
  }
  return 0;
}

export async function listSalaries(req, res) {
  const { month, year, employee } = req.query;
  const filter = {};
  if (month) filter.month = parseInt(month, 10);
  if (year) filter.year = parseInt(year, 10);
  if (employee) filter.employee = employee;
  const items = await Salary.find(filter)
    .sort({ year: -1, month: -1 })
    .populate('employee', 'name email role')
    .lean();
  res.json({ items, total: items.length });
}

export async function upsertSalary(req, res) {
  const parsed = salarySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const { employee, month, year } = parsed.data;
  let doc = await Salary.findOne({ employee, month, year });
  if (doc) {
    Object.assign(doc, parsed.data);
  } else {
    doc = new Salary({ ...parsed.data, createdBy: req.user._id });
  }
  await doc.save();
  await recordAudit({ req, action: doc.isNew ? 'create' : 'update', resource: 'Salary', resourceId: doc.id });
  res.status(201).json({ salary: doc });
}

export async function deleteSalary(req, res) {
  const doc = await Salary.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Salary record not found' });
  await recordAudit({ req, action: 'delete', resource: 'Salary', resourceId: req.params.id });
  res.json({ ok: true });
}

// Suggest an incentive amount based on disbursed cases in the given month for an employee.
export async function suggestIncentive(req, res) {
  const { employee, month, year } = req.query;
  if (!employee || !month || !year) {
    return res.status(400).json({ error: 'employee, month, year are required' });
  }
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);

  const disbursedCount = await LoanCase.countDocuments({
    handledBy: employee,
    currentStatus: 'Disbursed',
    disbursementDate: { $gte: start, $lt: end },
  });

  res.json({
    disbursedCount,
    suggestedIncentivePaisa: computeIncentive(disbursedCount),
    slabs: INCENTIVE_SLABS,
  });
}

export async function listEmployees(_req, res) {
  const items = await User.find({ isActive: true }).select('name email role').sort({ name: 1 }).lean();
  res.json({ items });
}
