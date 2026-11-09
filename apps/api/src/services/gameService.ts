import { GameStatus, type Prisma } from '@prisma/client';
import { customAlphabet } from 'nanoid';
import { z } from 'zod';
import { AppError, assertFound } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { generateInviteToken, hashToken, tokenHint } from '../lib/tokens.js';

const customId = customAlphabet('abcdefghijkmnopqrstuvwxyz23456789', 12);

const draftQuestionSchema = z.object({
  sourceId: z.string().optional(),
  prompt: z.string().trim().min(3).max(300),
  round: z.enum(['ABOUT_ME', 'HOW_I_SEE_YOU']),
});

export const createGameSchema = z
  .object({
    title: z.string().trim().min(2).max(80),
    message: z.string().trim().max(400).optional(),
    questions: z.array(draftQuestionSchema).min(2).max(40).optional(),
    questionIds: z.array(z.string()).min(2).max(40).optional(),
    expiresInDays: z.number().int().min(1).max(90).default(14),
    maxRespondents: z.number().int().min(1).max(200).default(50),
  })
  .refine((data) => (data.questions?.length ?? 0) > 0 || (data.questionIds?.length ?? 0) > 0, {
    message: 'Add at least one question from each round',
  });

function publicInviteUrl(token: string) {
  const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  return `${origin}/play/${token}`;
}

type DraftQuestion = z.infer<typeof draftQuestionSchema>;

async function categoryForRound(
  tx: Prisma.TransactionClient,
  round: 'ABOUT_ME' | 'HOW_I_SEE_YOU',
) {
  const slug = round === 'ABOUT_ME' ? 'custom-about' : 'custom-see';
  const existing = await tx.questionCategory.findUnique({ where: { slug } });
  if (existing) return existing;
  return tx.questionCategory.create({
    data: {
      slug,
      name: round === 'ABOUT_ME' ? 'Your questions' : 'Your questions about them',
      description: 'Added by the creator for this discovery.',
      round,
      sortOrder: 50,
    },
  });
}

export async function createGame(creatorId: string, input: z.infer<typeof createGameSchema>) {
  const data = createGameSchema.parse(input);
  let drafts: DraftQuestion[] = data.questions ?? [];

  if (!drafts.length && data.questionIds) {
    const rows = await prisma.question.findMany({ where: { id: { in: data.questionIds } } });
    if (rows.length !== new Set(data.questionIds).size) {
      throw new AppError(400, 'One or more questions are invalid');
    }
    const byId = new Map(rows.map((row) => [row.id, row]));
    drafts = data.questionIds.map((id) => {
      const row = byId.get(id);
      if (!row) throw new AppError(400, 'One or more questions are invalid');
      return { sourceId: row.id, prompt: row.prompt, round: row.round };
    });
  }

  const hasAbout = drafts.some((q) => q.round === 'ABOUT_ME');
  const hasSeeYou = drafts.some((q) => q.round === 'HOW_I_SEE_YOU');
  if (!hasAbout || !hasSeeYou) {
    throw new AppError(400, 'A game needs questions from both discovery rounds');
  }

  const rawToken = generateInviteToken();
  const expiresAt = new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000);

  const game = await prisma.$transaction(async (tx) => {
    const created = await tx.game.create({
      data: {
        creatorId,
        title: data.title,
        message: data.message || null,
        status: GameStatus.ACTIVE,
        inviteTokenHash: hashToken(rawToken),
        inviteTokenHint: tokenHint(rawToken),
        expiresAt,
        maxRespondents: data.maxRespondents,
      },
    });

    const usedQuestionIds = new Set<string>();
    for (const [index, draft] of drafts.entries()) {
      let questionId: string | null = null;
      if (draft.sourceId && !usedQuestionIds.has(draft.sourceId)) {
        const source = await tx.question.findUnique({ where: { id: draft.sourceId } });
        if (source && source.prompt === draft.prompt && source.round === draft.round) {
          questionId = source.id;
        }
      }

      if (!questionId) {
        const category = await categoryForRound(tx, draft.round);
        const createdQuestion = await tx.question.create({
          data: {
            slug: `custom-${customId()}`,
            prompt: draft.prompt,
            type: 'LONG_TEXT',
            round: draft.round,
            categoryId: category.id,
            creatorId,
            isOptional: true,
          },
        });
        questionId = createdQuestion.id;
      }

      usedQuestionIds.add(questionId);
      await tx.gameQuestion.create({
        data: {
          gameId: created.id,
          questionId,
          prompt: draft.prompt,
          sortOrder: index,
        },
      });
    }

    await tx.activity.create({
      data: {
        userId: creatorId,
        gameId: created.id,
        type: 'game_created',
        message: `Opened a new discovery: “${created.title}”`,
      },
    });

    return created;
  });

  return {
    id: game.id,
    title: game.title,
    status: game.status,
    expiresAt: game.expiresAt,
    inviteHint: game.inviteTokenHint,
    inviteUrl: publicInviteUrl(rawToken),
    inviteToken: rawToken,
  };
}

async function refreshExpiration(gameId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || game.status === GameStatus.DELETED) return game;
  if (game.status === GameStatus.DISABLED) return game;
  if (game.expiresAt && game.expiresAt.getTime() < Date.now() && game.status !== GameStatus.EXPIRED) {
    return prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.EXPIRED },
    });
  }
  return game;
}

export async function listGames(creatorId: string) {
  const games = await prisma.game.findMany({
    where: { creatorId, status: { not: GameStatus.DELETED } },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          sessions: { where: { status: 'SUBMITTED' } },
        },
      },
    },
  });

  await Promise.all(games.map((g) => refreshExpiration(g.id)));

  const refreshed = await prisma.game.findMany({
    where: { creatorId, status: { not: GameStatus.DELETED } },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          sessions: { where: { status: 'SUBMITTED' } },
        },
      },
    },
  });

  return refreshed.map((g) => ({
    id: g.id,
    title: g.title,
    status: g.status,
    expiresAt: g.expiresAt,
    inviteHint: g.inviteTokenHint,
    completedResponses: g._count.sessions,
    createdAt: g.createdAt,
  }));
}

export async function getGameForCreator(creatorId: string, gameId: string) {
  await refreshExpiration(gameId);
  const game = assertFound(
    await prisma.game.findFirst({
      where: { id: gameId, creatorId, status: { not: GameStatus.DELETED } },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { question: { include: { category: true } } },
        },
        sessions: {
          where: { status: 'SUBMITTED' },
          orderBy: { submittedAt: 'desc' },
          select: {
            id: true,
            displayName: true,
            submittedAt: true,
            status: true,
          },
        },
      },
    }),
  );

  return {
    id: game.id,
    title: game.title,
    message: game.message,
    status: game.status,
    expiresAt: game.expiresAt,
    inviteHint: game.inviteTokenHint,
    maxRespondents: game.maxRespondents,
    createdAt: game.createdAt,
    respondents: game.sessions,
    questions: game.questions.map((gq) => ({
      id: gq.question.id,
      prompt: gq.prompt || gq.question.prompt,
      round: gq.question.round,
      category: gq.question.category.name,
      type: 'LONG_TEXT',
    })),
  };
}

export async function rotateInviteLink(creatorId: string, gameId: string) {
  const game = assertFound(
    await prisma.game.findFirst({
      where: { id: gameId, creatorId, status: { in: [GameStatus.ACTIVE, GameStatus.DISABLED] } },
    }),
  );

  const rawToken = generateInviteToken();
  await prisma.game.update({
    where: { id: game.id },
    data: {
      inviteTokenHash: hashToken(rawToken),
      inviteTokenHint: tokenHint(rawToken),
      status: GameStatus.ACTIVE,
      disabledAt: null,
    },
  });

  return {
    inviteUrl: publicInviteUrl(rawToken),
    inviteToken: rawToken,
    inviteHint: tokenHint(rawToken),
  };
}

export async function setGameEnabled(creatorId: string, gameId: string, enabled: boolean) {
  const game = assertFound(
    await prisma.game.findFirst({
      where: { id: gameId, creatorId, status: { not: GameStatus.DELETED } },
    }),
  );

  if (game.expiresAt && game.expiresAt.getTime() < Date.now()) {
    throw new AppError(400, 'This invitation has expired', 'EXPIRED');
  }

  const updated = await prisma.game.update({
    where: { id: game.id },
    data: {
      status: enabled ? GameStatus.ACTIVE : GameStatus.DISABLED,
      disabledAt: enabled ? null : new Date(),
    },
  });

  return { id: updated.id, status: updated.status };
}

export async function deleteGame(creatorId: string, gameId: string) {
  const game = assertFound(
    await prisma.game.findFirst({ where: { id: gameId, creatorId } }),
  );

  await prisma.$transaction(async (tx) => {
    await tx.response.deleteMany({
      where: { session: { gameId: game.id } },
    });
    await tx.consentRecord.deleteMany({
      where: { session: { gameId: game.id } },
    });
    await tx.respondentSession.deleteMany({ where: { gameId: game.id } });
    await tx.gameQuestion.deleteMany({ where: { gameId: game.id } });
    await tx.game.update({
      where: { id: game.id },
      data: { status: GameStatus.DELETED, deletedAt: new Date() },
    });
    await tx.activity.create({
      data: {
        userId: creatorId,
        gameId: game.id,
        type: 'game_deleted',
        message: `Deleted discovery “${game.title}” and associated responses`,
      },
    });
  });

  return { ok: true };
}

export async function resolveInvite(rawToken: string) {
  const hashed = hashToken(rawToken);
  let game = await prisma.game.findUnique({
    where: { inviteTokenHash: hashed },
    include: {
      creator: { select: { displayName: true } },
      _count: { select: { sessions: { where: { status: 'SUBMITTED' } } } },
    },
  });

  if (!game || game.status === GameStatus.DELETED) {
    throw new AppError(404, 'Invitation not found', 'INVITE_NOT_FOUND');
  }

  game = (await refreshExpiration(game.id)) as typeof game;
  const fresh = assertFound(
    await prisma.game.findUnique({
      where: { id: game.id },
      include: {
        creator: { select: { displayName: true } },
        _count: { select: { sessions: { where: { status: 'SUBMITTED' } } } },
      },
    }),
  );

  if (fresh.status === GameStatus.DISABLED) {
    throw new AppError(410, 'This invitation has been disabled', 'INVITE_DISABLED');
  }
  if (fresh.status === GameStatus.EXPIRED) {
    throw new AppError(410, 'This invitation has expired', 'INVITE_EXPIRED');
  }
  if (fresh.status !== GameStatus.ACTIVE) {
    throw new AppError(410, 'This invitation is not available', 'INVITE_UNAVAILABLE');
  }
  if (fresh._count.sessions >= fresh.maxRespondents) {
    throw new AppError(410, 'This discovery is full', 'INVITE_FULL');
  }

  return {
    gameId: fresh.id,
    title: fresh.title,
    message: fresh.message,
    creatorName: fresh.creator.displayName,
    expiresAt: fresh.expiresAt,
    retentionDays: 90,
  };
}

export async function getDashboard(creatorId: string) {
  const [games, activities, submittedCount] = await Promise.all([
    listGames(creatorId),
    prisma.activity.findMany({
      where: { userId: creatorId },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.respondentSession.count({
      where: { status: 'SUBMITTED', game: { creatorId, status: { not: GameStatus.DELETED } } },
    }),
  ]);

  const active = games.filter((g) => g.status === 'ACTIVE');
  const pending = games.filter((g) => g.status === 'DISABLED' || g.status === 'EXPIRED');

  return {
    stats: {
      activeGames: active.length,
      totalResponses: submittedCount,
      pendingGames: pending.length,
    },
    games,
    activities: activities.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt,
      gameId: a.gameId,
    })),
  };
}
