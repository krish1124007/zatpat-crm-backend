// Extract the real client IP, normalizing IPv6-mapped IPv4 (::ffff:127.0.0.1 → 127.0.0.1).
export function getClientIP(req) {
  const fwd = req.headers['x-forwarded-for'];
  let ip = (Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0]) || req.socket?.remoteAddress || req.ip || '';
  ip = ip.trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}
