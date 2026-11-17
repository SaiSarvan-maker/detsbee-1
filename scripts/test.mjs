import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = path.join(root, 'apps', 'api');
const productionSchemaPath = path.join(apiRoot, 'prisma', 'schema.prisma');
const testSchemaPath = path.join(apiRoot, 'prisma', 'schema.test.prisma');
const vitestArgs = process.argv.slice(2);
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl) {
  const testDatabase = new URL(testDatabaseUrl);
  const databaseName = decodeURIComponent(testDatabase.pathname.slice(1));
  if (
    !['postgres:', 'postgresql:'].includes(testDatabase.protocol) ||
    !['localhost', '127.0.0.1', '::1'].includes(testDatabase.hostname) ||
    testDatabase.port !== '55432' ||
    !databaseName.startsWith('detsbee_test_')
  ) {
    throw new Error('TEST_DATABASE_URL must target a disposable local database on port 55432 named detsbee_test_*.');
  }
}
const testTempDir = fs.mkdtempSync(path.join(root, '.test-tmp-'));
const testEnv = {
  ...process.env,
  TEMP: testTempDir,
  TMP: testTempDir,
  TMPDIR: testTempDir,
  ...(testDatabaseUrl ? { TEST_DATABASE_URL: testDatabaseUrl, DATABASE_URL: testDatabaseUrl } : { DATABASE_URL: 'file:./test.db' }),
  JWT_SECRET: 'test-jwt-secret-detsbee-minimum-32-characters',
  TOKEN_PEPPER: 'test-pepper-detsbee-minimum-32-characters',
  CRON_SECRET: 'test-cron-secret-detsbee-minimum-32-characters',
  CLIENT_ORIGIN: 'http://localhost:5173',
  COOKIE_SECURE: 'false',
  DEMO_MODE: 'true',
  NODE_ENV: 'test',
  PORT: '3001',
};

let testExitCode = 1;
try {
  if (testDatabaseUrl) {
    execSync('npx prisma generate --schema=prisma/schema.prisma', {
      cwd: apiRoot,
      env: testEnv,
      stdio: 'inherit',
    });
  } else {
    const productionSchema = fs.readFileSync(productionSchemaPath, 'utf8');
    if (!productionSchema.includes('provider = "postgresql"')) {
      throw new Error('Expected the checked-in Prisma schema to use PostgreSQL.');
    }
    fs.writeFileSync(
      testSchemaPath,
      productionSchema.replace('provider = "postgresql"', 'provider = "sqlite"'),
    );
    execSync('npx prisma generate --schema=prisma/schema.test.prisma', {
      cwd: apiRoot,
      env: testEnv,
      stdio: 'inherit',
    });
  }

  const result = spawnSync(
    process.execPath,
    [path.join(root, 'node_modules', 'vitest', 'vitest.mjs'), ...(vitestArgs.length ? vitestArgs : ['run'])],
    { cwd: apiRoot, env: testEnv, stdio: 'inherit' },
  );
  testExitCode = result.status ?? 1;
} catch (error) {
  console.error(error);
} finally {
  if (fs.existsSync(testSchemaPath)) fs.unlinkSync(testSchemaPath);
  fs.rmSync(testTempDir, { recursive: true, force: true });
  try {
    execSync('npx prisma generate --schema=apps/api/prisma/schema.prisma', {
      cwd: root,
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/detsbee_test_restore',
      },
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Failed to restore the PostgreSQL Prisma Client after tests.', error);
    testExitCode = 1;
  }
}

process.exitCode = testExitCode;
