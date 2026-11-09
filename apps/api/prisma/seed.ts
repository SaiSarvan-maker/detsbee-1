import { PrismaClient, QuestionType, RoundKind } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();
const pepper = process.env.TOKEN_PEPPER || 'detsbee-token-pepper-dev-only';

function hashToken(token: string) {
  return createHash('sha256').update(`${pepper}:${token}`).digest('hex');
}

type Q = {
  slug: string;
  prompt: string;
  helpText?: string;
  type: QuestionType;
  options?: string[];
  isOptional?: boolean;
};

async function seedCategories() {
  const catalog: Array<{
    slug: string;
    name: string;
    description: string;
    round: RoundKind;
    sortOrder: number;
    questions: Q[];
  }> = [
    {
      slug: 'favourites',
      name: 'Favourites',
      description: 'The small preferences that feel surprisingly personal.',
      round: 'ABOUT_ME',
      sortOrder: 1,
      questions: [
        {
          slug: 'fav-food',
          prompt: 'What food makes you happiest?',
          type: 'SHORT_TEXT',
        },
        {
          slug: 'fav-colour',
          prompt: 'Favourite colour?',
          type: 'SINGLE',
          options: ['Honey gold', 'Deep navy', 'Forest green', 'Soft blush', 'Charcoal', 'Sky blue', 'Other'],
        },
        {
          slug: 'fav-movie',
          prompt: 'A movie you could watch again tomorrow?',
          type: 'SHORT_TEXT',
        },
        {
          slug: 'fav-song',
          prompt: 'A song that feels like you right now?',
          type: 'SHORT_TEXT',
        },
        {
          slug: 'fav-artist',
          prompt: 'Favourite artist or band?',
          type: 'SHORT_TEXT',
        },
        {
          slug: 'fav-book',
          prompt: 'A book that stayed with you?',
          type: 'SHORT_TEXT',
          isOptional: true,
        },
      ],
    },
    {
      slug: 'interests',
      name: 'Interests',
      description: 'What you choose to spend attention on.',
      round: 'ABOUT_ME',
      sortOrder: 2,
      questions: [
        {
          slug: 'hobbies',
          prompt: 'Which hobbies feel like home?',
          type: 'MULTI',
          options: ['Cooking', 'Reading', 'Gaming', 'Music', 'Sports', 'Art', 'Hiking', 'Photography', 'Coding', 'Dance'],
        },
        {
          slug: 'entertainment',
          prompt: 'How do you usually unwind?',
          type: 'MULTI',
          options: ['Films', 'Series', 'Podcasts', 'Live music', 'Games', 'Quiet walks', 'Cooking shows'],
        },
        {
          slug: 'creative',
          prompt: 'Any creative interests?',
          type: 'SHORT_TEXT',
          isOptional: true,
        },
      ],
    },
    {
      slug: 'lifestyle',
      name: 'Lifestyle',
      description: 'Rhythm, places, and soft preferences.',
      round: 'ABOUT_ME',
      sortOrder: 3,
      questions: [
        {
          slug: 'ideal-weekend',
          prompt: 'Describe your ideal weekend in a sentence.',
          type: 'LONG_TEXT',
        },
        {
          slug: 'favourite-season',
          prompt: 'Favourite season?',
          type: 'SINGLE',
          options: ['Spring', 'Summer', 'Monsoon', 'Autumn', 'Winter'],
        },
        {
          slug: 'environment',
          prompt: 'Preferred environment?',
          type: 'SINGLE',
          options: ['Busy city', 'Quiet suburb', 'Nature', 'Coast', 'Somewhere new'],
        },
        {
          slug: 'travel',
          prompt: 'Dream travel vibe?',
          type: 'EMOJI',
          options: ['🏔️ Mountains', '🏝️ Islands', '🏛️ Culture cities', '🍜 Food trips', '⛺ Camping', '🏠 Staycations'],
        },
        {
          slug: 'chrono',
          prompt: 'Morning person or night owl?',
          type: 'SINGLE',
          options: ['Early light', 'Slow mornings', 'Night energy', 'Depends on the week'],
        },
      ],
    },
    {
      slug: 'little-joys',
      name: 'Little Joys',
      description: 'Tiny details that make someone feel known.',
      round: 'ABOUT_ME',
      sortOrder: 4,
      questions: [
        {
          slug: 'happy-things',
          prompt: 'What is a small thing that reliably makes you happy?',
          type: 'SHORT_TEXT',
        },
        {
          slug: 'dream-experience',
          prompt: 'A dream experience still on your list?',
          type: 'SHORT_TEXT',
          isOptional: true,
        },
        {
          slug: 'appreciate',
          prompt: 'Something you quietly appreciate in daily life?',
          type: 'SHORT_TEXT',
        },
      ],
    },
    {
      slug: 'first-impressions',
      name: 'First Impressions',
      description: 'How someone arrives in your mind.',
      round: 'HOW_I_SEE_YOU',
      sortOrder: 1,
      questions: [
        {
          slug: 'first-impression',
          prompt: 'What was your first impression of {name}?',
          type: 'LONG_TEXT',
        },
        {
          slug: 'three-words',
          prompt: 'Three words that describe {name}?',
          type: 'SHORT_TEXT',
          helpText: 'Separate with commas',
        },
        {
          slug: 'personality',
          prompt: 'How would you describe their personality?',
          type: 'LONG_TEXT',
        },
      ],
    },
    {
      slug: 'strengths',
      name: 'Strengths & Warmth',
      description: 'Appreciation without pressure.',
      round: 'HOW_I_SEE_YOU',
      sortOrder: 2,
      questions: [
        {
          slug: 'strongest-quality',
          prompt: 'What do you think is {name}’s strongest quality?',
          type: 'SHORT_TEXT',
        },
        {
          slug: 'interesting',
          prompt: 'What makes {name} interesting?',
          type: 'LONG_TEXT',
        },
        {
          slug: 'appreciate-them',
          prompt: 'What’s something you appreciate about {name}?',
          type: 'LONG_TEXT',
        },
        {
          slug: 'energy-scale',
          prompt: 'How would you rate the warmth of their presence?',
          type: 'SCALE',
          options: ['1', '2', '3', '4', '5'],
          isOptional: true,
        },
      ],
    },
    {
      slug: 'connection',
      name: 'Connection',
      description: 'Optional reflections on friendship and presence.',
      round: 'HOW_I_SEE_YOU',
      sortOrder: 3,
      questions: [
        {
          slug: 'environment-guess',
          prompt: 'What kind of environment do you think {name} enjoys?',
          type: 'SHORT_TEXT',
        },
        {
          slug: 'should-know',
          prompt: 'What’s something you think {name} should know about themselves?',
          type: 'LONG_TEXT',
          isOptional: true,
        },
        {
          slug: 'friendship-note',
          prompt: 'If you could leave one kind note for {name}, what would it be?',
          type: 'LONG_TEXT',
          isOptional: true,
        },
      ],
    },
  ];

  for (const cat of catalog) {
    const category = await prisma.questionCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        round: cat.round,
        sortOrder: cat.sortOrder,
      },
      create: {
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        round: cat.round,
        sortOrder: cat.sortOrder,
      },
    });

    for (const [index, q] of cat.questions.entries()) {
      await prisma.question.upsert({
        where: { slug: q.slug },
        update: {
          prompt: q.prompt,
          helpText: q.helpText || null,
          type: q.type,
          optionsJson: q.options ? JSON.stringify(q.options) : null,
          round: cat.round,
          sortOrder: index,
          isOptional: q.isOptional || false,
          categoryId: category.id,
        },
        create: {
          slug: q.slug,
          prompt: q.prompt,
          helpText: q.helpText || null,
          type: q.type,
          optionsJson: q.options ? JSON.stringify(q.options) : null,
          round: cat.round,
          sortOrder: index,
          isOptional: q.isOptional || false,
          categoryId: category.id,
        },
      });
    }
  }
}

async function seedDemoUser() {
  const passwordHash = await bcrypt.hash('honeycomb123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'demo@detsbee.app' },
    update: {
      displayName: 'Avery Hive',
      passwordHash,
      emailVerified: true,
    },
    create: {
      email: 'demo@detsbee.app',
      displayName: 'Avery Hive',
      passwordHash,
      emailVerified: true,
    },
  });

  const questions = await prisma.question.findMany({ orderBy: { sortOrder: 'asc' } });
  const selected = questions.filter((q) =>
    [
      'fav-food',
      'fav-colour',
      'hobbies',
      'ideal-weekend',
      'happy-things',
      'first-impression',
      'three-words',
      'strongest-quality',
      'appreciate-them',
      'should-know',
    ].includes(q.slug),
  );

  const inviteToken = 'db_DEMOINVITETOKEN1234567890ABCD';
  const existing = await prisma.game.findFirst({
    where: { creatorId: user.id, title: 'Weekend discovery' },
  });

  let gameId = existing?.id;
  if (!existing) {
    const game = await prisma.game.create({
      data: {
        creatorId: user.id,
        title: 'Weekend discovery',
        message: 'Curious about the little things — answer only what feels good.',
        status: 'ACTIVE',
        inviteTokenHash: hashToken(inviteToken),
        inviteTokenHint: inviteToken.slice(-6),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        questions: {
          create: selected.map((q, i) => ({ questionId: q.id, sortOrder: i, prompt: q.prompt })),
        },
      },
    });
    gameId = game.id;

    await prisma.activity.create({
      data: {
        userId: user.id,
        gameId: game.id,
        type: 'game_created',
        message: 'Opened a new discovery: “Weekend discovery”',
      },
    });

    const receipt = 'rcpt_DEMORECEIPTTOKEN1234567890XYZ';
    const session = await prisma.respondentSession.create({
      data: {
        gameId: game.id,
        displayName: 'Jordan',
        status: 'SUBMITTED',
        consentAccepted: true,
        consentAt: new Date(),
        consentVersion: '2026-03-v1',
        receiptTokenHash: hashToken(receipt),
        receiptTokenHint: receipt.slice(-6),
        submittedAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });

    const sharedPairs: Array<[string, string, 'SHARE' | 'PRIVATE']> = [
      ['fav-food', 'Misal pav on rainy evenings', 'SHARE'],
      ['fav-colour', 'Honey gold', 'SHARE'],
      ['hobbies', JSON.stringify(['Cooking', 'Music', 'Hiking']), 'SHARE'],
      ['ideal-weekend', 'Slow coffee, a long walk, cooking something new', 'SHARE'],
      ['happy-things', 'Handwritten notes', 'PRIVATE'],
      ['first-impression', 'Warm, curious, quietly confident', 'SHARE'],
      ['three-words', 'kind, curious, steady', 'SHARE'],
      ['strongest-quality', 'They make people feel at ease', 'SHARE'],
      ['appreciate-them', 'The way they remember small details', 'SHARE'],
      ['should-know', 'You light up rooms without trying', 'PRIVATE'],
    ];

    for (const [slug, value, visibility] of sharedPairs) {
      const question = selected.find((q) => q.slug === slug);
      if (!question) continue;
      await prisma.response.create({
        data: {
          sessionId: session.id,
          questionId: question.id,
          visibility,
          valueJson: visibility === 'SHARE' || visibility === 'PRIVATE' ? (value.startsWith('[') ? value : JSON.stringify(value)) : null,
        },
      });
    }

    await prisma.activity.create({
      data: {
        userId: user.id,
        gameId: game.id,
        type: 'response_submitted',
        message: 'Jordan completed “Weekend discovery”',
      },
    });
  }

  console.log('Seeded demo user demo@detsbee.app / honeycomb123');
  console.log('Demo invite token:', inviteToken);
  console.log('Demo game id:', gameId);
}

async function main() {
  await seedCategories();
  await seedDemoUser();
}

const invokedDirectly = process.argv[1]?.replaceAll('\\', '/').includes('prisma/seed');
if (invokedDirectly) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}

export { seedCategories, seedDemoUser };
