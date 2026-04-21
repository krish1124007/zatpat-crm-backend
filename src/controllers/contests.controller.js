import { z } from 'zod';
import Contest, { CONTEST_METRICS, CONTEST_STATUSES } from '../models/Contest.js';
import LoanCase from '../models/LoanCase.js';
import Invoice from '../models/Invoice.js';

const UPDATABLE = [
  'name', 'description', 'startDate', 'endDate',
  'metric', 'target', 'participants', 'prizes', 'status',
  'bankName', 'productName', 'contestPercentage', 'contestDetails',
];

const contestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  metric: z.enum(CONTEST_METRICS).optional(),
  target: z.number().int().nonnegative().optional(),
  participants: z.array(z.string()).optional(),
  prizes: z
    .array(
      z.object({
        rank: z.number().int().positive(),
        title: z.string().optional(),
        rewardAmount: z.number().int().nonnegative().optional(),
      })
    )
    .optional(),
  status: z.enum(CONTEST_STATUSES).optional(),
  bankName: z.string().optional(),
  productName: z.string().optional(),
  contestPercentage: z.number().nonnegative().optional(),
  contestDetails: z.string().optional(),
});

export async function listContests(req, res) {
  const { status } = req.query;
  const q = {};
  if (status) q.status = status;
  const items = await Contest.find(q)
    .sort({ startDate: -1 })
    .populate('participants', 'name role')
    .lean();
  res.json({ items });
}

export async function getContest(req, res) {
  const item = await Contest.findById(req.params.id)
    .populate('participants', 'name role')
    .lean();
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
}

export async function createContest(req, res) {
  const parsed = contestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await Contest.create({
    ...parsed.data,
    createdBy: req.user?._id,
  });
  res.status(201).json(item);
}

export async function updateContest(req, res) {
  const updates = {};
  for (const k of UPDATABLE) if (k in req.body) updates[k] = req.body[k];
  const item = await Contest.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
}

export async function deleteContest(req, res) {
  const item = await Contest.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}

// Live leaderboard for a contest — counts disbursed cases (or amount/commission)
// per participant within the contest window. If no participants set, counts all
// users that show up as handledBy.
export async function getLeaderboard(req, res) {
  const contest = await Contest.findById(req.params.id)
    .populate('participants', 'name role')
    .lean();
  if (!contest) return res.status(404).json({ error: 'Not found' });

  const match = {
    currentStatus: 'Disbursed',
    disbursementDate: { $gte: contest.startDate, $lte: contest.endDate },
  };
  if (contest.participants?.length) {
    match.handledBy = { $in: contest.participants.map((p) => p._id) };
  }

  const agg = await LoanCase.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$handledBy',
        disbursedCount: { $sum: 1 },
        disbursedAmount: { $sum: '$disbursedAmount' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
  ]);

  // Optional commission lookup if metric is CommissionEarned.
  let commissionByUser = new Map();
  if (contest.metric === 'CommissionEarned') {
    const cases = await LoanCase.find(match).select('_id handledBy').lean();
    const caseToUser = new Map(cases.map((c) => [String(c._id), String(c.handledBy)]));
    const invs = await Invoice.find({
      loanCase: { $in: cases.map((c) => c._id) },
      status: 'Paid',
    })
      .select('loanCase amount')
      .lean();
    for (const inv of invs) {
      const uid = caseToUser.get(String(inv.loanCase));
      if (!uid) continue;
      commissionByUser.set(uid, (commissionByUser.get(uid) || 0) + inv.amount);
    }
  }

  const rows = agg.map((r) => ({
    userId: r._id,
    name: r.user?.name || 'Unknown',
    role: r.user?.role || '',
    disbursedCount: r.disbursedCount,
    disbursedAmount: r.disbursedAmount,
    commission: commissionByUser.get(String(r._id)) || 0,
  }));

  const scoreOf = (row) => {
    if (contest.metric === 'DisbursedAmount') return row.disbursedAmount;
    if (contest.metric === 'CommissionEarned') return row.commission;
    return row.disbursedCount;
  };
  rows.sort((a, b) => scoreOf(b) - scoreOf(a));
  rows.forEach((r, i) => {
    r.rank = i + 1;
    r.score = scoreOf(r);
  });

  res.json({
    contest: {
      _id: contest._id,
      name: contest.name,
      metric: contest.metric,
      target: contest.target,
      startDate: contest.startDate,
      endDate: contest.endDate,
      status: contest.status,
      prizes: contest.prizes,
    },
    rows,
  });
}

export function getContestMeta(_req, res) {
  res.json({ metrics: CONTEST_METRICS, statuses: CONTEST_STATUSES });
}
