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
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DEMO_MODE: z.string().default('false'),
  TOKEN_PEPPER: z.string().min(32),
});

export const env = envSchema.parse(process.env);
if (env.NODE_ENV === 'production' && env.DATABASE_URL.startsWith('file:')) {
  throw new Error('Production requires a persistent database; configure DATABASE_URL for PostgreSQL.');
}
export const isDemoMode = env.DEMO_MODE === 'true' || env.NODE_ENV === 'development';
