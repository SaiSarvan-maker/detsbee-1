import { execSync } from 'node:child_process';

// Prisma validates the URL scheme during client generation, even though the
// build does not connect to the database. Runtime deployments provide the real URL.
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@localhost:5432/detsbee_build';
process.env.JWT_SECRET ||= 'build-time-placeholder-not-used-at-runtime';
process.env.TOKEN_PEPPER ||= 'build-time-pepper';

execSync('npx prisma generate --schema=apps/api/prisma/schema.prisma', {
  stdio: 'inherit',
  env: process.env,
});
execSync('npm run build --workspace=@detsbee/api', {
  stdio: 'inherit',
  env: process.env,
});
execSync('npm run build --workspace=web', {
  stdio: 'inherit',
  env: process.env,
});
