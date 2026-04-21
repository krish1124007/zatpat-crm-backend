import dotenv from 'dotenv';
dotenv.config();

const required = (name, value) => {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  mongoUri: required('MONGODB_URI', process.env.MONGODB_URI),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET),
    refreshSecret: required('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET),
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },

  cookie: {
    domain: process.env.COOKIE_DOMAIN || 'localhost',
    secure: process.env.COOKIE_SECURE === 'true',
  },

  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  ipWhitelistEnabled: process.env.IP_WHITELIST_ENABLED === 'true',

  seed: {
    name: process.env.SEED_SUPERADMIN_NAME || 'Super Admin',
    email: process.env.SEED_SUPERADMIN_EMAIL || 'admin@zatpatloans.local',
    phone: process.env.SEED_SUPERADMIN_PHONE || '9999999999',
    password: process.env.SEED_SUPERADMIN_PASSWORD || 'ChangeMe@123',
  },
};

export const isProd = env.nodeEnv === 'production';
