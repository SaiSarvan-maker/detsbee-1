import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { generateVerifyToken } from '../lib/tokens.js';
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
