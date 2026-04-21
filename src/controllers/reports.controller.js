import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import Salary from '../models/Salary.js';

function monthRange(month, year) {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

// GST monthly summary, computed on-the-fly from invoices.
// Default split for an Ahmedabad firm (intra-state) is CGST + SGST 50/50.
// Exposes both gross collected (all invoices in month) and "payable" (Paid only),
// since the firm only owes GST on invoices it has actually been paid for.
export async function gstSummary(req, res) {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year are required' });
  const { start, end } = monthRange(month, year);

  const agg = await Invoice.aggregate([
    { $match: { date: { $gte: start, $lt: end }, status: { $ne: 'Cancelled' } } },
    {
      $group: {
        _id: '$status',
        baseAmount: { $sum: '$amount' },
        gstAmount: { $sum: '$gstAmount' },
        totalAmount: { $sum: '$totalAmount' },
        count: { $sum: 1 },
      },
    },
  ]);

  let collectedGst = 0;
  let payableGst = 0;
  let collectedTotal = 0;
  let pendingTotal = 0;
  let invoiceCount = 0;

  for (const row of agg) {
    invoiceCount += row.count;
    collectedGst += row.gstAmount;
    collectedTotal += row.totalAmount;
    if (row._id === 'Paid') payableGst += row.gstAmount;
    if (row._id === 'Pending') pendingTotal += row.totalAmount;
  }

  res.json({
    month: parseInt(month, 10),
    year: parseInt(year, 10),
    invoiceCount,
    collectedGst,
    payableGst,
    cgst: Math.round(payableGst / 2),
    sgst: Math.round(payableGst / 2),
    igst: 0, // intra-state default; flip later if cross-state invoices added
    collectedTotal,
    pendingTotal,
  });
}

// Monthly P&L computed from paid invoices (income), expenses, and salaries.
export async function monthlyPnL(req, res) {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year are required' });
  const { start, end } = monthRange(month, year);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  const [incomeAgg, expenseAgg, salaryAgg] = await Promise.all([
    Invoice.aggregate([
      { $match: { date: { $gte: start, $lt: end }, status: 'Paid' } },
      {
        $group: {
          _id: null,
          base: { $sum: '$amount' },
          gst: { $sum: '$gstAmount' },
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
    Salary.aggregate([
      { $match: { month: m, year: y } },
      {
        $group: {
          _id: null,
          totalNetPay: { $sum: '$netPay' },
          totalIncentives: { $sum: '$incentiveAmount' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const income = incomeAgg[0] || { base: 0, gst: 0, total: 0, count: 0 };
  const salary = salaryAgg[0] || { totalNetPay: 0, totalIncentives: 0, count: 0 };

  const expensesByCategory = expenseAgg.map((e) => ({
    category: e._id,
    amount: e.total,
    count: e.count,
  }));
  const totalExpenses = expensesByCategory.reduce((a, e) => a + e.amount, 0);
  const totalSalaries = salary.totalNetPay;

  const totalIncome = income.base; // base commission, GST excluded from P&L
  const totalOutflow = totalExpenses + totalSalaries;
  const netProfit = totalIncome - totalOutflow;

  res.json({
    month: m,
    year: y,
    income: {
      invoiceCount: income.count,
      commission: income.base,
      gstCollected: income.gst,
      grossInvoiced: income.total,
    },
    expenses: {
      byCategory: expensesByCategory,
      total: totalExpenses,
    },
    salaries: {
      employeeCount: salary.count,
      totalNetPay: totalSalaries,
      totalIncentives: salary.totalIncentives,
    },
    summary: {
      totalIncome,
      totalExpenses,
      totalSalaries,
      totalOutflow,
      netProfit,
    },
  });
}
