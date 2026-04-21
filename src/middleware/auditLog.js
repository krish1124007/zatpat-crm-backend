import AuditLog from '../models/AuditLog.js';
import { getClientIP } from '../utils/getClientIP.js';

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
