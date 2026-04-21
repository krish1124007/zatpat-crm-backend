import User from '../models/User.js';
import { ACCESS_COOKIE, verifyAccessToken } from '../utils/jwt.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[ACCESS_COOKIE];
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
