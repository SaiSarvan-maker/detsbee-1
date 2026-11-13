import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

type Round = 'ABOUT_ME' | 'HOW_I_SEE_YOU';

type Catalog = {
  categories: Array<{
    id: string;
    name: string;
    description: string;
    round: Round;
    questions: Array<{ id: string; slug?: string; prompt: string }>;
  }>;
};

type Draft = {
  key: string;
  sourceId?: string;
  prompt: string;
  round: Round;
};

const questionVariants: Record<string, string[]> = {
  'fav-food': ['Which food can always lift your mood?', 'What meal or snack feels like a small happiness?'],
  'fav-colour': ['Which colour do you find yourself drawn to?', 'What colour feels most like you?'],
  'fav-movie': ['Which film would you happily watch again?', 'What movie never gets old for you?'],
  'fav-song': ['What song matches your mood lately?', 'Which song feels especially close to you right now?'],
  'fav-artist': ['Which musician or band do you keep coming back to?', 'Who is an artist you especially enjoy?'],
  'fav-book': ['Which book has stuck with you over time?', 'What book left a lasting impression on you?'],
  hobbies: ['What do you enjoy doing in your free time?', 'Which hobbies make you feel most at home?'],
  entertainment: ['What do you reach for when you want to unwind?', 'How do you like to relax after a busy day?'],
  creative: ['What creative things do you like making or trying?', 'Are there any creative pursuits you enjoy?'],
  'ideal-weekend': ['What would a really good weekend look like for you?', 'Describe a weekend that would leave you feeling happy.'],
  'favourite-season': ['Which season do you enjoy most, and why?', 'What time of year feels best to you?'],
  environment: ['Where do you feel most comfortable spending time?', 'What kind of place helps you feel at ease?'],
  travel: ['What kind of trip would you love to take?', 'If you could plan a getaway, what would its vibe be?'],
  chrono: ['When do you feel most energetic: morning or night?', 'What part of the day suits you best?'],
  'happy-things': ['What little everyday thing tends to brighten your day?', 'What small moment reliably makes you smile?'],
  'dream-experience': ['What experience would you still love to have one day?', 'Is there an adventure or experience on your wish list?'],
  appreciate: ['What ordinary thing in life do you feel grateful for?', 'What everyday detail do you find yourself appreciating?'],
  'first-impression': ['What stood out when you first met {name}?', 'How did {name} come across to you at first?'],
  'three-words': ['Which three words best capture {name}?', 'What three words would you use for {name}?'],
  personality: ['How would you describe what {name} is like?', 'What stands out to you about {name}’s personality?'],
  'strongest-quality': ['Which quality do you admire most in {name}?', 'What do you see as {name}’s greatest strength?'],
  interesting: ['What do you find especially interesting about {name}?', 'What makes {name} memorable to you?'],
  'appreciate-them': ['What is something about {name} that you value?', 'What is one thing you especially appreciate about {name}?'],
  'energy-scale': ['How warm does {name}’s presence feel to you?', 'How would you describe the warmth {name} brings to a room?'],
  'environment-guess': ['Where do you imagine {name} feels most at ease?', 'What kind of place do you think {name} enjoys?'],
  'should-know': ['What is something you hope {name} recognizes about themselves?', 'What would you like {name} to remember about who they are?'],
  'friendship-note': ['What kind message would you like to leave for {name}?', 'If you could share one thoughtful note with {name}, what would it be?'],
};

const questionSetHistoryKey = 'detsbee_question_set_history';

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function starterDrafts(categories: Catalog['categories']): Draft[] {
  const previousSets: string[] = (() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(questionSetHistoryKey) || '[]');
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  })();

  let next: Draft[] = [];
  let signature = '';
  for (let attempt = 0; attempt < 30; attempt += 1) {
    next = (['ABOUT_ME', 'HOW_I_SEE_YOU'] as const).flatMap((round) => {
      const groups = shuffled(
        categories
          .filter((category) => category.round === round)
          .map((category) => shuffled(category.questions)),
      );
      const selected: Catalog['categories'][number]['questions'][number][] = [];
      // Select across categories before taking a second question from any one category.
      while (selected.length < 5 && groups.some((group) => group.length > 0)) {
        for (const group of groups) {
          if (group.length && selected.length < 5) selected.push(group.pop()!);
        }
      }
      return shuffled(selected).map((question) => {
        const variants = question.slug ? questionVariants[question.slug] : undefined;
        const prompt = variants?.length && Math.random() < 0.7
          ? variants[Math.floor(Math.random() * variants.length)]
          : question.prompt;
        return {
          key: crypto.randomUUID(),
          sourceId: question.id,
          prompt,
          round,
        };
      });
    });
    signature = next.map((draft) => `${draft.sourceId}:${draft.prompt}`).sort().join('|');
    if (!previousSets.includes(signature)) break;
  }

  try {
    localStorage.setItem(questionSetHistoryKey, JSON.stringify([...previousSets.slice(-29), signature]));
  } catch {
    // The varied set still works when browser storage is unavailable.
  }
  return next;
}

export function CreateGamePage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [title, setTitle] = useState('Little things discovery');
  const [message, setMessage] = useState('Answer only what feels comfortable. Write in your own words, or skip.');
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pendingFocusKey = useRef<string | null>(null);

  useEffect(() => {
    api<Catalog>('/api/games/catalog').then((data) => {
      setCatalog(data);
      setDrafts(starterDrafts(data.categories));
    });
  }, []);

  useEffect(() => {
    const key = pendingFocusKey.current;
    if (!key) return;
    const field = document.getElementById(`question-${key}`) as HTMLTextAreaElement | null;
    if (field) {
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field.focus();
      pendingFocusKey.current = null;
    }
  }, [drafts]);

  const counts = useMemo(
    () => ({
      about: drafts.filter((d) => d.round === 'ABOUT_ME' && d.prompt.trim().length >= 3).length,
      see: drafts.filter((d) => d.round === 'HOW_I_SEE_YOU' && d.prompt.trim().length >= 3).length,
    }),
    [drafts],
  );

  function updatePrompt(key: string, prompt: string) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, prompt } : d)));
  }

  function removeDraft(key: string) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  function addBlank(round: Round) {
    const key = crypto.randomUUID();
    pendingFocusKey.current = key;
    setDrafts((prev) => {
      const lastInRound = prev.reduce((last, draft, index) => draft.round === round ? index : last, -1);
      const next = [...prev];
      next.splice(lastInRound + 1, 0, { key, prompt: '', round });
      return next;
    });
  }

  function addSuggestion(id: string, prompt: string, round: Round) {
    setDrafts((prev) => {
      if (prev.some((d) => d.sourceId === id && d.prompt === prompt)) return prev;
      return [...prev, { key: crypto.randomUUID(), sourceId: id, prompt, round }];
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const questions = drafts
        .map((d) => ({ sourceId: d.sourceId, prompt: d.prompt.trim(), round: d.round }))
        .filter((d) => d.prompt.length >= 3);
      const created = await api<{ id: string; inviteToken: string }>('/api/games', {
        method: 'POST',
        body: JSON.stringify({ title, message, expiresInDays, questions }),
      });
      const link = `${window.location.origin}/play/${created.inviteToken}`;
      sessionStorage.setItem(`detsbee_invite_${created.id}`, link);
      await navigator.clipboard?.writeText(link).catch(() => undefined);
      navigate(`/app/games/${created.id}?created=1`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create game');
    } finally {
      setBusy(false);
    }
  }

  if (!catalog) return <p className="text-ink-500">Loading question catalog…</p>;

  return (
    <form className="space-y-8" onSubmit={onSubmit}>
      <section className="db-dark-panel rounded-[2rem] p-8">
        <h1 className="db-display text-4xl">Compose a discovery</h1>
        <p className="mt-3 max-w-2xl text-ink-300">
          Edit any prompt, delete ones you don’t want, or write your own. Recipients answer in their own words.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="db-glass block rounded-[1.5rem] p-5 text-sm font-semibold">
          Game name
          <input className="db-input mt-2" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="db-glass block rounded-[1.5rem] p-5 text-sm font-semibold">
          Link expires in (days)
          <input
            className="db-input mt-2"
            type="number"
            min={1}
            max={90}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Number(e.target.value))}
          />
        </label>
        <label className="db-glass block rounded-[1.5rem] p-5 text-sm font-semibold md:col-span-2">
          Welcome note for recipients
          <textarea className="db-input mt-2 min-h-24" value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
      </section>

      <section className="flex flex-wrap gap-3 text-sm">
        <span className="db-chip">About Me · {counts.about}</span>
        <span className="db-chip">How I See You · {counts.see}</span>
        <button type="button" className="db-btn db-btn-ghost !py-2 !text-sm" onClick={() => addBlank('ABOUT_ME')}>
          Add About Me question
        </button>
        <button type="button" className="db-btn db-btn-ghost !py-2 !text-sm" onClick={() => addBlank('HOW_I_SEE_YOU')}>
          Add How I See You question
        </button>
      </section>

      <section className="space-y-3">
        {drafts.map((draft) => (
          <div key={draft.key} className="db-glass rounded-[1.5rem] p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-honey-700">
                {draft.round === 'ABOUT_ME' ? 'Round 1 · About them' : 'Round 2 · How they see you'}
              </p>
              <button type="button" className="text-sm font-semibold text-ink-500" onClick={() => removeDraft(draft.key)}>
                Remove
              </button>
            </div>
            <textarea
              id={`question-${draft.key}`}
              className="db-input min-h-20"
              value={draft.prompt}
              onChange={(e) => updatePrompt(draft.key, e.target.value)}
              placeholder="Write the question"
            />
          </div>
        ))}
      </section>

      <section className="space-y-5">
        {catalog.categories.map((cat) => (
          <div key={cat.id} className="db-glass rounded-[1.75rem] p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-honey-700">
              {cat.round === 'ABOUT_ME' ? 'Round 1 ideas' : 'Round 2 ideas'}
            </p>
            <h2 className="db-display text-2xl">{cat.name}</h2>
            <div className="mt-4 grid gap-2">
              {cat.questions.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => addSuggestion(q.id, q.prompt, cat.round)}
                  className="rounded-2xl border border-ink-900/10 bg-white/60 px-4 py-3 text-left hover:border-honey-400"
                >
                  {q.prompt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {error && <p className="text-red-700">{error}</p>}
      <button className="db-btn db-btn-primary" disabled={busy || counts.about < 1 || counts.see < 1}>
        {busy ? 'Creating…' : 'Generate invitation link'}
      </button>
    </form>
  );
}
