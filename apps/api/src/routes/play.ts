import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as gameService from '../services/gameService.js';
import * as sessionService from '../services/sessionService.js';

export const playRouter = Router();

const playLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

playRouter.use(playLimiter);

playRouter.get('/invite/:token', async (req, res, next) => {
  try {
    res.json(await gameService.resolveInvite(req.params.token));
  } catch (err) {
    next(err);
  }
});

playRouter.post('/sessions', async (req, res, next) => {
  try {
    const result = await sessionService.startSession({
      inviteToken: req.body.inviteToken,
      displayName: req.body.displayName,
      fingerprint: req.body.fingerprint,
      ip: req.ip,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

playRouter.post('/sessions/:sessionId/consent', async (req, res, next) => {
  try {
    res.json(
      await sessionService.acceptConsent(req.params.sessionId, req.body.receiptToken, req.ip),
    );
  } catch (err) {
    next(err);
  }
});

playRouter.get('/sessions/:sessionId', async (req, res, next) => {
  try {
    const receiptToken = String(req.headers['x-receipt-token'] || req.query.receiptToken || '');
    res.json(await sessionService.getPlayState(req.params.sessionId, receiptToken));
  } catch (err) {
    next(err);
  }
});

playRouter.put('/sessions/:sessionId/answers', async (req, res, next) => {
  try {
    res.json(
      await sessionService.saveAnswers(
        req.params.sessionId,
        req.body.receiptToken,
        req.body.answers,
      ),
    );
  } catch (err) {
    next(err);
  }
});

playRouter.post('/sessions/:sessionId/submit', async (req, res, next) => {
  try {
    res.json(await sessionService.submitSession(req.params.sessionId, req.body.receiptToken));
  } catch (err) {
    next(err);
  }
});

playRouter.get('/receipt/:token', async (req, res, next) => {
  try {
    res.json(await sessionService.getReceipt(req.params.token));
  } catch (err) {
    next(err);
  }
});

playRouter.delete('/receipt/:token', async (req, res, next) => {
  try {
    res.json(await sessionService.deleteSubmission(req.params.token));
  } catch (err) {
    next(err);
  }
});
