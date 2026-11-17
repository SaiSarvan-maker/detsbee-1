import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { SiteHeader } from '../components/layout/SiteHeader';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

function PasswordField({
  label,
  className,
  ...inputProps
}: { label: string } & ComponentPropsWithoutRef<'input'>) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block text-sm font-semibold">
      {label}
      <span className="relative mt-1 block">
        <input
          {...inputProps}
          className={`db-input pr-16 ${className || ''}`}
          type={visible ? 'text' : 'password'}
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-honey-700 hover:bg-honey-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-honey-600"
          onClick={() => setVisible((current) => !current)}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </span>
    </label>
  );
}

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/app" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNeedsVerification(false);
    try {
      await login(email, password);
      navigate('/app');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in');
      setNeedsVerification(err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED');
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
        <PasswordField
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <p className="-mt-2 text-right text-sm">
          <Link to={`/forgot-password?email=${encodeURIComponent(email)}`} className="font-semibold text-honey-700">
            Forgot password?
          </Link>
        </p>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {needsVerification && (
          <Link to={`/verify-email?email=${encodeURIComponent(email)}`} className="block text-sm font-semibold text-honey-700 underline">
            Resend the verification email
          </Link>
        )}
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
      const result = await register({ displayName, email, password, phone: phone || undefined });
      if (result.developmentVerificationUrl) {
        const verificationUrl = new URL(result.developmentVerificationUrl);
        navigate(`${verificationUrl.pathname}${verificationUrl.search}`);
      } else {
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
      }
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
        <PasswordField
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
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

export function EmailVerificationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [status, setStatus] = useState(token ? 'checking' : 'pending');
  const [message, setMessage] = useState('');
  const [developmentVerificationUrl, setDevelopmentVerificationUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const verificationStarted = useRef(false);

  useEffect(() => {
    if (!token || verificationStarted.current) return;
    verificationStarted.current = true;
    void api('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => setStatus('verified'))
      .catch((err: unknown) => {
        setStatus('invalid');
        setError(err instanceof ApiError ? err.message : 'Unable to verify this email');
      });
  }, [token]);

  async function resend(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    setDevelopmentVerificationUrl('');
    try {
      const result = await api<{ message: string; developmentVerificationUrl?: string }>(
        '/api/auth/request-verification',
        { method: 'POST', body: JSON.stringify({ email }) },
      );
      setMessage(result.message);
      setDevelopmentVerificationUrl(result.developmentVerificationUrl || '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not request a verification email');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title={status === 'verified' ? 'Email verified' : 'Verify your email'}
      subtitle={status === 'verified' ? 'Your Detsbee account is ready.' : 'Check your inbox for a one-time link. Verification links expire after 24 hours.'}
    >
      {status === 'verified' ? (
        <Link to="/login" className="db-btn db-btn-primary w-full">Continue to sign in</Link>
      ) : status === 'checking' ? (
        <p role="status" className="text-sm text-ink-600">Verifying your email…</p>
      ) : (
        <form className="space-y-4" onSubmit={resend}>
          {status === 'invalid' && error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <label className="block text-sm font-semibold">
            Email
            <input
              className="db-input mt-1"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>
          {error && status !== 'invalid' && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {message && <p role="status" className="text-sm text-green-800">{message}</p>}
          {developmentVerificationUrl && (
            <p className="break-all text-sm">
              Development verification link: <Link className="font-semibold text-honey-700 underline" to={developmentVerificationUrl.replace(/^https?:\/\/[^/]+/, '')}>Verify email</Link>
            </p>
          )}
          <button className="db-btn db-btn-primary w-full" disabled={busy}>
            {busy ? 'Sending…' : 'Resend verification email'}
          </button>
        </form>
      )}
      <p className="mt-4 text-sm text-ink-600">
        Already verified? <Link to="/login" className="font-semibold text-honey-700">Sign in</Link>
      </p>
    </AuthFrame>
  );
}

export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [message, setMessage] = useState('');
  const [developmentResetUrl, setDevelopmentResetUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    setDevelopmentResetUrl('');
    try {
      const result = await api<{ message: string; developmentResetUrl?: string }>(
        '/api/auth/forgot-password',
        { method: 'POST', body: JSON.stringify({ email }) },
      );
      setMessage(result.message);
      setDevelopmentResetUrl(result.developmentResetUrl || '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not request a password reset');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Reset your password" subtitle="We’ll email a secure, short-lived reset link if this address has an account.">
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
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="text-sm text-green-800">{message}</p>}
        {developmentResetUrl && (
          <p className="break-all text-sm">
            Development reset link: <a className="font-semibold text-honey-700 underline" href={developmentResetUrl}>Open reset page</a>
          </p>
        )}
        <button className="db-btn db-btn-primary w-full" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-4 text-sm text-ink-600">
        Remembered it? <Link to="/login" className="font-semibold text-honey-700">Sign in</Link>
      </p>
    </AuthFrame>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setComplete(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Choose a new password" subtitle="Reset links expire after 30 minutes and can only be used once.">
      {complete ? (
        <div className="space-y-4">
          <p role="status" className="text-sm text-green-800">Your password has been updated. You can now sign in.</p>
          <Link to="/login" className="db-btn db-btn-primary w-full">Go to sign in</Link>
        </div>
      ) : !token ? (
        <div className="space-y-4">
          <p role="alert" className="text-sm text-red-700">This password reset link is missing or invalid.</p>
          <Link to="/forgot-password" className="font-semibold text-honey-700">Request another link</Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <PasswordField
            label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
          />
          <p className="text-xs text-ink-500">Use at least 8 characters.</p>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button className="db-btn db-btn-primary w-full" disabled={busy}>
            {busy ? 'Updating…' : 'Set new password'}
          </button>
        </form>
      )}
    </AuthFrame>
  );
}
