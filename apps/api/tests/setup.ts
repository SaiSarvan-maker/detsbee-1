import { beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const dbPath = path.join(apiRoot, 'prisma', 'test.db');

process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-jwt-secret-detsbee-32chars!!';
process.env.TOKEN_PEPPER = 'test-pepper-detsbee';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.COOKIE_SECURE = 'false';
process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';

beforeAll(() => {
  // Recreate an isolated SQLite file for tests without prisma --force-reset.
  for (const file of [dbPath, `${dbPath}-journal`, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  execSync('npx prisma db push --skip-generate', {
    cwd: apiRoot,
    env: process.env,
    stdio: 'inherit',
  });
  execSync('npx tsx prisma/seed.ts', {
    cwd: apiRoot,
    env: process.env,
    stdio: 'inherit',
  });
}, 120_000);
