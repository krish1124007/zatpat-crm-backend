import LoanCase, { LOAN_STATUSES } from '../models/LoanCase.js';
import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import User from '../models/User.js';

const ACTIVE_STATUSES = LOAN_STATUSES.filter(
  (s) => !['Disbursed', 'Rejected', 'Cancelled', 'NotInterested'].includes(s)
);

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// ── Main KPIs ──
export async function getKpis(_req, res) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const monthStart = startOfMonth(now);
  const nextMonthStart = new Date(monthStart);
  nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);

  const [
    totalCases,
    activeCount,
    monthDisbursedAgg,
    pendingPaymentAgg,
    todayFollowUpsCount,
    monthInvoicePaidAgg,
    monthExpenseAgg,
    monthNewCases,
    totalDisbursedEver,
    avgLoanAmountAgg,
    sanctionedNotDisbursedAgg,
  ] = await Promise.all([
    LoanCase.countDocuments({}),
    LoanCase.countDocuments({ currentStatus: { $in: ACTIVE_STATUSES } }),
    LoanCase.aggregate([
      { $match: { currentStatus: 'Disbursed', disbursementDate: { $gte: monthStart, $lt: nextMonthStart } } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$disbursedAmount' } } },
    ]),
    LoanCase.aggregate([
      { $match: { pendingPaymentAmount: { $gt: 0 } } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$pendingPaymentAmount' } } },
    ]),
    LoanCase.countDocuments({ 'followUps.nextFollowUpDate': { $gte: todayStart, $lt: tomorrowStart } }),
    Invoice.aggregate([
      { $match: { status: 'Paid', 'payment.paidDate': { $gte: monthStart, $lt: nextMonthStart } } },
      { $group: { _id: null, count: { $sum: 1 }, commission: { $sum: '$amount' }, totalWithGst: { $sum: '$totalAmount' } } },
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: monthStart, $lt: nextMonthStart } } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    LoanCase.countDocuments({ createdAt: { $gte: monthStart, $lt: nextMonthStart } }),
    LoanCase.aggregate([
      { $match: { currentStatus: 'Disbursed' } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$disbursedAmount' } } },
    ]),
    LoanCase.aggregate([
      { $match: { loanAmount: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: '$loanAmount' } } },
    ]),
    LoanCase.aggregate([
      { $match: { currentStatus: 'Sanctioned' } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$sanctionedAmount' } } },
    ]),
  ]);

  const monthDisbursed = monthDisbursedAgg[0] || { count: 0, amount: 0 };
  const pendingPayment = pendingPaymentAgg[0] || { count: 0, amount: 0 };
  const monthInvoice = monthInvoicePaidAgg[0] || { count: 0, commission: 0, totalWithGst: 0 };
  const monthExpense = monthExpenseAgg[0] || { count: 0, amount: 0 };
  const totalDisbursed = totalDisbursedEver[0] || { count: 0, amount: 0 };
  const avgLoanAmount = avgLoanAmountAgg[0]?.avg || 0;
  const sanctionedPending = sanctionedNotDisbursedAgg[0] || { count: 0, amount: 0 };

  res.json({
    totalCases,
    activeCases: activeCount,
    monthDisbursed,
    pendingPayment,
    todayFollowUps: todayFollowUpsCount,
    monthCommissionPaid: monthInvoice.commission,
    monthCommissionWithGst: monthInvoice.totalWithGst,
    monthExpenses: monthExpense.amount,
    monthExpenseCount: monthExpense.count,
    monthNewCases,
    totalDisbursed,
    avgLoanAmount: Math.round(avgLoanAmount),
    sanctionedPending,
    monthNetIncome: (monthInvoice.commission || 0) - (monthExpense.amount || 0),
  });
}

// ── Status Breakdown ──
export async function statusBreakdown(_req, res) {
  const agg = await LoanCase.aggregate([
    { $group: { _id: '$currentStatus', count: { $sum: 1 }, totalAmount: { $sum: '$loanAmount' } } },
  ]);
  const map = Object.fromEntries(agg.map((r) => [r._id, r]));
  const items = LOAN_STATUSES.map((s) => ({
    status: s,
    count: map[s]?.count || 0,
    totalAmount: map[s]?.totalAmount || 0,
  }));
  res.json({ items, total: items.reduce((a, x) => a + x.count, 0) });
}

// ── Monthly Trend (disbursed + new cases) ──
export async function monthlyTrend(req, res) {
  const months = Math.min(parseInt(req.query.months, 10) || 6, 24);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const [disbursedAgg, createdAgg] = await Promise.all([
    LoanCase.aggregate([
      { $match: { currentStatus: 'Disbursed', disbursementDate: { $gte: start } } },
      { $group: { _id: { y: { $year: '$disbursementDate' }, m: { $month: '$disbursementDate' } }, count: { $sum: 1 }, amount: { $sum: '$disbursedAmount' } } },
    ]),
    LoanCase.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
  ]);

  const key = (y, m) => `${y}-${m}`;
  const disbLookup = new Map(disbursedAgg.map((r) => [key(r._id.y, r._id.m), r]));
  const newLookup = new Map(createdAgg.map((r) => [key(r._id.y, r._id.m), r]));

  const items = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const k = key(d.getFullYear(), d.getMonth() + 1);
    const disb = disbLookup.get(k);
    const newC = newLookup.get(k);
    items.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleString('en-IN', { month: 'short' }),
      disbursedCount: disb?.count || 0,
      disbursedAmount: disb?.amount || 0,
      newCases: newC?.count || 0,
    });
  }
  res.json({ items });
}

// ── Top Banks ──
export async function topBanks(_req, res) {
  const monthStart = startOfMonth();
  const agg = await LoanCase.aggregate([
    { $match: { currentStatus: 'Disbursed', disbursementDate: { $gte: monthStart }, bankName: { $ne: '' } } },
    { $group: { _id: '$bankName', count: { $sum: 1 }, amount: { $sum: '$disbursedAmount' } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);
  res.json({ items: agg.map((r) => ({ bank: r._id, count: r.count, amount: r.amount })) });
}

// ── Recent Cases ──
export async function recentCases(_req, res) {
  const items = await LoanCase.find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .select('srNo customerName bankName product currentStatus loanAmount createdAt handledBy')
    .populate('handledBy', 'name')
    .lean();
  res.json({ items });
}

// ── Channel Breakdown ──
export async function channelBreakdown(_req, res) {
  const agg = await LoanCase.aggregate([
    { $group: { _id: '$channelName', count: { $sum: 1 }, disbursedCount: { $sum: { $cond: [{ $eq: ['$currentStatus', 'Disbursed'] }, 1, 0] } }, totalLoanAmount: { $sum: '$loanAmount' }, totalDisbursed: { $sum: { $cond: [{ $eq: ['$currentStatus', 'Disbursed'] }, '$disbursedAmount', 0] } } } },
    { $sort: { count: -1 } },
  ]);
  res.json({ items: agg.map((r) => ({ channel: r._id || 'Unknown', count: r.count, disbursedCount: r.disbursedCount, totalLoanAmount: r.totalLoanAmount, totalDisbursed: r.totalDisbursed })) });
}

// ── Handler Performance ──
export async function handlerPerformance(_req, res) {
  const monthStart = startOfMonth();
  const agg = await LoanCase.aggregate([
    { $match: { handledBy: { $ne: null } } },
    { $group: {
      _id: '$handledBy',
      totalCases: { $sum: 1 },
      activeCases: { $sum: { $cond: [{ $in: ['$currentStatus', ACTIVE_STATUSES] }, 1, 0] } },
      disbursedCases: { $sum: { $cond: [{ $eq: ['$currentStatus', 'Disbursed'] }, 1, 0] } },
      disbursedAmount: { $sum: { $cond: [{ $eq: ['$currentStatus', 'Disbursed'] }, '$disbursedAmount', 0] } },
      monthDisbursed: { $sum: { $cond: [{ $and: [{ $eq: ['$currentStatus', 'Disbursed'] }, { $gte: ['$disbursementDate', monthStart] }] }, 1, 0] } },
    }},
    { $sort: { disbursedCases: -1 } },
  ]);

  // Populate handler names
  const userIds = agg.map((r) => r._id);
  const users = await User.find({ _id: { $in: userIds } }).select('name role').lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const items = agg.map((r) => ({
    handler: userMap.get(r._id.toString()) || { name: 'Unknown' },
    totalCases: r.totalCases,
    activeCases: r.activeCases,
    disbursedCases: r.disbursedCases,
    disbursedAmount: r.disbursedAmount,
    monthDisbursed: r.monthDisbursed,
  }));

  res.json({ items });
}

// ── Product Breakdown ──
export async function productBreakdown(_req, res) {
  const agg = await LoanCase.aggregate([
    { $group: { _id: '$product', count: { $sum: 1 }, totalAmount: { $sum: '$loanAmount' }, disbursedCount: { $sum: { $cond: [{ $eq: ['$currentStatus', 'Disbursed'] }, 1, 0] } } } },
    { $sort: { count: -1 } },
  ]);
  res.json({ items: agg.map((r) => ({ product: r._id, count: r.count, totalAmount: r.totalAmount, disbursedCount: r.disbursedCount })) });
}

// ── Pipeline Summary: how many at each stage ──
export async function pipelineSummary(_req, res) {
  const now = new Date();
  const monthStart = startOfMonth(now);

  const [statusAgg, overdueFollowUps, pendingInsurance] = await Promise.all([
    LoanCase.aggregate([
      { $group: { _id: '$currentStatus', count: { $sum: 1 }, totalLoan: { $sum: '$loanAmount' } } },
    ]),
    LoanCase.countDocuments({
      currentStatus: { $nin: ['Rejected', 'Cancelled', 'NotInterested'] },
      'followUps.nextFollowUpDate': { $lt: startOfDay() },
    }),
    LoanCase.countDocuments({
      currentStatus: 'Disbursed',
      insuranceStatus: { $in: ['', 'Pending'] },
    }),
  ]);

  const statusMap = Object.fromEntries(statusAgg.map((r) => [r._id, r]));

  // Pipeline stages in order
  const pipeline = [
    'Query', 'ReadyLogin', 'Hold', 'LoginDone', 'UnderProcess',
    'BankFinalized', 'Sanctioned', 'Disbursed',
  ].map((s) => ({
    status: s,
    count: statusMap[s]?.count || 0,
    totalLoan: statusMap[s]?.totalLoan || 0,
  }));

  res.json({
    pipeline,
    overdueFollowUps,
    pendingInsurance,
    rejected: statusMap['Rejected']?.count || 0,
    cancelled: statusMap['Cancelled']?.count || 0,
    notInterested: statusMap['NotInterested']?.count || 0,
  });
}
