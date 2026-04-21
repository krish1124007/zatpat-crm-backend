import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ah } from '../utils/asyncHandler.js';
import {
  listInsurance,
  getInsurance,
  createInsurance,
  updateInsurance,
  deleteInsurance,
  getInsuranceMeta,
} from '../controllers/insurance.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/meta', getInsuranceMeta);
router.get('/', ah(listInsurance));
router.post('/', ah(createInsurance));
router.get('/:id', ah(getInsurance));
router.patch('/:id', ah(updateInsurance));
router.delete('/:id', ah(deleteInsurance));

export default router;
