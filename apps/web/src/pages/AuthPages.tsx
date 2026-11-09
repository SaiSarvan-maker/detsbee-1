import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { SiteHeader } from '../components/layout/SiteHeader';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div>
      <SiteHeader />
      <div className="db-shell grid min-h-[70vh] place-items-center py-12">
        <div className="db-glass w-full max-w-md rounded-[2rem] p-8">
          <h1 className="db-display text-3xl">{title}</h1>
          <p className="mt-2 text-ink-600">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('demo@detsbee.app');
  const [password, setPassword] = useState('honeycomb123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/app" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate('/app');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Welcome back" subtitle="Sign in to your Detsbee hive.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm font-semibold">
          Email
          <input
            className="db-input mt-1"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="block text-sm font-semibold">
          Password
          <input
            className="db-input mt-1"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className="db-btn db-btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-4 text-sm text-ink-600">
        New here? <Link to="/register" className="font-semibold text-honey-700">Create an account</Link>
      </p>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const { user, register, loading } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/app" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register({ displayName, email, password, phone: phone || undefined });
      navigate('/app');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to register');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Create your hive" subtitle="Creators register once. Respondents never need an account.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm font-semibold">
          Display name
          <input
            className="db-input mt-1"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            minLength={2}
          />
        </label>
        <label className="block text-sm font-semibold">
          Email
          <input
            className="db-input mt-1"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-semibold">
          Password
          <input
            className="db-input mt-1"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <label className="block text-sm font-semibold">
          Phone <span className="font-normal text-ink-500">(optional)</span>
          <input
            className="db-input mt-1"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className="db-btn db-btn-primary w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-sm text-ink-600">
        Already have an account? <Link to="/login" className="font-semibold text-honey-700">Sign in</Link>
      </p>
    </AuthFrame>
  );
}
