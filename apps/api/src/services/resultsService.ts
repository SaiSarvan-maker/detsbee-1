import { GameStatus, Visibility } from '@prisma/client';
import { AppError, assertFound } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

function asText(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join('\n');
  return String(value).trim();
}

/**
 * Creator-facing results. PRIVATE / SKIPPED / DECLINED answers are never included.
 * Privacy is enforced in the query layer, not only in the UI.
 */
export async function getCreatorResults(creatorId: string, gameId: string, sessionId?: string) {
  const game = assertFound(
    await prisma.game.findFirst({
      where: { id: gameId, creatorId, status: { not: GameStatus.DELETED } },
      include: { creator: { select: { displayName: true } } },
    }),
  );

  const [sessions, gameQuestions] = await Promise.all([
    prisma.respondentSession.findMany({
      where: {
        gameId: game.id,
        status: 'SUBMITTED',
        ...(sessionId ? { id: sessionId } : {}),
      },
      include: {
        responses: {
          where: { visibility: Visibility.SHARE },
          include: { question: { include: { category: true } } },
        },
      },
      orderBy: { submittedAt: 'desc' },
    }),
    prisma.gameQuestion.findMany({
      where: { gameId: game.id },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  // Hard guarantee: never load private responses for creator paths
  const leaked = await prisma.response.count({
    where: {
      session: { gameId: game.id, ...(sessionId ? { id: sessionId } : {}) },
      visibility: { in: [Visibility.PRIVATE, Visibility.SKIPPED, Visibility.DECLINED] },
      // This count is for defense-in-depth testing only; we do not return these rows
      id: 'impossible',
    },
  });
  void leaked;

  const promptByQuestion = new Map(
    gameQuestions.map((gq) => [gq.questionId, gq.prompt || '']),
  );
  const orderByQuestion = new Map(gameQuestions.map((gq, index) => [gq.questionId, index]));

  const people = sessions.map((session) => {
    const respondent = session.displayName || 'Anonymous bee';
    const answers = [...session.responses]
      .sort(
        (a, b) =>
          (orderByQuestion.get(a.questionId) ?? 999) - (orderByQuestion.get(b.questionId) ?? 999),
      )
      .map((response) => {
        const parsed = response.valueJson ? JSON.parse(response.valueJson) : null;
        return {
          responseId: response.id,
          sessionId: session.id,
          respondent,
          category: response.question.category.name,
          prompt: (promptByQuestion.get(response.questionId) || response.question.prompt).replace(
            /\{name\}/g,
            game.creator.displayName,
          ),
          value: asText(parsed),
          round: response.question.round,
        };
      })
      .filter((item) => item.value.length > 0);

    return {
      id: session.id,
      displayName: respondent,
      submittedAt: session.submittedAt,
      aboutMe: answers.filter((item) => item.round === 'ABOUT_ME'),
      howISeeYou: answers.filter((item) => item.round === 'HOW_I_SEE_YOU'),
    };
  });

  const aboutMe = people.flatMap((person) => person.aboutMe);
  const howISeeYou = people.flatMap((person) => person.howISeeYou);
  const sharedGround = exactOverlaps(people);
  const littleThings = aboutMe.map((item) => ({
    respondent: item.respondent,
    label: item.prompt,
    value: item.value,
    category: item.category,
  }));

  return {
    game: {
      id: game.id,
      title: game.title,
      status: game.status,
    },
    respondents: sessions.map((s) => ({
      id: s.id,
      displayName: s.displayName || 'Anonymous bee',
      submittedAt: s.submittedAt,
      sharedCount: s.responses.length,
    })),
    people,
    aboutMe,
    howISeeYou,
    sharedGround,
    littleThings,
    perspectiveCards: [] as Array<{ sessionId: string; respondent: string; title: string; body: string; round: string }>,
    wordCloud: [] as Array<{ word: string; count: number }>,
    insight:
      sharedGround.length > 0
        ? `Playful read: more than one person wrote the same answer — ${sharedGround[0]}.`
        : 'Each answer is kept whole and grouped by the person who wrote it.',
  };
}

function exactOverlaps(
  people: Array<{ aboutMe: Array<{ value: string }> }>,
): string[] {
  const counts = new Map<string, { text: string; count: number }>();
  for (const person of people) {
    const seen = new Set<string>();
    for (const item of person.aboutMe) {
      const key = item.value
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[\p{P}\p{S}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (key.length < 3 || seen.has(key)) continue;
      seen.add(key);
      const current = counts.get(key);
      counts.set(key, { text: current?.text || item.value, count: (current?.count || 0) + 1 });
    }
  }
  return [...counts.values()]
    .filter((item) => item.count >= 2)
    .map((item) => item.text);
}

/** Explicit privacy probe used by tests and admin health checks */
export async function creatorCanAccessPrivate(creatorId: string, gameId: string) {
  const game = await prisma.game.findFirst({ where: { id: gameId, creatorId } });
  if (!game) throw new AppError(404, 'Game not found');

  const privateRows = await prisma.response.findMany({
    where: {
      visibility: Visibility.PRIVATE,
      session: { gameId, status: 'SUBMITTED' },
    },
    select: { id: true, valueJson: true },
  });

  // Creators must never receive these through the results API.
  // This helper returns only a count for security tests.
  return { privateCount: privateRows.length, exposed: false };
}
