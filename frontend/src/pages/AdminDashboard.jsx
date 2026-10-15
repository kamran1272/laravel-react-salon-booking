import { getDashboard, confirmBooking, completeBooking, markNoShow, cancelBookingAsStaff } from '../api/salon.js';
import { useApi, apiErrorMessage } from '../hooks/useApi.js';
import StatCard from '../components/StatCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Loading from '../components/Loading.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { formatMoney } from '../utils/format.js';
import { useState } from 'react';

const icons = {
  calendar: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  money: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  users: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  alert: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

function QuickActions({ booking, onDone }) {
  const [working, setWorking] = useState(false);
  const run = async (fn) => {
    setWorking(true);
    try {
      await fn(booking.id);
      onDone();
    } catch (err) {
      alert(apiErrorMessage(err));
    } finally {
      setWorking(false);
    }
  };
  const terminal = ['completed', 'cancelled', 'no_show'].includes(booking.status);
  if (terminal) return null;
  return (
    <div className="flex gap-1.5">
      {booking.status === 'booked' && (
        <button disabled={working} onClick={() => run(confirmBooking)} className="rounded-md bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-200 disabled:opacity-50">Confirm</button>
      )}
      <button disabled={working} onClick={() => run(completeBooking)} className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-50">Done</button>
      <button disabled={working} onClick={() => run(markNoShow)} className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200 disabled:opacity-50">No-show</button>
      <button disabled={working} onClick={() => { if (window.confirm('Cancel this booking?')) run(cancelBookingAsStaff); }} className="rounded-md bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200 disabled:opacity-50">Cancel</button>
    </div>
  );
}

export default function AdminDashboard() {
  const { data, loading, error, refetch } = useApi(getDashboard, []);

  if (loading) return <Loading label="Loading dashboard…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { today, upcoming_7d, revenue, customers, no_show_rate, staff_occupancy } = data;

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's bookings" value={today.count} icon={icons.calendar} accent="indigo" />
        <StatCard label="Upcoming (7 days)" value={upcoming_7d.count} icon={icons.calendar} accent="emerald" />
        <StatCard label="Revenue today" value={formatMoney(revenue.today_cents)} icon={icons.money} accent="emerald" />
        <StatCard label="Revenue this month" value={formatMoney(revenue.month_cents)} icon={icons.money} accent="amber" />
        <StatCard label="Revenue (7 days)" value={formatMoney(revenue.week_cents)} icon={icons.money} accent="indigo" />
        <StatCard label="Expected (7 days)" value={formatMoney(upcoming_7d.expected_revenue_cents)} icon={icons.money} accent="rose" />
        <StatCard label="New / returning (30d)" value={`${customers.new_count} / ${customers.returning_count}`} icon={icons.users} accent="indigo" />
        <StatCard label="No-show rate" value={`${no_show_rate}%`} icon={icons.alert} accent="rose" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm xl:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Today&apos;s bookings</h2>
          {today.bookings.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nothing booked today.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {today.bookings.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {b.time_label} · {b.service?.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {b.customer?.name} with {b.staff?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={b.status} />
                    <QuickActions booking={b} onDone={refetch} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Staff occupancy today</h2>
          <div className="mt-4 space-y-4">
            {staff_occupancy.map((s) => (
              <div key={s.staff_id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{s.name}</span>
                  <span className="text-xs text-slate-500">{s.occupancy_pct}%</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-indigo-500"
                    style={{ width: `${Math.min(100, s.occupancy_pct)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {Math.round(s.booked_minutes)} of {s.available_minutes} min booked
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
