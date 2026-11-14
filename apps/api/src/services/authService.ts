import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { generateVerifyToken, hashToken } from '../lib/tokens.js';
import { signToken, type AuthUser } from '../middleware/auth.js';

export const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(48),
  email: z.string().trim().email().max(160).toLowerCase(),
  password: z.string().min(8).max(128),
  phone: z.string().trim().max(32).optional().or(z.literal('')),
});

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1),
});

const emailSchema = z.string().trim().email().max(160).toLowerCase();
const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

const resetRequestedMessage = 'If an account exists for that email, a password reset link will be sent.';

async function sendPasswordResetEmail(email: string, resetUrl: string) {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    throw new AppError(503, 'Password recovery email is not configured yet.', 'EMAIL_NOT_CONFIGURED');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: env.GMAIL_USER,
      // Google may display app passwords grouped with spaces; SMTP expects the compact value.
      pass: env.GMAIL_APP_PASSWORD.replace(/\s/g, ''),
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  await transporter.sendMail({
    from: `Detsbee <${env.GMAIL_USER}>`,
    to: email,
    subject: 'Reset your Detsbee password',
    text: `Use this link to reset your Detsbee password. It expires in 30 minutes.\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Use the link below to reset your Detsbee password. It expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}

function toAuthUser(user: { id: string; email: string; displayName: string }): AuthUser {
  return { id: user.id, email: user.email, displayName: user.displayName };
}

export async function register(input: z.infer<typeof registerSchema>) {
  const data = registerSchema.parse(input);
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError(409, 'An account with this email already exists', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      displayName: data.displayName,
      passwordHash,
      phone: data.phone || null,
      emailVerified: process.env.NODE_ENV !== 'production',
      verifyToken: generateVerifyToken(),
    },
  });

  await prisma.activity.create({
    data: {
      userId: user.id,
      type: 'account_created',
      message: 'Welcome to Detsbee — your hive is ready.',
    },
  });

  const authUser = toAuthUser(user);
  return { user: authUser, token: signToken(authUser) };
}

export async function login(input: z.infer<typeof loginSchema>) {
  const data = loginSchema.parse(input);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');

  const ok = await bcrypt.compare(data.password, user.passwordHash);
  if (!ok) throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');

  const authUser = toAuthUser(user);
  return { user: authUser, token: signToken(authUser) };
}

export async function requestPasswordReset(input: unknown) {
  const email = emailSchema.parse(input);
  if (env.NODE_ENV === 'production' && (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD)) {
    throw new AppError(503, 'Password recovery email is not configured yet.', 'EMAIL_NOT_CONFIGURED');
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { message: resetRequestedMessage };

  const token = generateVerifyToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt },
  });

  const resetUrl = new URL('/reset-password', env.CLIENT_ORIGIN);
  resetUrl.searchParams.set('token', token);

  if (env.NODE_ENV !== 'production') {
    return { message: resetRequestedMessage, developmentResetUrl: resetUrl.toString() };
  }

  try {
    await sendPasswordResetEmail(email, resetUrl.toString());
  } catch (error) {
    await prisma.user.updateMany({
      where: { id: user.id, passwordResetTokenHash: tokenHash },
      data: { passwordResetTokenHash: null, passwordResetExpiresAt: null },
    }).catch(() => undefined);
    if (error instanceof AppError) throw error;
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';
    console.error(`[auth-email] Gmail SMTP delivery failed (${code})`);
    // Keep the response indistinguishable from the unknown-email response.
    return { message: resetRequestedMessage };
  }

  return { message: resetRequestedMessage };
}

export async function resetPassword(input: unknown) {
  const data = resetPasswordSchema.parse(input);
  const tokenHash = hashToken(data.token);
  const user = await prisma.user.findUnique({ where: { passwordResetTokenHash: tokenHash } });
  const now = new Date();
  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt <= now) {
    throw new AppError(400, 'This password reset link is invalid or has expired.', 'RESET_LINK_INVALID');
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const updated = await prisma.user.updateMany({
    where: {
      id: user.id,
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { gt: now },
    },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });
  if (updated.count !== 1) {
    throw new AppError(400, 'This password reset link is invalid or has expired.', 'RESET_LINK_INVALID');
  }

  return { ok: true };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      phone: true,
      emailVerified: true,
      createdAt: true,
    },
  });
  if (!user) throw new AppError(404, 'User not found');
  return user;
}

export async function updateProfile(
  userId: string,
  input: { displayName?: string; phone?: string | null },
) {
  const displayName = input.displayName?.trim();
  if (displayName !== undefined && (displayName.length < 2 || displayName.length > 48)) {
    throw new AppError(400, 'Display name must be 2–48 characters');
  }
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(displayName ? { displayName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      phone: true,
      emailVerified: true,
      createdAt: true,
    },
  });
}
