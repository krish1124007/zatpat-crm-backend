import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ah } from '../utils/asyncHandler.js';
import {
  listSalaries,
  upsertSalary,
  deleteSalary,
  suggestIncentive,
  listEmployees,
} from '../controllers/salary.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', ah(listSalaries));
router.post('/', ah(upsertSalary));
router.delete('/:id', ah(deleteSalary));
router.get('/incentive/suggest', ah(suggestIncentive));
router.get('/employees', ah(listEmployees));

export default router;
