import { Router } from 'express';
import * as controller from '../controllers/disbursementTracker.controller.js';
import { requireRole } from '../middleware/roleGuard.js';

import { requireAuth } from '../middleware/auth.js';
import { ah } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

// Allow all logged in users to list and create
router.get('/', ah(controller.listDisbursementTrackers));
router.post('/', ah(controller.createDisbursementTracker));

// Only admins can delete, but anyone can update their own/others (depending on CRM policy, here we keep it simple)
router.patch('/:id', ah(controller.updateDisbursementTracker));
router.delete('/:id', requireRole('Admin'), ah(controller.deleteDisbursementTracker));


export default router;
