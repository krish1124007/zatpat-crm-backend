import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ah } from '../utils/asyncHandler.js';
import {
  listContests,
  getContest,
  createContest,
  updateContest,
  deleteContest,
  getLeaderboard,
  getContestMeta,
} from '../controllers/contests.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/meta', getContestMeta);
router.get('/', ah(listContests));
router.post('/', ah(createContest));
router.get('/:id', ah(getContest));
router.patch('/:id', ah(updateContest));
router.delete('/:id', ah(deleteContest));
router.get('/:id/leaderboard', ah(getLeaderboard));

export default router;
