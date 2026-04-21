import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { ipWhitelistCheck } from './middleware/ipCheck.js';
import { requireAuth } from './middleware/auth.js';
import { requireRole } from './middleware/roleGuard.js';

// Route modules
import authRoutes from './routes/auth.routes.js';
import casesRoutes from './routes/cases.routes.js';
import partnersRoutes from './routes/partners.routes.js';
import invoicesRoutes from './routes/invoices.routes.js';
import expensesRoutes from './routes/expenses.routes.js';
import salaryRoutes from './routes/salary.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import insuranceRoutes from './routes/insurance.routes.js';
import contestsRoutes from './routes/contests.routes.js';
import followupsRoutes from './routes/followups.routes.js';
import adminRoutes from './routes/admin.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.resolve('uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

const app = express();

// Behind a reverse proxy, trust X-Forwarded-For so getClientIP works correctly.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

// IP whitelist runs on every API request (no-op when disabled in dev).
app.use('/api', ipWhitelistCheck);

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/cases', casesRoutes);
app.use('/api/v1/partners', partnersRoutes);
app.use('/api/v1/invoices', invoicesRoutes);
app.use('/api/v1/expenses', expensesRoutes);
app.use('/api/v1/salary', salaryRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/insurance', insuranceRoutes);
app.use('/api/v1/contests', contestsRoutes);
app.use('/api/v1/followups', followupsRoutes);
app.use('/api/v1/admin', adminRoutes);

// Health & auth smoke-test endpoints
app.get('/api/v1/health', (_req, res) => res.json({ ok: true }));
app.get('/api/v1/protected/ping', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user.toSafeJSON() });
});
app.get('/api/v1/admin/ping', requireAuth, requireRole('Admin', 'SuperAdmin'), (req, res) => {
  res.json({ ok: true, role: req.user.role });
});

// ─── Serve React client in production ─────────────────────────
const clientDist = path.join(__dirname, '../../client/dist');
if (env.nodeEnv === 'production' && existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Centralized error handler.
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function start() {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`[server] http://localhost:${env.port}  (env=${env.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error('[startup] failed:', err);
  process.exit(1);
});
