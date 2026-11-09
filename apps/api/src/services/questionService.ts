import { prisma } from '../lib/prisma.js';

export async function listCatalog() {
  const categories = await prisma.questionCategory.findMany({
    orderBy: [{ round: 'asc' }, { sortOrder: 'asc' }],
    include: {
      questions: { orderBy: { sortOrder: 'asc' } },
    },
  });

  return categories
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
}
