import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as gameService from '../services/gameService.js';
import * as resultsService from '../services/resultsService.js';
import * as questionService from '../services/questionService.js';

export const gamesRouter = Router();

gamesRouter.use(requireAuth);

gamesRouter.get('/dashboard', async (req, res, next) => {
  try {
    res.json(await gameService.getDashboard(req.user!.id));
  } catch (err) {
    next(err);
  }
});

gamesRouter.get('/catalog', async (_req, res, next) => {
  try {
    res.json({ categories: await questionService.listCatalog() });
  } catch (err) {
    next(err);
  }
});

gamesRouter.get('/', async (req, res, next) => {
  try {
    res.json({ games: await gameService.listGames(req.user!.id) });
  } catch (err) {
    next(err);
  }
});

gamesRouter.post('/', async (req, res, next) => {
  try {
    const game = await gameService.createGame(req.user!.id, req.body);
    res.status(201).json(game);
  } catch (err) {
    next(err);
  }
});

gamesRouter.get('/:gameId', async (req, res, next) => {
  try {
    res.json(await gameService.getGameForCreator(req.user!.id, req.params.gameId));
  } catch (err) {
    next(err);
  }
});

gamesRouter.post('/:gameId/rotate-link', async (req, res, next) => {
  try {
    res.json(await gameService.rotateInviteLink(req.user!.id, req.params.gameId));
  } catch (err) {
    next(err);
  }
});

gamesRouter.post('/:gameId/enable', async (req, res, next) => {
  try {
    res.json(await gameService.setGameEnabled(req.user!.id, req.params.gameId, true));
  } catch (err) {
    next(err);
  }
});

gamesRouter.post('/:gameId/disable', async (req, res, next) => {
  try {
    res.json(await gameService.setGameEnabled(req.user!.id, req.params.gameId, false));
  } catch (err) {
    next(err);
  }
});

gamesRouter.delete('/:gameId', async (req, res, next) => {
  try {
    res.json(await gameService.deleteGame(req.user!.id, req.params.gameId));
  } catch (err) {
    next(err);
  }
});

gamesRouter.get('/:gameId/results', async (req, res, next) => {
  try {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    res.json(await resultsService.getCreatorResults(req.user!.id, req.params.gameId, sessionId));
  } catch (err) {
    next(err);
  }
});
