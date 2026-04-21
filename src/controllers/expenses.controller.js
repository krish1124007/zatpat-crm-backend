import { z } from 'zod';
import Expense, { EXPENSE_CATEGORIES, PAYMENT_TYPES } from '../models/Expense.js';
import { recordAudit } from '../middleware/auditLog.js';

const expenseSchema = z.object({
  date: z.coerce.date().optional(),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().int().nonnegative(),
  description: z.string().optional(),
  paymentType: z.string().optional(),
  loanCase: z.string().optional().nullable(),
  isRecurring: z.boolean().optional(),
});

export async function listExpenses(req, res) {
  const { category, dateFrom, dateTo, page = 1, limit = 100 } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (dateFrom || dateTo) {
    filter.date = {};
    if (dateFrom) filter.date.$gte = new Date(dateFrom);
    if (dateTo) filter.date.$lte = new Date(dateTo);
  }
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);

  const [items, total, totalAmountAgg] = await Promise.all([
    Expense.find(filter)
      .sort({ date: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('paidBy', 'name')
      .populate('loanCase', 'srNo customerName')
      .lean(),
    Expense.countDocuments(filter),
    Expense.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);

  res.json({
    items,
    total,
    page: pageNum,
    limit: limitNum,
    totalAmount: totalAmountAgg[0]?.total || 0,
  });
}

export async function createExpense(req, res) {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const data = { ...parsed.data, paidBy: req.user._id, createdBy: req.user._id };
  if (data.loanCase === '') data.loanCase = null;
  const doc = await Expense.create(data);
  await recordAudit({ req, action: 'create', resource: 'Expense', resourceId: doc.id });
  res.status(201).json({ expense: doc });
}

export async function updateExpense(req, res) {
  const parsed = expenseSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const doc = await Expense.findByIdAndUpdate(req.params.id, parsed.data, { new: true });
  if (!doc) return res.status(404).json({ error: 'Expense not found' });
  await recordAudit({ req, action: 'update', resource: 'Expense', resourceId: doc.id });
  res.json({ expense: doc });
}

export async function deleteExpense(req, res) {
  const doc = await Expense.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Expense not found' });
  await recordAudit({ req, action: 'delete', resource: 'Expense', resourceId: req.params.id });
  res.json({ ok: true });
}

export async function getExpenseCategories(_req, res) {
  res.json({ categories: EXPENSE_CATEGORIES, paymentTypes: PAYMENT_TYPES });
}
