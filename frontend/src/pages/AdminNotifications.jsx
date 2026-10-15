import { useState } from 'react';
import { getNotifications } from '../api/salon.js';
import { useApi } from '../hooks/useApi.js';
import Loading from '../components/Loading.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { Field, PrimaryButton, SecondaryButton, SelectInput, TextInput } from '../components/Fields.jsx';

const TYPE_LABELS = {
  booking_confirmation: 'Booking confirmation',
  reminder_24h: '24h reminder',
  cancellation: 'Cancellation notice',
  reschedule: 'Reschedule notice',
};

export default function AdminNotifications() {
  const [filters, setFilters] = useState({ booking_id: '', status: '' });
  const [applied, setApplied] = useState({});
  const { data, loading, error, refetch } = useApi(
    () => getNotifications(Object.fromEntries(Object.entries(applied).filter(([, v]) => v))),
    [applied]
  );

  const notifications = data?.notifications || [];

  const apply = (e) => {
    e.preventDefault();
    setApplied({ ...filters });
  };
  const clear = () => {
    setFilters({ booking_id: '', status: '' });
    setApplied({});
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
      <p className="mt-1 text-sm text-slate-500">
        Every confirmation, reminder and cancellation the system has sent or queued.
      </p>

      <form onSubmit={apply} className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <Field label="Booking ID">
          <TextInput
            type="number"
            value={filters.booking_id}
            onChange={(e) => setFilters((f) => ({ ...f, booking_id: e.target.value }))}
            placeholder="e.g. 12"
            className="w-40"
          />
        </Field>
        <Field label="Status">
          <SelectInput value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">All</option>
            <option value="queued">Queued</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </SelectInput>
        </Field>
        <PrimaryButton type="submit">Filter</PrimaryButton>
        <SecondaryButton type="button" onClick={clear}>Clear</SecondaryButton>
      </form>

      <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
        {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={refetch} /> : notifications.length === 0 ? (
          <div className="p-6"><EmptyState title="No notifications" hint="None match the current filters." /></div>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                <th className="px-5 py-3 font-semibold">Type</th>
                <th className="px-5 py-3 font-semibold">Channel</th>
                <th className="px-5 py-3 font-semibold">Booking</th>
                <th className="px-5 py-3 font-semibold">Scheduled for</th>
                <th className="px-5 py-3 font-semibold">Sent at</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {notifications.map((n) => (
                <tr key={n.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5 font-medium text-slate-800">{TYPE_LABELS[n.type] || n.type}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-600">
                      {n.channel}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-500">#{n.booking_id}</td>
                  <td className="px-5 py-3.5 text-slate-600">{new Date(n.scheduled_for).toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-slate-600">{n.sent_at ? new Date(n.sent_at).toLocaleString() : '—'}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={n.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
