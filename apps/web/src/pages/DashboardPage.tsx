import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

type Dashboard = {
  stats: { activeGames: number; totalResponses: number; pendingGames: number };
  games: Array<{
    id: string;
    title: string;
    status: string;
    expiresAt?: string;
    completedResponses: number;
    createdAt: string;
  }>;
  activities: Array<{ id: string; message: string; createdAt: string }>;
};

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Dashboard>('/api/games/dashboard')
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load dashboard'));
  }, []);

  if (error) {
    return <p className="text-red-700">{error}</p>;
  }

  if (!data) {
    return <p className="text-ink-500">Gathering your hive…</p>;
  }

  return (
    <div className="space-y-8">
      <section className="db-dark-panel rounded-[2rem] p-8">
        <p className="text-sm uppercase tracking-[0.18em] text-honey-300">Your hive</p>
        <h1 className="db-display mt-2 text-4xl">Welcome back, {user?.displayName}</h1>
        <p className="mt-3 max-w-xl text-ink-300">
          Active discoveries, shared perspectives, and the little things people chose to reveal.
        </p>
        <Link to="/app/create" className="db-btn db-btn-primary mt-6">
          <Plus size={18} /> New discovery
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Active games', value: data.stats.activeGames },
          { label: 'Completed responses', value: data.stats.totalResponses },
          { label: 'Paused / expired', value: data.stats.pendingGames },
        ].map((stat) => (
          <div key={stat.label} className="db-glass rounded-[1.5rem] p-5">
            <p className="text-sm text-ink-500">{stat.label}</p>
            <p className="db-display mt-2 text-4xl">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="db-glass rounded-[1.75rem] p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="db-display text-2xl">Discoveries</h2>
            <Link to="/app/create" className="text-sm font-semibold text-honey-700">
              Create
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {data.games.length === 0 && (
              <p className="rounded-2xl bg-white/70 p-4 text-ink-600">
                No discoveries yet. Create one and share a honeycomb link.
              </p>
            )}
            {data.games.map((game) => (
              <Link
                key={game.id}
                to={`/app/games/${game.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-4 py-4 transition hover:bg-white"
              >
                <div>
                  <p className="font-semibold text-ink-900">{game.title}</p>
                  <p className="text-sm text-ink-500">
                    {game.status} · {game.completedResponses} responses
                  </p>
                </div>
                <ArrowUpRight className="text-honey-600" size={18} />
              </Link>
            ))}
          </div>
        </div>

        <div className="db-glass rounded-[1.75rem] p-6">
          <h2 className="db-display text-2xl">Recent activity</h2>
          <div className="mt-4 space-y-3">
            {data.activities.length === 0 && (
              <p className="text-ink-600">Quiet hive for now.</p>
            )}
            {data.activities.map((item) => (
              <div key={item.id} className="rounded-2xl bg-white/70 px-4 py-3 text-sm text-ink-700">
                {item.message}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
