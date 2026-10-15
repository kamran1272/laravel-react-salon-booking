import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const pageTitles = {
  '/my-bookings': 'My bookings',
  '/staff/schedule': 'Schedule',
  '/staff/shifts': 'My shifts',
  '/admin': 'Dashboard',
  '/admin/services': 'Services',
  '/admin/staff': 'Staff',
  '/admin/bookings': 'Bookings',
  '/admin/customers': 'Customers',
  '/admin/settings': 'Settings',
  '/admin/notifications': 'Notifications',
};

function sectionLabel(text) {
  return (
    <p className="px-4 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{text}</p>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const role = user?.role;
  const isAdmin = role === 'admin';
  const isStaff = role === 'staff' || isAdmin;
  const title = pageTitles[location.pathname] || 'Salon';
  const initial = (user?.name || 'U').charAt(0).toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
      isActive ? 'bg-rose-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;

  const icon = (d) => (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col bg-slate-900">
        <div className="flex h-16 items-center border-b border-slate-800 px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-indigo-600 text-sm font-bold text-white">
              G
            </span>
            <span className="text-lg font-bold text-white">
              Glow <span className="font-light text-rose-400">&</span> Grace
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          {!isStaff && (
            <>
              {sectionLabel('Bookings')}
              <NavLink to="/my-bookings" className={linkClass}>
                {icon('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z')}
                My bookings
              </NavLink>
              <Link to="/" className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white">
                {icon('M12 4v16m8-8H4')}
                Book new appointment
              </Link>
            </>
          )}

          {isStaff && !isAdmin && (
            <>
              {sectionLabel('Work')}
              <NavLink to="/staff/schedule" className={linkClass}>
                {icon('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z')}
                Schedule
              </NavLink>
              <NavLink to="/staff/shifts" className={linkClass}>
                {icon('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z')}
                My shifts
              </NavLink>
            </>
          )}

          {isAdmin && (
            <>
              {sectionLabel('Manage')}
              <NavLink to="/admin" end className={linkClass}>
                {icon('M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6')}
                Dashboard
              </NavLink>
              <NavLink to="/admin/bookings" className={linkClass}>
                {icon('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z')}
                Bookings
              </NavLink>
              <NavLink to="/admin/services" className={linkClass}>
                {icon('M7 7h.01M7 3h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z')}
                Services
              </NavLink>
              <NavLink to="/admin/staff" className={linkClass}>
                {icon('M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z')}
                Staff
              </NavLink>
              <NavLink to="/admin/customers" className={linkClass}>
                {icon('M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z')}
                Customers
              </NavLink>
              {sectionLabel('System')}
              <NavLink to="/staff/schedule" className={linkClass}>
                {icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2')}
                All schedules
              </NavLink>
              <NavLink to="/admin/notifications" className={linkClass}>
                {icon('M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9')}
                Notifications
              </NavLink>
              <NavLink to="/admin/settings" className={linkClass}>
                {icon('M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z')}
                Settings
              </NavLink>
            </>
          )}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-600 text-sm font-bold text-white">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.name}</p>
              <span className="mt-0.5 inline-block rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium capitalize text-rose-300">
                {user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-4 w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <h1 className="truncate text-lg font-semibold text-slate-900">{title}</h1>
          <Link to="/" className="text-sm font-medium text-rose-600 hover:text-rose-700">
            ← Back to salon site
          </Link>
        </header>
        <main className="flex-1 p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
