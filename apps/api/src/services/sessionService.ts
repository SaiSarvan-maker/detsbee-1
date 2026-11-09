import { SessionStatus, Visibility } from '@prisma/client';
import { z } from 'zod';
import { AppError, assertFound } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import {
  generateReceiptToken,
  hashFingerprint,
  hashIp,
  hashToken,
  tokenHint,
} from '../lib/tokens.js';
import { resolveInvite } from './gameService.js';

export const CONSENT_VERSION = '2026-03-v1';
export const CONSENT_TEXT =
  'I understand Detsbee collects only the answers I choose to give. I can skip any question, mark answers private, and request deletion. Shared answers are visible only to the person who invited me. Private answers stay in my personal receipt.';

const answerSchema = z.object({
  questionId: z.string(),
  visibility: z.enum(['SHARE', 'PRIVATE', 'SKIPPED', 'DECLINED']),
  value: z.unknown().optional(),
});

export async function startSession(input: {
  inviteToken: string;
  displayName?: string;
  fingerprint?: string;
  ip?: string;
}) {
  const invite = await resolveInvite(input.inviteToken);
  const receiptRaw = generateReceiptToken();

  const session = await prisma.respondentSession.create({
    data: {
      gameId: invite.gameId,
      displayName: input.displayName?.trim() || null,
      status: SessionStatus.STARTED,
      receiptTokenHash: hashToken(receiptRaw),
      receiptTokenHint: tokenHint(receiptRaw),
      fingerprintHash: input.fingerprint ? hashFingerprint(input.fingerprint) : null,
      retentionDays: invite.retentionDays,
      expiresAt: new Date(Date.now() + invite.retentionDays * 24 * 60 * 60 * 1000),
    },
  });

  return {
    sessionId: session.id,
    receiptToken: receiptRaw,
    creatorName: invite.creatorName,
    title: invite.title,
    message: invite.message,
    retentionDays: invite.retentionDays,
    consent: {
      version: CONSENT_VERSION,
      text: CONSENT_TEXT,
    },
  };
}

export async function acceptConsent(sessionId: string, receiptToken: string, ip?: string) {
  const session = await requireSession(sessionId, receiptToken);
  if (session.consentAccepted) {
    return { ok: true, alreadyAccepted: true };
  }

  await prisma.$transaction([
    prisma.respondentSession.update({
      where: { id: session.id },
      data: {
        consentAccepted: true,
        consentAt: new Date(),
        consentVersion: CONSENT_VERSION,
        status: SessionStatus.IN_PROGRESS,
      },
    }),
    prisma.consentRecord.create({
      data: {
        sessionId: session.id,
        version: CONSENT_VERSION,
        textHash: hashToken(CONSENT_TEXT),
        ipHash: hashIp(ip),
      },
    }),
  ]);

  return { ok: true };
}

export async function getPlayState(sessionId: string, receiptToken: string) {
  const session = await requireSession(sessionId, receiptToken);
  if (!session.consentAccepted) {
    throw new AppError(403, 'Consent required before questions are shown', 'CONSENT_REQUIRED');
  }

  const game = assertFound(
    await prisma.game.findUnique({
      where: { id: session.gameId },
      include: {
        creator: { select: { displayName: true } },
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { question: { include: { category: true } } },
        },
      },
    }),
  );

  const responses = await prisma.response.findMany({ where: { sessionId: session.id } });
  const byQuestion = new Map(responses.map((r) => [r.questionId, r]));

  const questions = game.questions.map((gq) => {
    const q = gq.question;
    const existing = byQuestion.get(q.id);
    return {
      id: q.id,
      prompt: (gq.prompt || q.prompt).replace(/\{name\}/g, game.creator.displayName),
      helpText: 'Answer in your own words. There are no preset choices.',
      type: 'LONG_TEXT',
      options: null,
      round: q.round,
      category: q.category.name,
      categorySlug: q.category.slug,
      isOptional: q.isOptional || !gq.required,
      answer: existing
        ? {
            visibility: existing.visibility,
            value: existing.valueJson ? JSON.parse(existing.valueJson) : null,
          }
        : null,
    };
  });

  return {
    session: {
      id: session.id,
      status: session.status,
      displayName: session.displayName,
      submittedAt: session.submittedAt,
    },
    creatorName: game.creator.displayName,
    title: game.title,
    message: game.message,
    questions,
  };
}

export async function saveAnswers(
  sessionId: string,
  receiptToken: string,
  answers: z.infer<typeof answerSchema>[],
) {
  const session = await requireSession(sessionId, receiptToken);
  if (!session.consentAccepted) throw new AppError(403, 'Consent required', 'CONSENT_REQUIRED');
  if (session.status === SessionStatus.SUBMITTED) {
    throw new AppError(409, 'Responses already submitted', 'ALREADY_SUBMITTED');
  }

  const parsed = z.array(answerSchema).min(1).parse(answers);
  const gameQuestions = await prisma.gameQuestion.findMany({
    where: { gameId: session.gameId },
    select: { questionId: true },
  });
  const allowed = new Set(gameQuestions.map((q) => q.questionId));

  for (const answer of parsed) {
    if (!allowed.has(answer.questionId)) {
      throw new AppError(400, 'Invalid question for this game');
    }
    const visibility = answer.visibility as Visibility;
    const hasValue =
      answer.value !== undefined &&
      answer.value !== null &&
      !(typeof answer.value === 'string' && answer.value.trim() === '') &&
      !(Array.isArray(answer.value) && answer.value.length === 0);

    if ((visibility === 'SKIPPED' || visibility === 'DECLINED') && hasValue) {
      throw new AppError(400, 'Skipped or declined answers cannot include a value');
    }
    if ((visibility === 'SHARE' || visibility === 'PRIVATE') && !hasValue) {
      throw new AppError(400, 'Shared or private answers require a value');
    }

    await prisma.response.upsert({
      where: {
        sessionId_questionId: { sessionId: session.id, questionId: answer.questionId },
      },
      create: {
        sessionId: session.id,
        questionId: answer.questionId,
        visibility,
        valueJson:
          visibility === 'SHARE' || visibility === 'PRIVATE'
            ? JSON.stringify(answer.value)
            : null,
      },
      update: {
        visibility,
        valueJson:
          visibility === 'SHARE' || visibility === 'PRIVATE'
            ? JSON.stringify(answer.value)
            : null,
      },
    });
  }

  if (session.status === SessionStatus.STARTED || session.status === SessionStatus.IN_PROGRESS) {
    await prisma.respondentSession.update({
      where: { id: session.id },
      data: { status: SessionStatus.IN_PROGRESS },
    });
  }

  return { ok: true, saved: parsed.length };
}

export async function submitSession(sessionId: string, receiptToken: string) {
  const session = await requireSession(sessionId, receiptToken);
  if (!session.consentAccepted) throw new AppError(403, 'Consent required', 'CONSENT_REQUIRED');
  if (session.status === SessionStatus.SUBMITTED) {
    throw new AppError(409, 'Already submitted', 'ALREADY_SUBMITTED');
  }

  const gameQuestions = await prisma.gameQuestion.findMany({
    where: { gameId: session.gameId },
  });
  const responses = await prisma.response.findMany({ where: { sessionId: session.id } });
  if (responses.length === 0) {
    throw new AppError(400, 'Add at least one answer before submitting');
  }

  const answeredIds = new Set(responses.map((r) => r.questionId));
  const missing = gameQuestions.filter((gq) => !answeredIds.has(gq.questionId));
  // Auto-mark unanswered as skipped so partial play is allowed without forcing disclosure
  await prisma.$transaction(async (tx) => {
    for (const miss of missing) {
      await tx.response.create({
        data: {
          sessionId: session.id,
          questionId: miss.questionId,
          visibility: Visibility.SKIPPED,
          valueJson: null,
        },
      });
    }

    await tx.respondentSession.update({
      where: { id: session.id },
      data: {
        status: SessionStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    const game = await tx.game.findUnique({ where: { id: session.gameId } });
    if (game) {
      await tx.activity.create({
        data: {
          userId: game.creatorId,
          gameId: game.id,
          type: 'response_submitted',
          message: `${session.displayName || 'Someone'} completed “${game.title}”`,
        },
      });
    }
  });

  return { ok: true, receiptHint: session.receiptTokenHint };
}

export async function getReceipt(receiptToken: string) {
  const session = assertFound(
    await prisma.respondentSession.findUnique({
      where: { receiptTokenHash: hashToken(receiptToken) },
      include: {
        game: {
          include: {
            creator: { select: { displayName: true } },
            questions: true,
          },
        },
        responses: {
          include: { question: { include: { category: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
  );

  if (session.status === SessionStatus.DELETED || session.deletedAt) {
    throw new AppError(410, 'This receipt was deleted', 'RECEIPT_DELETED');
  }
  if (session.status !== SessionStatus.SUBMITTED) {
    throw new AppError(404, 'Submission not found yet', 'NOT_SUBMITTED');
  }

  return {
    receiptHint: session.receiptTokenHint,
    creatorName: session.game.creator.displayName,
    title: session.game.title,
    submittedAt: session.submittedAt,
    retentionDays: session.retentionDays,
    expiresAt: session.expiresAt,
    answers: session.responses.map((r) => ({
      questionId: r.questionId,
      prompt: (
        session.game.questions.find((q) => q.questionId === r.questionId)?.prompt ||
        r.question.prompt
      ).replace(/\{name\}/g, session.game.creator.displayName),
      round: r.question.round,
      category: r.question.category.name,
      visibility: r.visibility,
      value: r.valueJson ? JSON.parse(r.valueJson) : null,
    })),
  };
}

export async function deleteSubmission(receiptToken: string) {
  const session = assertFound(
    await prisma.respondentSession.findUnique({
      where: { receiptTokenHash: hashToken(receiptToken) },
    }),
  );

  await prisma.$transaction([
    prisma.response.deleteMany({ where: { sessionId: session.id } }),
    prisma.consentRecord.deleteMany({ where: { sessionId: session.id } }),
    prisma.respondentSession.update({
      where: { id: session.id },
      data: {
        status: SessionStatus.DELETED,
        deletedAt: new Date(),
        displayName: null,
      },
    }),
  ]);

  return { ok: true };
}

async function requireSession(sessionId: string, receiptToken: string) {
  const session = assertFound(
    await prisma.respondentSession.findUnique({ where: { id: sessionId } }),
  );
  if (session.receiptTokenHash !== hashToken(receiptToken)) {
    throw new AppError(403, 'Invalid receipt token', 'FORBIDDEN');
  }
  if (session.status === SessionStatus.DELETED || session.deletedAt) {
    throw new AppError(410, 'Session deleted', 'SESSION_DELETED');
  }
  return session;
}
