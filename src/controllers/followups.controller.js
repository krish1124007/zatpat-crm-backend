import LoanCase from '../models/LoanCase.js';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Returns the next-followup tasks across all cases, bucketed into
// overdue / today / upcoming. We pull the latest follow-up entry per case
// (which carries the nextFollowUpDate) and let the client bucket them.
export async function inbox(req, res) {
  const days = Math.min(parseInt(req.query.days, 10) || 7, 60);
  const today = startOfDay();
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + days + 1);

  // Find cases that have at least one follow-up with a nextFollowUpDate <= horizon
  // and that aren't already closed.
  const cases = await LoanCase.find({
    currentStatus: { $nin: ['Rejected', 'Cancelled', 'NotInterested'] },
    'followUps.nextFollowUpDate': { $lt: horizon },
  })
    .select('srNo fileNumber customerName phone bankName channelName product loanAmount currentStatus followUps handledBy createdAt')
    .populate('handledBy', 'name')
    .lean();

  const items = [];
  for (const c of cases) {
    // Pick the follow-up with the latest nextFollowUpDate (most recent task).
    const candidates = (c.followUps || []).filter((f) => f.nextFollowUpDate);
    if (!candidates.length) continue;
    candidates.sort(
      (a, b) => new Date(b.nextFollowUpDate) - new Date(a.nextFollowUpDate)
    );
    const latest = candidates[0];

    items.push({
      caseId: c._id,
      srNo: c.srNo,
      fileNumber: c.fileNumber || '',
      customerName: c.customerName,
      phone: c.phone,
      bankName: c.bankName || '',
      channelName: c.channelName || '',
      product: c.product || '',
      loanAmount: c.loanAmount || 0,
      status: c.currentStatus,
      handler: c.handledBy?.name || '',
      nextFollowUpDate: latest.nextFollowUpDate,
      nextFollowUpDetails: latest.nextFollowUpDetails || '',
      lastDetails: latest.details || '',
      followUpType: latest.followUpType || 'FollowUp',
      createdAt: c.createdAt,
      totalFollowUps: c.followUps.length,
    });
  }

  // Sort earliest first (overdue at the top).
  items.sort((a, b) => new Date(a.nextFollowUpDate) - new Date(b.nextFollowUpDate));

  // Pre-bucket so the client doesn't need to know server's "today".
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const counts = { overdue: 0, today: 0, upcoming: 0 };
  for (const it of items) {
    const d = new Date(it.nextFollowUpDate);
    if (d < today) counts.overdue++;
    else if (d < tomorrow) counts.today++;
    else counts.upcoming++;
  }

  res.json({ items, counts, today: today.toISOString() });
}
