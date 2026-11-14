import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../lib/env.js';
import { requireAuth } from '../middleware/auth.js';
import * as authService from '../services/authService.js';

export const authRouter = Router();
const passwordRecoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

function setAuthCookie(res: import('express').Response, token: string) {
  res.cookie('detsbee_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE === 'true',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    setAuthCookie(res, result.token);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    setAuthCookie(res, result.token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/forgot-password', passwordRecoveryLimiter, async (req, res, next) => {
  try {
    res.json(await authService.requestPasswordReset(req.body?.email));
  } catch (err) {
    next(err);
  }
});

authRouter.post('/reset-password', passwordRecoveryLimiter, async (req, res, next) => {
  try {
    res.json(await authService.resetPassword(req.body));
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('detsbee_token');
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const profile = await authService.getProfile(req.user!.id);
    res.json({ user: profile });
  } catch (err) {
    next(err);
  }
});

authRouter.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const profile = await authService.updateProfile(req.user!.id, req.body);
    res.json({ user: profile });
  } catch (err) {
    next(err);
  }
});
