import IPWhitelist from '../models/IPWhitelist.js';
import AuditLog from '../models/AuditLog.js';
import { env } from '../config/env.js';
import { getClientIP } from '../utils/getClientIP.js';

// Cache the active IP list to avoid hitting the DB on every request.
let cache = { ips: null, fetchedAt: 0 };
const CACHE_TTL_MS = 30 * 1000;

async function getActiveIPs() {
  const now = Date.now();
  if (cache.ips && now - cache.fetchedAt < CACHE_TTL_MS) return cache.ips;
  const docs = await IPWhitelist.find({ isActive: true }).select('ip').lean();
  cache = { ips: docs.map((d) => d.ip), fetchedAt: now };
  return cache.ips;
}

export function invalidateIPCache() {
  cache = { ips: null, fetchedAt: 0 };
}

export async function ipWhitelistCheck(req, res, next) {
  if (!env.ipWhitelistEnabled) return next();

  const ip = getClientIP(req);
  req.clientIP = ip;

  try {
    const allowed = await getActiveIPs();
    // Empty whitelist = block everything (fail closed) once enforcement is on.
    if (allowed.length === 0 || !allowed.includes(ip)) {
      await AuditLog.create({
        action: 'ip_blocked',
        ip,
        method: req.method,
        path: req.originalUrl,
        userAgent: req.headers['user-agent'],
        status: 'failure',
      }).catch(() => {});
      return res.status(403).json({ error: 'Access Denied: IP not whitelisted', ip });
    }
    next();
  } catch (err) {
    next(err);
  }
}
