import { z } from 'zod';
import User from '../models/User.js';
import {
  signAccessToken,
  signRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  verifyRefreshToken,
  REFRESH_COOKIE,
} from '../utils/jwt.js';
import { recordAudit } from '../middleware/auditLog.js';
import { getClientIP } from '../utils/getClientIP.js';

const loginSchema = z.object({
  identifier: z.string().min(3), // email or phone
  password: z.string().min(1),
});

function tokensFor(user) {
  const payload = { sub: user._id.toString(), role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const { identifier, password } = parsed.data;
  const isEmail = identifier.includes('@');
  const query = isEmail ? { email: identifier.toLowerCase() } : { phone: identifier };

  const user = await User.findOne(query).select('+password');
  if (!user || !user.isActive) {
    await recordAudit({ req, action: 'login', status: 'failure', meta: { identifier } });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const ok = await user.comparePassword(password);
  if (!ok) {
    await recordAudit({ req, action: 'login', status: 'failure', meta: { identifier } });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  user.lastLoginAt = new Date();
  user.lastLoginIP = getClientIP(req);
  await user.save();

  const tokens = tokensFor(user);
  setAuthCookies(res, tokens);

  req.user = user;
  await recordAudit({ req, action: 'login', status: 'success' });

  return res.json({ user: user.toSafeJSON() });
}

export async function refresh(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  try {
    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) return res.status(401).json({ error: 'User not found' });

    const tokens = tokensFor(user);
    setAuthCookies(res, tokens);
    return res.json({ user: user.toSafeJSON() });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
}

export async function logout(req, res) {
  clearAuthCookies(res);
  if (req.user) await recordAudit({ req, action: 'logout' });
  return res.json({ ok: true });
}

export async function me(req, res) {
  return res.json({ user: req.user.toSafeJSON() });
}
