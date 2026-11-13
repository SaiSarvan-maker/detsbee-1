import { prisma } from '../lib/prisma.js';

// Keep the built-in prompt catalog available even when a newly provisioned
// production database has only had `prisma db push` run and has not been seeded.
// These IDs are catalog-only; game creation safely stores the chosen prompt as
// a creator question when its source ID is not present in the database.
const builtInCatalog = [
  {
    id: 'builtin-favourites',
    slug: 'favourites',
    name: 'Favourites',
    description: 'The small preferences that feel surprisingly personal.',
    round: 'ABOUT_ME' as const,
    questions: [
      ['fav-food', 'What food makes you happiest?'],
      ['fav-colour', 'Favourite colour?'],
      ['fav-movie', 'A movie you could watch again tomorrow?'],
      ['fav-song', 'A song that feels like you right now?'],
      ['fav-artist', 'Favourite artist or band?'],
      ['fav-book', 'A book that stayed with you?'],
    ],
  },
  {
    id: 'builtin-interests',
    slug: 'interests',
    name: 'Interests',
    description: 'What you choose to spend attention on.',
    round: 'ABOUT_ME' as const,
    questions: [
      ['hobbies', 'Which hobbies feel like home?'],
      ['entertainment', 'How do you usually unwind?'],
      ['creative', 'Any creative interests?'],
    ],
  },
  {
    id: 'builtin-lifestyle',
    slug: 'lifestyle',
    name: 'Lifestyle',
    description: 'Rhythm, places, and soft preferences.',
    round: 'ABOUT_ME' as const,
    questions: [
      ['ideal-weekend', 'Describe your ideal weekend in a sentence.'],
      ['favourite-season', 'Favourite season?'],
      ['environment', 'Preferred environment?'],
      ['travel', 'Dream travel vibe?'],
      ['chrono', 'Morning person or night owl?'],
    ],
  },
  {
    id: 'builtin-little-joys',
    slug: 'little-joys',
    name: 'Little Joys',
    description: 'Tiny details that make someone feel known.',
    round: 'ABOUT_ME' as const,
    questions: [
      ['happy-things', 'What is a small thing that reliably makes you happy?'],
      ['dream-experience', 'A dream experience still on your list?'],
      ['appreciate', 'Something you quietly appreciate in daily life?'],
    ],
  },
  {
    id: 'builtin-first-impressions',
    slug: 'first-impressions',
    name: 'First Impressions',
    description: 'How someone arrives in your mind.',
    round: 'HOW_I_SEE_YOU' as const,
    questions: [
      ['first-impression', 'What was your first impression of {name}?'],
      ['three-words', 'Three words that describe {name}?'],
      ['personality', 'How would you describe their personality?'],
    ],
  },
  {
    id: 'builtin-strengths',
    slug: 'strengths',
    name: 'Strengths & Warmth',
    description: 'Appreciation without pressure.',
    round: 'HOW_I_SEE_YOU' as const,
    questions: [
      ['strongest-quality', 'What do you think is {name}’s strongest quality?'],
      ['interesting', 'What makes {name} interesting?'],
      ['appreciate-them', 'What’s something you appreciate about {name}?'],
      ['energy-scale', 'How would you rate the warmth of their presence?'],
    ],
  },
  {
    id: 'builtin-connection',
    slug: 'connection',
    name: 'Connection',
    description: 'Optional reflections on friendship and presence.',
    round: 'HOW_I_SEE_YOU' as const,
    questions: [
      ['environment-guess', 'What kind of environment do you think {name} enjoys?'],
      ['should-know', 'What’s something you think {name} should know about themselves?'],
      ['friendship-note', 'If you could leave one kind note for {name}, what would it be?'],
    ],
  },
].map((category) => ({
  ...category,
  questions: category.questions.map(([slug, prompt]) => ({
    id: `builtin-${slug}`,
    slug,
    prompt,
    helpText: null,
    type: 'LONG_TEXT',
    options: null,
    round: category.round,
    isOptional: false,
  })),
}));

export async function listCatalog() {
  const categories = await prisma.questionCategory.findMany({
    orderBy: [{ round: 'asc' }, { sortOrder: 'asc' }],
    include: {
      questions: { orderBy: { sortOrder: 'asc' } },
    },
  });

  const populated = categories
    .filter((c) => c.questions.length > 0)
    .map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    round: c.round,
    questions: c.questions.map((q) => ({
      id: q.id,
      slug: q.slug,
      prompt: q.prompt,
      helpText: q.helpText,
      type: q.type,
      options: q.optionsJson ? JSON.parse(q.optionsJson) : null,
      round: q.round,
      isOptional: q.isOptional,
    })),
  }));

  return populated.length > 0 ? populated : builtInCatalog;
}
