import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ah } from '../utils/asyncHandler.js';
import {
  getKpis,
  statusBreakdown,
  monthlyTrend,
  topBanks,
  recentCases,
  channelBreakdown,
  handlerPerformance,
  productBreakdown,
  pipelineSummary,
} from '../controllers/dashboard.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/kpis', ah(getKpis));
router.get('/status-breakdown', ah(statusBreakdown));
router.get('/monthly-trend', ah(monthlyTrend));
router.get('/top-banks', ah(topBanks));
router.get('/recent-cases', ah(recentCases));
router.get('/channel-breakdown', ah(channelBreakdown));
router.get('/handler-performance', ah(handlerPerformance));
router.get('/product-breakdown', ah(productBreakdown));
router.get('/pipeline-summary', ah(pipelineSummary));

export default router;
