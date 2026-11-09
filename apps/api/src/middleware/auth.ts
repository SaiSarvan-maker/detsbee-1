import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../lib/env.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

type JwtPayload = { sub: string; email: string };

export function signToken(user: AuthUser): string {
  return jwt.sign({ email: user.email }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.detsbee_token;
    const token = bearer || cookieToken;
    if (!token) throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');

    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new AppError(401, 'Invalid session', 'UNAUTHORIZED');

    req.user = { id: user.id, email: user.email, displayName: user.displayName };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError(401, 'Invalid or expired session', 'UNAUTHORIZED'));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.detsbee_token;
  const token = bearer || cookieToken;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    prisma.user
      .findUnique({ where: { id: payload.sub } })
      .then((user) => {
        if (user) req.user = { id: user.id, email: user.email, displayName: user.displayName };
        next();
      })
      .catch(() => next());
  } catch {
    next();
  }
}
