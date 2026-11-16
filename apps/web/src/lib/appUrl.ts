const DEFAULT_APP_URL = 'https://detsbee-1.vercel.app';

function getAppBaseUrl(configuredUrl = import.meta.env.VITE_APP_URL) {
  if (!configuredUrl?.trim()) return DEFAULT_APP_URL;

  try {
    return new URL(configuredUrl.trim()).origin;
  } catch {
    return DEFAULT_APP_URL;
  }
}

export function buildInviteUrl(token: string) {
  return `${getAppBaseUrl()}/play/${encodeURIComponent(token)}`;
}

export function canonicalizeInviteUrl(value: string) {
  try {
    const parsed = new URL(value);
    const match = parsed.pathname.match(/^\/play\/([^/]+)$/);
    if (!match) return null;
    return buildInviteUrl(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}
