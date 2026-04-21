import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ah } from '../utils/asyncHandler.js';
import {
  listInvoices,
  getInvoice,
  createInvoice,
  generateFromCase,
  updateInvoice,
  deleteInvoice,
  downloadPDF,
} from '../controllers/invoices.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', ah(listInvoices));
router.post('/', ah(createInvoice));
router.post('/generate/:caseId', ah(generateFromCase));
router.get('/:id', ah(getInvoice));
router.get('/:id/pdf', downloadPDF);
router.patch('/:id', ah(updateInvoice));
router.delete('/:id', ah(deleteInvoice));

export default router;
