import { useEffect, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatCard from '../components/StatCard.jsx';
import UsersTable from '../components/UsersTable.jsx';

const usersIcon = (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const newUsersIcon = (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
  </svg>
);

const shieldIcon = (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const keyIcon = (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a3 3 0 11-3-3m0 3a3 3 0 01-3-3m3 3v1m0 0l5 5m-5-5l-5 5m5-5v4m0 0h4m-4 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [stats, setStats] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [statsRes, usersRes] = await Promise.all([
          client.get('/dashboard/stats'),
          isAdmin ? client.get('/users', { params: { per_page: 5 } }) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setStats(statsRes.data);
        if (usersRes) setRecentUsers(usersRes.data.data ?? []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load dashboard data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-rose-50 px-6 py-4 text-sm text-rose-700">{error}</div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-slate-900">Welcome back, {user?.name}</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={stats?.total_users ?? 0} icon={usersIcon} accent="indigo" />
        <StatCard label="New This Week" value={stats?.new_users_this_week ?? 0} icon={newUsersIcon} accent="emerald" />
        <StatCard label="Admins" value={stats?.admins_count ?? 0} icon={shieldIcon} accent="amber" />
        <StatCard label="Active API Tokens" value={stats?.active_tokens ?? 0} icon={keyIcon} accent="rose" />
      </div>

      {isAdmin ? (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Recent users</h3>
          {recentUsers.length > 0 ? (
            <UsersTable users={recentUsers} onEdit={() => {}} onDelete={() => {}} />
          ) : (
            <div className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm">
              No users yet.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Getting started</h3>
          <ol className="mt-4 space-y-3 text-sm text-slate-600">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">1</span>
              Complete your profile details so your team can recognize you.
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">2</span>
              Explore the dashboard metrics to understand your workspace activity.
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">3</span>
              Contact an administrator if you need access to additional features.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
