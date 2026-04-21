import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ah } from '../utils/asyncHandler.js';
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseCategories,
} from '../controllers/expenses.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', ah(listExpenses));
router.get('/categories', ah(getExpenseCategories));
router.post('/', ah(createExpense));
router.patch('/:id', ah(updateExpense));
router.delete('/:id', ah(deleteExpense));

export default router;
