import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ah } from '../utils/asyncHandler.js';
import { gstSummary, monthlyPnL } from '../controllers/reports.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/gst', ah(gstSummary));
router.get('/pnl', ah(monthlyPnL));

export default router;
