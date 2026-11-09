import { Link, NavLink, Outlet } from 'react-router-dom';
import { BrandMark } from '../ui/BrandMark';
import { useAuth } from '../../lib/auth';

const links = [
  { to: '/app', label: 'Dashboard', end: true },
  { to: '/app/create', label: 'New discovery' },
  { to: '/app/profile', label: 'Profile' },
];

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-900/5 bg-cream-soft/80 backdrop-blur-xl">
        <div className="db-shell flex flex-wrap items-center justify-between gap-4 py-4">
          <Link to="/">
            <BrandMark />
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm font-semibold">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-full px-3 py-2 ${isActive ? 'bg-ink-900 text-cream' : 'text-ink-600 hover:text-ink-900'}`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <button className="db-btn db-btn-ghost !py-2 !text-sm" onClick={() => void logout()}>
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="db-shell py-8">
        <p className="mb-6 text-sm text-ink-500">
          Signed in as <span className="font-semibold text-ink-800">{user?.displayName}</span>
        </p>
        <Outlet />
      </main>
    </div>
  );
}
