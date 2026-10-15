import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getSalon } from '../api/salon.js';
import { useApi } from '../hooks/useApi.js';

/** Salon-branded public shell: header, outlet, footer. */
export default function PublicLayout() {
  const { user, logout } = useAuth();
  const { data } = useApi(getSalon, []);
  const salon = data?.salon;

  const navClass = ({ isActive }) =>
    `rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-rose-100 text-rose-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="flex min-h-screen flex-col bg-rose-50/40">
      <header className="sticky top-0 z-40 border-b border-rose-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-indigo-600 text-lg font-bold text-white">
              G
            </span>
            <span className="text-lg font-bold text-slate-900">
              {salon?.name || 'Glow & Grace'} <span className="font-light text-rose-600">Salon</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Services
            </NavLink>
            <NavLink to="/manage" className={navClass}>
              Manage booking
            </NavLink>
            {user ? (
              <>
                <Link
                  to={user.role === 'admin' ? '/admin' : user.role === 'staff' ? '/staff/schedule' : '/my-bookings'}
                  className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  My account
                </Link>
                <button
                  onClick={logout}
                  className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navClass}>
                  Sign in
                </NavLink>
                <Link
                  to="/register"
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-rose-100 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
          <div>
            <p className="text-lg font-bold text-slate-900">
              {salon?.name || 'Glow & Grace'} <span className="font-light text-rose-600">Salon</span>
            </p>
            <p className="mt-2 text-sm text-slate-500">{salon?.address}</p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">Opening hours</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-500">
              {(salon?.opening_hours || []).map((h) => (
                <li key={h.day} className="flex justify-between gap-4">
                  <span>{h.day}</span>
                  <span>{h.open ? `${h.open} – ${h.close}` : 'Closed'}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">Contact</p>
            <p className="mt-2 text-sm text-slate-500">{salon?.phone}</p>
            <p className="text-sm text-slate-500">{salon?.email}</p>
            <Link to="/manage" className="mt-3 inline-block text-sm font-semibold text-rose-600 hover:text-rose-700">
              Manage an existing booking →
            </Link>
          </div>
        </div>
        <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} {salon?.name || 'Glow & Grace Salon'}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
