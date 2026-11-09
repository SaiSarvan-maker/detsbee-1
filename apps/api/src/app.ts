import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ensureDatabase } from './lib/bootstrap.js';
import { env } from './lib/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { gamesRouter } from './routes/games.js';
import { playRouter } from './routes/play.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        const allowed = new Set(
          [env.CLIENT_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean),
        );
        if (process.env.VERCEL_URL) allowed.add(`https://${process.env.VERCEL_URL}`);
        if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
          allowed.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
        }
        if (allowed.has(origin) || origin.endsWith('.vercel.app')) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  let ready: Promise<void> | null = null;
  app.use(async (_req, _res, next) => {
    try {
      ready ??= ensureDatabase();
      await ready;
      next();
    } catch (err) {
      ready = null;
      next(err);
    }
  });

  app.use(
    '/api/auth',
    rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false }),
  );

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      name: 'detsbee',
      demoMode: env.DEMO_MODE === 'true',
      time: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api/play', playRouter);

  app.use(errorHandler);
  return app;
}
