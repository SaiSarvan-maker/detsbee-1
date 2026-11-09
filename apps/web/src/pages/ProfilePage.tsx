import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ displayName, phone }),
      });
      await refresh();
      setMessage('Profile updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Update failed');
    }
  }

  return (
    <form className="db-glass max-w-lg space-y-4 rounded-[1.75rem] p-6" onSubmit={onSubmit}>
      <h1 className="db-display text-3xl">Profile</h1>
      <p className="text-sm text-ink-600">{user?.email}</p>
      <label className="block text-sm font-semibold">
        Display name
        <input className="db-input mt-1" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </label>
      <label className="block text-sm font-semibold">
        Phone (optional)
        <input className="db-input mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      {message && <p className="text-sm text-honey-700">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="db-btn db-btn-primary">Save</button>
    </form>
  );
}
