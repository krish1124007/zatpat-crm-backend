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
  restoreCase,
  addFollowUp,
  addPayment,
  getCaseFacets,
  checkDuplicateCase,
  downloadExpenseSheet,
  downloadOfferLetter,
  listReferencePartners,
  referencePartnersAutocomplete,
  bankersAutocomplete,
  uploadSanctionLetter,
  getDropdownOptions,
  createDropdownOption,
  getAllDropdownOptions,
  deleteDropdownOption,
} from '../controllers/cases.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', ah(listCases));
router.post('/', ah(createCase));
router.get('/facets', ah(getCaseFacets));
router.get('/check-duplicate', ah(checkDuplicateCase));
router.get('/reference-partners', ah(listReferencePartners));
router.get('/reference-partners-autocomplete', ah(referencePartnersAutocomplete));
router.get('/bankers-autocomplete', ah(bankersAutocomplete));

// Dropdown options endpoints
router.get('/dropdowns/all', ah(getAllDropdownOptions));
router.get('/dropdowns/options', ah(getDropdownOptions));
router.post('/dropdowns/options', ah(createDropdownOption));
router.delete('/dropdowns/options/:optionId', ah(deleteDropdownOption));

router.get('/:id', ah(getCase));
router.patch('/:id', ah(updateCase));
router.delete('/:id', ah(deleteCase));
router.post('/:id/restore', ah(restoreCase));

router.post('/:id/followups', ah(addFollowUp));
router.post('/:id/payments/:kind', ah(addPayment));
router.post('/:id/sanction-letter', upload.single('file'), ah(uploadSanctionLetter));

router.get('/:id/expense-sheet.pdf', ah(downloadExpenseSheet));
router.get('/:id/offer-letter.pdf', ah(downloadOfferLetter));

export default router;
