const API_BASE = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getToken() {
  return localStorage.getItem('detsbee_token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('detsbee_token', token);
  else localStorage.removeItem('detsbee_token');
}

export async function api<T>(
  path: string,
  options: RequestInit & { receiptToken?: string } = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.receiptToken) headers.set('x-receipt-token', options.receiptToken);

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error || 'Request failed', data.code);
  }
  return data as T;
}
