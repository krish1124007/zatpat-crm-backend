import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { ah } from '../utils/asyncHandler.js';
import {
  listCases,
  getCase,
  createCase,
  updateCase,
  deleteCase,
  addFollowUp,
  addPayment,
  getCaseFacets,
  downloadExpenseSheet,
  downloadOfferLetter,
  listReferencePartners,
  listPartPayments,
  uploadSanctionLetter,
  getDropdownOptions,
  createDropdownOption,
  getAllDropdownOptions,
} from '../controllers/cases.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', ah(listCases));
router.post('/', ah(createCase));
router.get('/facets', ah(getCaseFacets));
router.get('/reference-partners', ah(listReferencePartners));
router.get('/part-payments', ah(listPartPayments));

// Dropdown options endpoints
router.get('/dropdowns/all', ah(getAllDropdownOptions));
router.get('/dropdowns/options', ah(getDropdownOptions));
router.post('/dropdowns/options', ah(createDropdownOption));

router.get('/:id', ah(getCase));
router.patch('/:id', ah(updateCase));
router.delete('/:id', ah(deleteCase));

router.post('/:id/followups', ah(addFollowUp));
router.post('/:id/payments/:kind', ah(addPayment));
router.post('/:id/sanction-letter', upload.single('file'), ah(uploadSanctionLetter));

router.get('/:id/expense-sheet.pdf', ah(downloadExpenseSheet));
router.get('/:id/offer-letter.pdf', ah(downloadOfferLetter));

export default router;
