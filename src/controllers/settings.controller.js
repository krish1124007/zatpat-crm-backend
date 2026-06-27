import Setting from '../models/Setting.js';
import { LOAN_STATUSES } from '../models/LoanCase.js';

// Read the global settings (SLA day-limits). Available to any logged-in user so
// the dashboard can show limits; editing is admin-only (see route guard).
export async function getSettings(_req, res) {
  const doc = await Setting.getGlobal();
  res.json({
    slaDaysByStatus: Object.fromEntries(doc.slaDaysByStatus || []),
    statuses: LOAN_STATUSES,
  });
}

// Replace/merge the per-stage overdue day-limits. Admin/SuperAdmin only.
export async function updateSlaDays(req, res) {
  const { slaDaysByStatus } = req.body;
  if (!slaDaysByStatus || typeof slaDaysByStatus !== 'object') {
    return res.status(400).json({ error: 'slaDaysByStatus object is required' });
  }
  const doc = await Setting.getGlobal();
  for (const [status, days] of Object.entries(slaDaysByStatus)) {
    if (!LOAN_STATUSES.includes(status)) continue;
    const n = Number(days);
    doc.slaDaysByStatus.set(status, Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
  }
  await doc.save();
  res.json({ slaDaysByStatus: Object.fromEntries(doc.slaDaysByStatus) });
}
