import { prisma } from './prisma.js';

/** Establish the database connection before serving API requests. */
export async function ensureDatabase(): Promise<void> {
  await prisma.$connect();
}
