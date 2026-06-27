import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { ah } from '../utils/asyncHandler.js';
import { getSettings, updateSlaDays } from '../controllers/settings.controller.js';

const router = Router();
router.use(requireAuth);

// Anyone logged-in can read settings.
router.get('/', ah(getSettings));

// Only Admin/SuperAdmin can change the overdue day-limits.
router.put('/sla', requireRole('Admin', 'SuperAdmin'), ah(updateSlaDays));

export default router;
