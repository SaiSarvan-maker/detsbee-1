import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../.env') });

const isProduction = process.env.NODE_ENV === 'production';
if (!process.env.DATABASE_URL && !isProduction) process.env.DATABASE_URL = 'file:./dev.db';
if (!process.env.JWT_SECRET && !isProduction) process.env.JWT_SECRET = 'detsbee-dev-secret-change-me';
if (!process.env.TOKEN_PEPPER && !isProduction) process.env.TOKEN_PEPPER = 'detsbee-token-pepper-change-me';
if (!process.env.COOKIE_SECURE && process.env.VERCEL) process.env.COOKIE_SECURE = 'true';
if (!process.env.DEMO_MODE) process.env.DEMO_MODE = 'false';
if (!process.env.CLIENT_ORIGIN && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  process.env.CLIENT_ORIGIN = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECURE: z.string().default('false'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  VITE_APP_URL: z.string().url().optional(),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DEMO_MODE: z.string().default('false'),
  TOKEN_PEPPER: z.string().min(32),
  GMAIL_USER: z.string().email().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  CRON_SECRET: z.string().min(32).optional(),
});

export const env = envSchema.parse(process.env);
if (env.NODE_ENV === 'production') {
  if (!env.DATABASE_URL.startsWith('postgresql://') && !env.DATABASE_URL.startsWith('postgres://')) {
    throw new Error('Production requires DATABASE_URL to use PostgreSQL.');
  }
  if (env.COOKIE_SECURE !== 'true') {
    throw new Error('Production requires COOKIE_SECURE=true.');
  }
  if (env.DEMO_MODE !== 'false') {
    throw new Error('Production requires DEMO_MODE=false.');
  }
  if (!env.CLIENT_ORIGIN.startsWith('https://')) {
    throw new Error('Production requires CLIENT_ORIGIN to be the public HTTPS web origin.');
  }
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    throw new Error('Production requires Gmail SMTP credentials for mandatory email verification and password recovery.');
  }
  if (!env.CRON_SECRET) {
    throw new Error('Production requires CRON_SECRET for scheduled response-retention cleanup.');
  }
}
export const isDemoMode = env.DEMO_MODE === 'true' || env.NODE_ENV === 'development';
