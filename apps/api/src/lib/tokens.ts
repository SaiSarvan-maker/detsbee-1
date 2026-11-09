import { createHash, randomBytes } from 'node:crypto';
import { customAlphabet } from 'nanoid';
import { env } from './env.js';

const nanoid = customAlphabet('abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', 32);

export function generateInviteToken(): string {
  return `db_${nanoid()}`;
}

export function generateReceiptToken(): string {
  return `rcpt_${nanoid()}`;
}

export function generateVerifyToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256')
    .update(`${env.TOKEN_PEPPER}:${token}`)
    .digest('hex');
}

export function tokenHint(token: string): string {
  return token.slice(-6);
}

export function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${env.TOKEN_PEPPER}:ip:${ip}`).digest('hex');
}

export function hashFingerprint(raw: string): string {
  return createHash('sha256').update(`${env.TOKEN_PEPPER}:fp:${raw}`).digest('hex');
}
