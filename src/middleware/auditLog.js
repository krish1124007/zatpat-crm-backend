import AuditLog from '../models/AuditLog.js';
import Activity from '../models/Activity.js';
import { getClientIP } from '../utils/getClientIP.js';

// Record a human-readable activity for the live Dashboard feed.
// `caseDoc` is a LoanCase document (or plain object) used to label the entry.
export async function recordActivity({ req, action, caseDoc, message, meta }) {
  try {
    await Activity.create({
      user: req.user?._id,
      userName: req.user?.name || req.user?.email || 'Someone',
      action,
      caseId: caseDoc?._id,
      srNo: caseDoc?.srNo,
      customerName: caseDoc?.customerName || '',
      message,
      meta,
    });
  } catch (err) {
    // Never let activity logging break the request.
    console.error('[activity] failed to record:', err.message);
  }
}

// Helper to record a single audit event from a route handler.
export async function recordAudit({ req, action, resource, resourceId, status = 'success', meta }) {
  try {
    await AuditLog.create({
      user: req.user?._id,
      userEmail: req.user?.email,
      action,
      resource,
      resourceId,
      ip: req.clientIP || getClientIP(req),
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.originalUrl,
      status,
      meta,
    });
  } catch (err) {
    // Never let audit failures break the request.
    console.error('[audit] failed to record:', err.message);
  }
}
