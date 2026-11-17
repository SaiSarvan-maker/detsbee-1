import { beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const dbPath = path.join(apiRoot, 'prisma', 'test.db');

const usePostgresTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'file:./test.db';
process.env.JWT_SECRET = 'test-jwt-secret-detsbee-32chars!!';
process.env.TOKEN_PEPPER = 'test-pepper-detsbee-32-character-minimum';
process.env.CRON_SECRET = 'test-cron-secret-detsbee-32-character-minimum';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.COOKIE_SECURE = 'false';
process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';

beforeAll(() => {
  if (usePostgresTestDatabase) {
    const databaseUrl = new URL(process.env.TEST_DATABASE_URL!);
    const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
    if (
      !['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
      !['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname) ||
      databaseUrl.port !== '55432' ||
      !databaseName.startsWith('detsbee_test_')
    ) {
      throw new Error('Refusing to run integration tests against a non-local or non-disposable database.');
    }
  }

  // Recreate an isolated SQLite file for tests without prisma --force-reset.
  if (!usePostgresTestDatabase) {
    for (const file of [dbPath, `${dbPath}-journal`, `${dbPath}-wal`, `${dbPath}-shm`]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }

  const schemaPath = usePostgresTestDatabase ? 'prisma/schema.prisma' : 'prisma/schema.test.prisma';
  const resetFlag = usePostgresTestDatabase ? '--force-reset ' : '';
  execSync(`npx prisma db push ${resetFlag}--schema=${schemaPath} --skip-generate`, {
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
