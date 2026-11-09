import { Link, NavLink } from 'react-router-dom';
import { BrandMark } from '../ui/BrandMark';
import { useAuth } from '../../lib/auth';

export function SiteHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-900/5 bg-cream-soft/80 backdrop-blur-xl">
      <div className="db-shell flex items-center justify-between py-4">
        <Link to="/" aria-label="Detsbee home">
          <BrandMark />
        </Link>
        <nav className="flex items-center gap-2 text-sm font-semibold text-ink-600">
          <a href="/#how" className="hidden rounded-full px-3 py-2 hover:text-ink-900 sm:inline">
            How it works
          </a>
          <a href="/#privacy" className="hidden rounded-full px-3 py-2 hover:text-ink-900 sm:inline">
            Privacy
          </a>
          {user ? (
            <>
              <NavLink to="/app" className="rounded-full px-3 py-2 hover:text-ink-900">
                Hive
              </NavLink>
              <button className="db-btn db-btn-ghost !py-2 !text-sm" onClick={() => void logout()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="rounded-full px-3 py-2 hover:text-ink-900">
                Sign in
              </NavLink>
              <NavLink to="/register" className="db-btn db-btn-primary !py-2 !text-sm">
                Start discovering
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
