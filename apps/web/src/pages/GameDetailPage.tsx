import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Copy, Link2Off, RefreshCw, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';

type GameDetail = {
  id: string;
  title: string;
  message?: string;
  status: string;
  expiresAt?: string;
  inviteHint: string;
  respondents: Array<{ id: string; displayName: string; submittedAt?: string }>;
  questions: Array<{ id: string; prompt: string; round: string; category: string }>;
};

type Answer = { responseId: string; prompt: string; value: string; category: string };
type Results = {
  people: Array<{
    id: string;
    displayName: string;
    aboutMe: Answer[];
    howISeeYou: Answer[];
  }>;
  sharedGround: string[];
  insight: string;
  respondents: Array<{ id: string; displayName: string; sharedCount: number }>;
};

export function GameDetailPage() {
  const { gameId = '' } = useParams();
  const [params] = useSearchParams();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [message, setMessage] = useState(
    params.get('created') ? 'Discovery created. Invitation link copied when available.' : '',
  );
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'about' | 'see' | 'ground'>('about');
  const [personId, setPersonId] = useState('');

  async function load() {
    const [g, r] = await Promise.all([
      api<GameDetail>(`/api/games/${gameId}`),
      api<Results>(`/api/games/${gameId}/results`),
    ]);
    setGame(g);
    setResults(r);
    setPersonId((current) => current || r.people[0]?.id || '');
    if (g.inviteHint === 'used') {
      sessionStorage.removeItem(`detsbee_invite_${gameId}`);
      setInviteUrl('');
      setMessage('This one-time link has been used. Rotate it to create a fresh invitation.');
    }
  }

  useEffect(() => {
    const cached = sessionStorage.getItem(`detsbee_invite_${gameId}`);
    if (cached) {
      setInviteUrl(cached);
      setMessage('Discovery ready. Copy your invitation link below — it is shown only while available in this browser session.');
    }
    load().catch((err) => setError(err.message || 'Failed to load game'));
  }, [gameId]);

  async function copyCachedOrRotate(forceRotate = false) {
    try {
      const cached = sessionStorage.getItem(`detsbee_invite_${gameId}`);
      if (cached && !forceRotate && game?.inviteHint !== 'used') {
        setInviteUrl(cached);
        await navigator.clipboard?.writeText(cached).catch(() => undefined);
        setMessage('Invitation link copied.');
        return;
      }
      const data = await api<{ inviteUrl: string }>(`/api/games/${gameId}/rotate-link`, {
        method: 'POST',
      });
      sessionStorage.setItem(`detsbee_invite_${gameId}`, data.inviteUrl);
      setInviteUrl(data.inviteUrl);
      await navigator.clipboard?.writeText(data.inviteUrl).catch(() => undefined);
      setMessage(
        forceRotate || game?.inviteHint === 'used'
          ? 'Fresh one-time invitation link copied. Older links no longer work.'
          : 'Invitation link copied.',
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not prepare link');
    }
  }

  async function toggleEnabled() {
    if (!game) return;
    const path = game.status === 'ACTIVE' ? 'disable' : 'enable';
    await api(`/api/games/${gameId}/${path}`, { method: 'POST' });
    setMessage(path === 'disable' ? 'Invitation disabled.' : 'Invitation enabled.');
    await load();
  }

  async function removeGame() {
    if (!confirm('Delete this discovery and all associated responses?')) return;
    await api(`/api/games/${gameId}`, { method: 'DELETE' });
    window.location.href = '/app';
  }

  if (error) return <p className="text-red-700">{error}</p>;
  if (!game || !results) return <p className="text-ink-500">Opening results…</p>;

  return (
    <div className="space-y-8">
      <section className="db-dark-panel rounded-[2rem] p-8">
        <p className="text-sm uppercase tracking-[0.18em] text-honey-300">{game.status}</p>
        <h1 className="db-display mt-2 text-4xl">{game.title}</h1>
        <p className="mt-3 max-w-2xl text-ink-300">{game.message}</p>
        <p className="mt-2 text-sm text-ink-400">
          {game.inviteHint === 'used' ? 'This invitation link has already been used.' : `Link hint …${game.inviteHint}`}
          {game.expiresAt ? ` · expires ${new Date(game.expiresAt).toLocaleDateString()}` : ''}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="db-btn db-btn-primary" onClick={() => void copyCachedOrRotate(false)}>
            <Copy size={16} /> Copy invite link
          </button>
          <button className="db-btn db-btn-ghost !border-white/20 !text-cream" onClick={() => void copyCachedOrRotate(true)}>
            <RefreshCw size={16} /> Rotate link
          </button>
          <button
            className="db-btn db-btn-ghost !border-white/20 !text-cream"
            onClick={() => void toggleEnabled()}
            disabled={game.inviteHint === 'used'}
            title={game.inviteHint === 'used' ? 'Rotate the link to create a fresh one.' : undefined}
          >
            <Link2Off size={16} />
            {game.inviteHint === 'used' ? 'Used once' : game.status === 'ACTIVE' ? 'Disable link' : 'Enable link'}
          </button>
          <button className="db-btn db-btn-ghost !border-white/20 !text-cream" onClick={() => void removeGame()}>
            <Trash2 size={16} /> Delete
          </button>
          <Link to="/app" className="db-btn db-btn-ghost !border-white/20 !text-cream">
            Back to hive
          </Link>
        </div>
        {(message || inviteUrl) && (
          <p className="mt-4 rounded-2xl bg-white/5 px-4 py-3 text-sm text-honey-100">
            {message} {inviteUrl && (
              <button
                className="ml-2 inline-flex items-center gap-1 underline"
                onClick={() => void navigator.clipboard.writeText(inviteUrl)}
              >
                <Copy size={14} /> Copy again
              </button>
            )}
          </p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="db-glass rounded-[1.5rem] p-5">
          <p className="text-sm text-ink-500">Respondents</p>
          <p className="db-display mt-1 text-3xl">{results.respondents.length}</p>
        </div>
        <div className="db-glass rounded-[1.5rem] p-5 md:col-span-2">
          <p className="text-sm text-ink-500">Playful insight</p>
          <p className="mt-2 text-ink-800">{results.insight}</p>
        </div>
      </section>

      <section className="db-glass rounded-[1.75rem] p-6">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['about', 'About Me'],
              ['see', 'How I See You'],
              ['ground', 'Shared Ground'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                tab === key ? 'bg-ink-900 text-cream' : 'bg-white/70 text-ink-600'
              }`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {results.people.map((person) => (
            <button
              key={person.id}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                personId === person.id ? 'bg-honey-400 text-ink-950' : 'bg-white/70 text-ink-600'
              }`}
              onClick={() => setPersonId(person.id)}
              type="button"
            >
              {person.displayName}
            </button>
          ))}
        </div>

        {tab === 'about' && (
          <AnswerList items={results.people.find((p) => p.id === personId)?.aboutMe ?? []} />
        )}
        {tab === 'see' && (
          <AnswerList items={results.people.find((p) => p.id === personId)?.howISeeYou ?? []} />
        )}
        {tab === 'ground' && (
          <div className="mt-5 flex flex-wrap gap-2">
            {results.sharedGround.length === 0 && (
              <Empty text="Shared Ground shows matching About Me answers from multiple respondents. Matches ignore capitalization, punctuation, and extra spaces." />
            )}
            {results.sharedGround.map((item) => (
              <span key={item} className="rounded-2xl bg-honey-100 px-4 py-3 font-semibold text-honey-700">
                {item}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AnswerList({ items }: { items: Answer[] }) {
  if (items.length === 0) return <div className="mt-5"><Empty /></div>;
  return (
    <div className="mt-5 grid gap-3">
      {items.map((item) => (
        <article key={item.responseId} className="rounded-2xl bg-white/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-honey-700">{item.category}</p>
          <p className="mt-1 text-sm text-ink-500">{item.prompt}</p>
          <p className="mt-2 whitespace-pre-wrap text-lg font-semibold text-ink-900">{item.value}</p>
        </article>
      ))}
    </div>
  );
}

function Empty({ text = 'No shared answers here yet.' }: { text?: string }) {
  return <p className="rounded-2xl bg-white/70 p-4 text-ink-600">{text}</p>;
}
