import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { Visibility } from '@prisma/client';

const app = createApp();

describe('Detsbee privacy & core flows', () => {
  let token = '';
  let gameId = '';
  let inviteToken = '';
  let sessionId = '';
  let receiptToken = '';
  let questionIds: string[] = [];

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('registers a creator account', async () => {
    const res = await request(app).post('/api/auth/register').send({
      displayName: 'Test Creator',
      email: 'creator@test.detsbee',
      password: 'securepass1',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    token = res.body.token;
  });

  it('authenticates and returns profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('creator@test.detsbee');
  });

  it('creates a game with invitation token', async () => {
    const catalog = await request(app)
      .get('/api/games/catalog')
      .set('Authorization', `Bearer ${token}`);
    expect(catalog.status).toBe(200);
    questionIds = catalog.body.categories.flatMap((c: { questions: { id: string }[] }) =>
      c.questions.map((q) => q.id),
    ).slice(0, 10);
    // ensure both rounds
    const about = catalog.body.categories.find((c: { round: string }) => c.round === 'ABOUT_ME');
    const see = catalog.body.categories.find((c: { round: string }) => c.round === 'HOW_I_SEE_YOU');
    questionIds = [
      ...about.questions.slice(0, 4).map((q: { id: string }) => q.id),
      ...see.questions.slice(0, 4).map((q: { id: string }) => q.id),
    ];

    const res = await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Privacy probe game',
        questionIds,
        expiresInDays: 7,
      });
    expect(res.status).toBe(201);
    gameId = res.body.id;
    inviteToken = res.body.inviteToken;
    expect(inviteToken.startsWith('db_')).toBe(true);
    expect(res.body.inviteUrl).toContain('/play/');
  });

  it('validates invitation', async () => {
    const res = await request(app).get(`/api/play/invite/${inviteToken}`);
    expect(res.status).toBe(200);
    expect(res.body.creatorName).toBe('Test Creator');
  });

  it('starts recipient session only after invite resolve', async () => {
    const res = await request(app).post('/api/play/sessions').send({
      inviteToken,
      displayName: 'Sam',
    });
    expect(res.status).toBe(201);
    sessionId = res.body.sessionId;
    receiptToken = res.body.receiptToken;
    expect(receiptToken.startsWith('rcpt_')).toBe(true);
  });

  it('blocks questions before consent', async () => {
    const res = await request(app)
      .get(`/api/play/sessions/${sessionId}`)
      .set('x-receipt-token', receiptToken);
    expect(res.status).toBe(403);
  });

  it('accepts consent and returns questions', async () => {
    const consent = await request(app)
      .post(`/api/play/sessions/${sessionId}/consent`)
      .send({ receiptToken });
    expect(consent.status).toBe(200);

    const play = await request(app)
      .get(`/api/play/sessions/${sessionId}`)
      .set('x-receipt-token', receiptToken);
    expect(play.status).toBe(200);
    expect(play.body.questions.length).toBeGreaterThan(3);
  });

  it('saves shared, private, skipped, and declined answers', async () => {
    const play = await request(app)
      .get(`/api/play/sessions/${sessionId}`)
      .set('x-receipt-token', receiptToken);
    const qs = play.body.questions;
    const answers = [
      { questionId: qs[0].id, visibility: 'SHARE', value: 'Shared mango ice cream' },
      { questionId: qs[1].id, visibility: 'PRIVATE', value: 'Secret private note' },
      { questionId: qs[2].id, visibility: 'SKIPPED' },
      { questionId: qs[3].id, visibility: 'DECLINED' },
      { questionId: qs[4].id, visibility: 'SHARE', value: 'Warm and thoughtful' },
      { questionId: qs[5].id, visibility: 'SHARE', value: 'kind, bright, steady' },
    ];
    const res = await request(app)
      .put(`/api/play/sessions/${sessionId}/answers`)
      .send({ receiptToken, answers });
    expect(res.status).toBe(200);
  });

  it('submits responses transactionally', async () => {
    const res = await request(app)
      .post(`/api/play/sessions/${sessionId}/submit`)
      .send({ receiptToken });
    expect(res.status).toBe(200);
  });

  it('rejects duplicate submissions', async () => {
    const res = await request(app)
      .post(`/api/play/sessions/${sessionId}/submit`)
      .send({ receiptToken });
    expect(res.status).toBe(409);
  });

  it('lets respondent view receipt including private answers', async () => {
    const res = await request(app).get(`/api/play/receipt/${receiptToken}`);
    expect(res.status).toBe(200);
    const privateAnswer = res.body.answers.find(
      (a: { visibility: string; value: string }) => a.visibility === 'PRIVATE',
    );
    expect(privateAnswer?.value).toBe('Secret private note');
  });

  it('never returns private answers to creator results API', async () => {
    const res = await request(app)
      .get(`/api/games/${gameId}/results`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const allValues = JSON.stringify(res.body);
    expect(allValues).not.toContain('Secret private note');
    expect(allValues).toContain('Shared mango ice cream');
    const about = res.body.aboutMe.concat(res.body.howISeeYou);
    expect(about.every((a: { visibility?: string }) => a.visibility !== 'PRIVATE')).toBe(true);
  });

  it('blocks unauthorized access to another creator game', async () => {
    const other = await request(app).post('/api/auth/register').send({
      displayName: 'Other',
      email: 'other@test.detsbee',
      password: 'securepass1',
    });
    const res = await request(app)
      .get(`/api/games/${gameId}/results`)
      .set('Authorization', `Bearer ${other.body.token}`);
    expect(res.status).toBe(404);
  });

  it('disables invitation links', async () => {
    const disable = await request(app)
      .post(`/api/games/${gameId}/disable`)
      .set('Authorization', `Bearer ${token}`);
    expect(disable.status).toBe(200);
    const invite = await request(app).get(`/api/play/invite/${inviteToken}`);
    expect(invite.status).toBe(410);
  });

  it('re-enables and validates again', async () => {
    const enable = await request(app)
      .post(`/api/games/${gameId}/enable`)
      .set('Authorization', `Bearer ${token}`);
    expect(enable.status).toBe(200);
    const invite = await request(app).get(`/api/play/invite/${inviteToken}`);
    expect(invite.status).toBe(200);
  });

  it('supports respondent-initiated deletion', async () => {
    const del = await request(app).delete(`/api/play/receipt/${receiptToken}`);
    expect(del.status).toBe(200);
    const receipt = await request(app).get(`/api/play/receipt/${receiptToken}`);
    expect(receipt.status).toBe(410);

    const privateLeft = await prisma.response.count({
      where: { sessionId, visibility: Visibility.PRIVATE },
    });
    expect(privateLeft).toBe(0);
  });

  it('supports creator deletion of games and data', async () => {
    // recreate a tiny submission-less game delete
    const res = await request(app)
      .delete(`/api/games/${gameId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const get = await request(app)
      .get(`/api/games/${gameId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(404);
  });

  it('rejects expired invites', async () => {
    const catalog = await request(app)
      .get('/api/games/catalog')
      .set('Authorization', `Bearer ${token}`);
    const about = catalog.body.categories.find((c: { round: string }) => c.round === 'ABOUT_ME');
    const see = catalog.body.categories.find((c: { round: string }) => c.round === 'HOW_I_SEE_YOU');
    const ids = [
      ...about.questions.slice(0, 3).map((q: { id: string }) => q.id),
      ...see.questions.slice(0, 3).map((q: { id: string }) => q.id),
    ];
    const created = await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Expiring', questionIds: ids, expiresInDays: 1 });

    await prisma.game.update({
      where: { id: created.body.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const invite = await request(app).get(`/api/play/invite/${created.body.inviteToken}`);
    expect(invite.status).toBe(410);
  });
});
