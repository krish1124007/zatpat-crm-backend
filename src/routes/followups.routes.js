import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ah } from '../utils/asyncHandler.js';
import { inbox } from '../controllers/followups.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/inbox', ah(inbox));

export default router;
