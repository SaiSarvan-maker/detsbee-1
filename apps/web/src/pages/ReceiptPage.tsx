import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BrandMark } from '../components/ui/BrandMark';
import { api, ApiError } from '../lib/api';

type Receipt = {
  creatorName: string;
  title: string;
  submittedAt?: string;
  retentionDays: number;
  expiresAt?: string;
  answers: Array<{
    prompt: string;
    round: string;
    category: string;
    visibility: string;
    value: unknown;
  }>;
};

export function ReceiptPage() {
  const { token = '' } = useParams();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    api<Receipt>(`/api/play/receipt/${token}`)
      .then(setReceipt)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Receipt unavailable'));
  }, [token]);

  async function remove() {
    if (!confirm('Delete your submission permanently?')) return;
    try {
      await api(`/api/play/receipt/${token}`, { method: 'DELETE' });
      setDeleted(true);
      setReceipt(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Deletion failed');
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 text-cream">
      <div className="mx-auto max-w-lg px-4 py-8">
        <BrandMark light />
        {deleted && (
          <div className="mt-8 space-y-4">
            <h1 className="db-display text-4xl">Submission deleted</h1>
            <p className="text-ink-300">Your answers were removed from Detsbee.</p>
            <Link to="/" className="db-btn db-btn-primary inline-flex">
              Home
            </Link>
          </div>
        )}
        {error && !deleted && (
          <div className="mt-8">
            <h1 className="db-display text-3xl">Receipt unavailable</h1>
            <p className="mt-3 text-ink-300">{error}</p>
          </div>
        )}
        {receipt && (
          <div className="mt-8 space-y-6">
            <div>
              <p className="text-sm uppercase tracking-[0.16em] text-honey-300">Private receipt</p>
              <h1 className="db-display mt-2 text-4xl">{receipt.title}</h1>
              <p className="mt-2 text-ink-300">
                For your eyes. Shared answers were sent to {receipt.creatorName}. Private ones stayed here.
              </p>
              <p className="mt-2 text-sm text-ink-400">
                Kept ~{receipt.retentionDays} days
                {receipt.expiresAt ? ` · expires ${new Date(receipt.expiresAt).toLocaleDateString()}` : ''}
              </p>
            </div>
            <div className="space-y-3">
              {receipt.answers.map((a, i) => (
                <article key={i} className="rounded-2xl bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-wider text-honey-300">{a.visibility}</p>
                    <p className="text-xs text-ink-400">{a.round}</p>
                  </div>
                  <p className="mt-2 font-semibold">{a.prompt}</p>
                  <p className="mt-1 text-ink-300">
                    {a.visibility === 'SHARE' || a.visibility === 'PRIVATE'
                      ? Array.isArray(a.value)
                        ? a.value.join(', ')
                        : String(a.value)
                      : '—'}
                  </p>
                </article>
              ))}
            </div>
            <button className="db-btn db-btn-ghost !border-white/20 !text-cream" onClick={() => void remove()}>
              Request deletion
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
