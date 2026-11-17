import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { Visibility } from '@prisma/client';
import { generateReceiptToken, hashToken, tokenHint } from '../src/lib/tokens.js';

const app = createApp();
let recoveryRequestIp = 1;

function recoveryRequest() {
  const ip = `198.51.100.${recoveryRequestIp++}`;
  return {
    post(path: string) {
      return request(app).post(path).set('X-Forwarded-For', ip);
    },
  };
}

describe('Detsbee privacy & core flows', () => {
  let token = '';
  let gameId = '';
  let inviteToken = '';
  let unusedGameId = '';
  let unusedInviteToken = '';
  let sessionId = '';
  let receiptToken = '';
  let questionIds: string[] = [];

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('allows the Android WebView origin and rejects unrelated Vercel origins', async () => {
    const android = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://localhost')
      .set('Access-Control-Request-Method', 'POST');
    expect(android.headers['access-control-allow-origin']).toBe('https://localhost');
    expect(android.headers['access-control-allow-credentials']).toBe('true');

    const unrelatedVercel = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://unrelated-project.vercel.app')
      .set('Access-Control-Request-Method', 'POST');
    expect(unrelatedVercel.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('registers a creator account', async () => {
    const res = await request(app).post('/api/auth/register').send({
      displayName: 'Test Creator',
      email: 'creator@test.detsbee',
      password: 'securepass1',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeUndefined();
    expect(res.body.emailVerificationRequired).toBe(true);

    const unverifiedLogin = await request(app).post('/api/auth/login').send({
      email: 'creator@test.detsbee',
      password: 'securepass1',
    });
    expect(unverifiedLogin.status).toBe(403);
    expect(unverifiedLogin.body.code).toBe('EMAIL_NOT_VERIFIED');

    const verificationUrl = new URL(res.body.developmentVerificationUrl);
    const verificationToken = verificationUrl.searchParams.get('token');
    expect(verificationToken).toBeTruthy();
    const verified = await request(app).post('/api/auth/verify-email').send({ token: verificationToken });
    expect(verified.status).toBe(200);
    const reused = await request(app).post('/api/auth/verify-email').send({ token: verificationToken });
    expect(reused.status).toBe(400);

    const login = await request(app).post('/api/auth/login').send({
      email: 'creator@test.detsbee',
      password: 'securepass1',
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
    token = login.body.token;

    const verifiedResend = await recoveryRequest()
      .post('/api/auth/request-verification')
      .send({ email: 'creator@test.detsbee' });
    expect(verifiedResend.status).toBe(200);
    expect(verifiedResend.body.developmentVerificationUrl).toBeUndefined();
  });

  it('rejects expired verification links and allows a replacement link', async () => {
    const registered = await request(app).post('/api/auth/register').send({
      displayName: 'Expiry Test',
      email: 'verification-expiry@test.detsbee',
      password: 'securepass1',
    });
    const originalToken = new URL(registered.body.developmentVerificationUrl).searchParams.get('token');
    const user = await prisma.user.findUnique({ where: { email: 'verification-expiry@test.detsbee' } });
    expect(user).toBeTruthy();
    await prisma.user.update({
      where: { id: user!.id },
      data: { verifyTokenExpiresAt: new Date(Date.now() - 1000) },
    });

    const expired = await recoveryRequest().post('/api/auth/verify-email').send({ token: originalToken });
    expect(expired.status).toBe(400);
    expect(expired.body.code).toBe('VERIFICATION_LINK_INVALID');

    const resent = await recoveryRequest()
      .post('/api/auth/request-verification')
      .send({ email: 'verification-expiry@test.detsbee' });
    expect(resent.status).toBe(200);
    const replacementToken = new URL(resent.body.developmentVerificationUrl).searchParams.get('token');
    expect(replacementToken).toBeTruthy();
    expect(replacementToken).not.toBe(originalToken);

    const verified = await recoveryRequest().post('/api/auth/verify-email').send({ token: replacementToken });
    expect(verified.status).toBe(200);
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
    const otherVerificationToken = new URL(other.body.developmentVerificationUrl).searchParams.get('token');
    await request(app).post('/api/auth/verify-email').send({ token: otherVerificationToken });
    const otherLogin = await request(app).post('/api/auth/login').send({
      email: 'other@test.detsbee',
      password: 'securepass1',
    });
    const res = await request(app)
      .get(`/api/games/${gameId}/results`)
      .set('Authorization', `Bearer ${otherLogin.body.token}`);
    expect(res.status).toBe(404);
  });

  it('disables invitation links', async () => {
    const created = await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Disable test', questionIds, expiresInDays: 7 });
    expect(created.status).toBe(201);
    unusedGameId = created.body.id;
    unusedInviteToken = created.body.inviteToken;

    const disable = await request(app)
      .post(`/api/games/${unusedGameId}/disable`)
      .set('Authorization', `Bearer ${token}`);
    expect(disable.status).toBe(200);
    const invite = await request(app).get(`/api/play/invite/${unusedInviteToken}`);
    expect(invite.status).toBe(410);
  });

  it('re-enables an unused invitation and validates it again', async () => {
    const enable = await request(app)
      .post(`/api/games/${unusedGameId}/enable`)
      .set('Authorization', `Bearer ${token}`);
    expect(enable.status).toBe(200);
    const invite = await request(app).get(`/api/play/invite/${unusedInviteToken}`);
    expect(invite.status).toBe(200);
  });

  it('requires rotation after a one-time invitation has been used', async () => {
    const enable = await request(app)
      .post(`/api/games/${gameId}/enable`)
      .set('Authorization', `Bearer ${token}`);
    expect(enable.status).toBe(409);
    expect(enable.body.code).toBe('INVITE_USED');

    const rotated = await request(app)
      .post(`/api/games/${gameId}/rotate-link`)
      .set('Authorization', `Bearer ${token}`);
    expect(rotated.status).toBe(200);
    const invite = await request(app).get(`/api/play/invite/${rotated.body.inviteToken}`);
    expect(invite.status).toBe(200);
    const oldInvite = await request(app).get(`/api/play/invite/${inviteToken}`);
    expect(oldInvite.status).toBe(404);
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

    const expiredReceiptToken = generateReceiptToken();
    const expiredSession = await prisma.respondentSession.create({
      data: {
        gameId: created.body.id,
        status: 'SUBMITTED',
        consentAccepted: true,
        submittedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
        startedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
        retentionDays: 90,
        expiresAt: new Date(Date.now() - 1000),
        receiptTokenHash: hashToken(expiredReceiptToken),
        receiptTokenHint: tokenHint(expiredReceiptToken),
      },
    });
    const retentionDays = 90;
    const nearExpiryStartedAt = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000 - 60 * 60 * 1000));
    const nearExpirySession = await prisma.respondentSession.create({
      data: {
        gameId: created.body.id,
        status: 'SUBMITTED',
        consentAccepted: true,
        startedAt: nearExpiryStartedAt,
        retentionDays,
        expiresAt: null,
        receiptTokenHash: hashToken(generateReceiptToken()),
        receiptTokenHint: 'legacy',
      },
    });
    const questionId = ids[0];
    await prisma.response.create({
      data: {
        sessionId: expiredSession.id,
        questionId,
        visibility: Visibility.PRIVATE,
        valueJson: JSON.stringify('Expired private response'),
      },
    });
    await prisma.consentRecord.create({
      data: {
        sessionId: expiredSession.id,
        version: '2026-03-v1',
        textHash: hashToken('test consent'),
      },
    });
    const expiredReceipt = await request(app).get(`/api/play/receipt/${expiredReceiptToken}`);
    expect(expiredReceipt.status).toBe(410);

    const unauthorizedPurge = await request(app).get('/api/maintenance/retention');
    expect(unauthorizedPurge.status).toBe(401);
    const purge = await request(app)
      .get('/api/maintenance/retention')
      .set('Authorization', `Bearer ${process.env.CRON_SECRET}`);
    expect(purge.status).toBe(200);
    expect(purge.body.deletedSessions).toBeGreaterThanOrEqual(1);
    expect(await prisma.response.count({ where: { sessionId: expiredSession.id } })).toBe(0);
    expect(await prisma.consentRecord.count({ where: { sessionId: expiredSession.id } })).toBe(0);
    const preservedNearExpirySession = await prisma.respondentSession.findUnique({
      where: { id: nearExpirySession.id },
    });
    expect(preservedNearExpirySession?.expiresAt?.getTime()).toBe(
      nearExpiryStartedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000,
    );
  });

  it('revokes existing sessions after a password reset', async () => {
    const requested = await recoveryRequest()
      .post('/api/auth/forgot-password')
      .send({ email: 'creator@test.detsbee' });
    expect(requested.status).toBe(200);
    const resetToken = new URL(requested.body.developmentResetUrl).searchParams.get('token');
    const reset = await recoveryRequest().post('/api/auth/reset-password').send({
      token: resetToken,
      password: 'securepass2',
    });
    expect(reset.status).toBe(200);

    const oldSession = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(oldSession.status).toBe(401);
    expect(oldSession.body.code).toBe('SESSION_REVOKED');

    const login = await request(app).post('/api/auth/login').send({
      email: 'creator@test.detsbee',
      password: 'securepass2',
    });
    expect(login.status).toBe(200);
    token = login.body.token;
  });
});
