import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ah } from '../utils/asyncHandler.js';
import {
  listPartners,
  getPartner,
  createPartner,
  updatePartner,
  deletePartner,
} from '../controllers/partners.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', ah(listPartners));
router.post('/', ah(createPartner));
router.get('/:id', ah(getPartner));
router.patch('/:id', ah(updatePartner));
router.delete('/:id', ah(deletePartner));

export default router;
