import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { ah } from '../utils/asyncHandler.js';
import {
  listIPs,
  addIP,
  updateIP,
  deleteIP,
  listAuditLogs,
  auditFacets,
  exportBackup,
  superSearch,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/admin.controller.js';

const router = Router();

router.use(requireAuth);

// Super search is available to all logged-in users.
router.get('/search', ah(superSearch));

// Everything else is Admin/SuperAdmin only.
router.use(requireRole('Admin', 'SuperAdmin'));

router.get('/ip-whitelist', ah(listIPs));
router.post('/ip-whitelist', ah(addIP));
router.patch('/ip-whitelist/:id', ah(updateIP));
router.delete('/ip-whitelist/:id', ah(deleteIP));

router.get('/audit-logs', ah(listAuditLogs));
router.get('/audit-logs/facets', ah(auditFacets));

router.get('/backup', ah(exportBackup));

// Staff / User management
router.get('/users', ah(listUsers));
router.post('/users', ah(createUser));
router.patch('/users/:id', ah(updateUser));
router.delete('/users/:id', ah(deleteUser));

export default router;
