import { prisma } from '../lib/prisma.js';
import { getSessionExpiry } from '../lib/retention.js';

const EXPIRY_BACKFILL_BATCH_SIZE = 500;

/**
 * Enforce each session's already-assigned retention deadline and remove the
 * session plus its dependent answers and consent records after that deadline.
 */
export async function purgeExpiredSessions(now = new Date()) {
  const missingExpiry = await prisma.respondentSession.findMany({
    where: { expiresAt: null },
    select: { id: true, startedAt: true, retentionDays: true },
    orderBy: { startedAt: 'asc' },
    take: EXPIRY_BACKFILL_BATCH_SIZE,
  });

  for (const session of missingExpiry) {
    await prisma.respondentSession.updateMany({
      where: { id: session.id, expiresAt: null },
      data: {
        expiresAt: getSessionExpiry({ ...session, expiresAt: null }),
      },
    });
  }

  const deleted = await prisma.respondentSession.deleteMany({
    where: { expiresAt: { lte: now } },
  });

  return { backfilledSessions: missingExpiry.length, deletedSessions: deleted.count };
}
