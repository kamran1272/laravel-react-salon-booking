import { useState } from 'react';
import { getCustomers, getCustomer, updateCustomerNotes } from '../api/salon.js';
import { useApi, apiErrorMessage } from '../hooks/useApi.js';
import { formatMoney } from '../utils/format.js';
import Loading from '../components/Loading.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { Field, PrimaryButton, TextArea, TextInput } from '../components/Fields.jsx';

function CustomerDrawer({ customerId, onClose }) {
  const { data, loading, error, refetch } = useApi(() => getCustomer(customerId), [customerId]);
  const [notes, setNotes] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const customer = data?.customer;
  const bookings = data?.bookings || [];
  const stats = data?.stats;

  const saveNotes = async () => {
    setSaving(true);
    setNotice('');
    try {
      await updateCustomerNotes(customerId, notes ?? customer.notes ?? '');
      setNotice('Notes saved.');
      refetch();
    } catch (err) {
      setNotice(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Customer</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? <Loading label="Loading customer…" /> : error ? <ErrorState error={error} onRetry={refetch} /> : customer && (
            <>
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-indigo-500 text-xl font-bold text-white">
                  {customer.name.charAt(0)}
                </span>
                <div>
                  <p className="text-lg font-bold text-slate-900">{customer.name}</p>
                  <p className="text-sm text-slate-500">{customer.email} · {customer.phone}</p>
                  <p className="text-xs text-slate-400">Customer since {new Date(customer.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Bookings', stats?.total_bookings ?? bookings.length],
                  ['Completed', stats?.completed ?? '—'],
                  ['No-shows', customer.no_show_count],
                  ['Cancelled', customer.cancellation_count],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-xl font-bold text-slate-900">{v}</p>
                    <p className="text-[11px] uppercase text-slate-500">{k}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl bg-emerald-50 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-800">{formatMoney(customer.total_spend_cents)}</p>
                <p className="text-[11px] uppercase text-emerald-600">Lifetime spend</p>
              </div>

              <div className="mt-5">
                <Field label="Notes">
                  <TextArea
                    value={notes ?? customer.notes ?? ''}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Preferences, allergies, history…"
                  />
                </Field>
                {notice && <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">{notice}</p>}
                <PrimaryButton onClick={saveNotes} disabled={saving} className="mt-2">
                  {saving ? 'Saving…' : 'Save notes'}
                </PrimaryButton>
              </div>

              <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Booking history ({bookings.length})
              </h3>
              <ul className="mt-2 space-y-2">
                {bookings.map((b) => (
                  <li key={b.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{b.service?.name}</p>
                      <p className="text-xs text-slate-500">{b.date_label} · {b.time_label} with {b.staff?.name}</p>
                    </div>
                    <StatusBadge status={b.status} />
                  </li>
                ))}
                {bookings.length === 0 && <p className="text-sm text-slate-400">No bookings yet.</p>}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminCustomers() {
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const { data, loading, error, refetch } = useApi(() => getCustomers(applied), [applied]);
  const [openId, setOpenId] = useState(null);

  const customers = data?.customers || [];

  const submit = (e) => {
    e.preventDefault();
    setApplied(search.trim());
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Customers</h1>

      <form onSubmit={submit} className="mt-6 flex gap-3">
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or phone…"
          className="max-w-md"
          aria-label="Search customers"
        />
        <PrimaryButton type="submit">Search</PrimaryButton>
      </form>

      <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
        {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={refetch} /> : customers.length === 0 ? (
          <div className="p-6"><EmptyState title="No customers found" hint="Try a different search." /></div>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold">Contact</th>
                <th className="px-5 py-3 font-semibold">Bookings</th>
                <th className="px-5 py-3 font-semibold">No-shows</th>
                <th className="px-5 py-3 font-semibold">Spend</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {customers.map((c) => (
                <tr key={c.id} className="cursor-pointer hover:bg-slate-50/60" onClick={() => setOpenId(c.id)}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-700">
                        {c.name.charAt(0)}
                      </span>
                      <span className="font-semibold text-slate-900">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    <p className="text-xs">{c.email}</p>
                    <p className="text-xs text-slate-400">{c.phone}</p>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{c.total_bookings}</td>
                  <td className="px-5 py-3.5">
                    {c.no_show_count > 0
                      ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{c.no_show_count}</span>
                      : <span className="text-slate-400">0</span>}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-slate-900">{formatMoney(c.total_spend_cents)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm font-medium text-indigo-600">View →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openId && <CustomerDrawer customerId={openId} onClose={() => { setOpenId(null); refetch(); }} />}
    </div>
  );
}
