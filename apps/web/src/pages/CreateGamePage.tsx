import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

type Round = 'ABOUT_ME' | 'HOW_I_SEE_YOU';

type Catalog = {
  categories: Array<{
    id: string;
    name: string;
    description: string;
    round: Round;
    questions: Array<{ id: string; prompt: string }>;
  }>;
};

type Draft = {
  key: string;
  sourceId?: string;
  prompt: string;
  round: Round;
};

export function CreateGamePage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [title, setTitle] = useState('Little things discovery');
  const [message, setMessage] = useState('Answer only what feels comfortable. Write in your own words, or skip.');
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Catalog>('/api/games/catalog').then((data) => {
      setCatalog(data);
      const next: Draft[] = [];
      for (const cat of data.categories) {
        for (const q of cat.questions.slice(0, 3)) {
          next.push({ key: q.id, sourceId: q.id, prompt: q.prompt, round: cat.round });
        }
      }
      setDrafts(next);
    });
  }, []);

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
    setDrafts((prev) => [...prev, { key: crypto.randomUUID(), prompt: '', round }]);
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
