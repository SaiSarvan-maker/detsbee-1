const DAY_MS = 24 * 60 * 60 * 1000;

export function getSessionExpiry(session: {
  expiresAt: Date | null;
  startedAt: Date;
  retentionDays: number;
}) {
  return session.expiresAt ?? new Date(session.startedAt.getTime() + session.retentionDays * DAY_MS);
}

export function isSessionExpired(
  session: { expiresAt: Date | null; startedAt: Date; retentionDays: number },
  now = new Date(),
) {
  return getSessionExpiry(session) <= now;
}
