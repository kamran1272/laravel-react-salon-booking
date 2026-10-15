import { useMemo, useState } from 'react';
import {
  getSchedule, getAdminStaff, getServices,
  confirmBooking, completeBooking, markNoShow, cancelBookingAsStaff, walkInBooking,
} from '../api/salon.js';
import { useApi, apiErrorMessage } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { addDaysYMD, dayShort, formatMoney, prettyDate, todayYMD } from '../utils/format.js';
import Loading from '../components/Loading.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';
import { Field, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput } from '../components/Fields.jsx';

const statusColor = {
  booked: 'border-l-sky-400',
  confirmed: 'border-l-indigo-500',
  completed: 'border-l-emerald-500',
  cancelled: 'border-l-slate-300',
  no_show: 'border-l-rose-500',
};

function ApptCard({ booking, onOpen }) {
  const terminal = ['completed', 'cancelled', 'no_show'].includes(booking.status);
  return (
    <button
      onClick={() => onOpen(booking)}
      className={`w-full rounded-xl border border-slate-200 border-l-4 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow ${statusColor[booking.status] || 'border-l-slate-200'} ${terminal ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{booking.time_label}</p>
          <p className="mt-0.5 text-sm font-medium text-slate-700">{booking.service?.name}</p>
          <p className="text-xs text-slate-500">
            {booking.guest_name ? `${booking.guest_name} (guest of ${booking.customer?.name})` : booking.customer?.name}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>
    </button>
  );
}

function AppointmentDrawer({ booking, onClose, onChanged, isAdmin }) {
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');

  if (!booking) return null;

  const run = async (fn, label) => {
    setWorking(true);
    setNotice('');
    try {
      const res = await fn(booking.id);
      onChanged(res.booking);
      setNotice(`${label} — saved.`);
    } catch (err) {
      setNotice(apiErrorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  const now = Date.now();
  const started = new Date(booking.starts_at).getTime() <= now;
  const terminal = ['completed', 'cancelled', 'no_show'].includes(booking.status);

  return (
    <Modal title={`${booking.time_label} — ${booking.service?.name}`} onClose={onClose}>
      <div className="flex items-center justify-between">
        <StatusBadge status={booking.status} />
        <span className="font-mono text-xs text-slate-400">{booking.reference_code}</span>
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="text-xs font-medium text-slate-500">Client</dt>
          <dd className="font-semibold text-slate-900">
            {booking.guest_name ? `${booking.guest_name} (guest of ${booking.customer?.name})` : booking.customer?.name}
          </dd>
          <dd className="mt-1 text-slate-600">{booking.customer?.phone}</dd>
          <dd className="text-slate-600">{booking.customer?.email}</dd>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs font-medium text-slate-500">Specialist</dt>
            <dd className="font-semibold text-slate-900">{booking.staff?.name}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs font-medium text-slate-500">Price</dt>
            <dd className="font-semibold text-slate-900">{formatMoney(booking.price_cents)}</dd>
          </div>
        </div>
        {booking.notes && (
          <div className="rounded-lg bg-amber-50 p-3">
            <dt className="text-xs font-medium text-amber-800">Notes</dt>
            <dd className="text-slate-700">{booking.notes}</dd>
          </div>
        )}
        {booking.status_history?.length > 0 && (
          <div>
            <dt className="text-xs font-medium text-slate-500">History</dt>
            <dd className="mt-1 space-y-1">
              {booking.status_history.map((h, i) => (
                <p key={i} className="text-xs text-slate-500">
                  {h.from ? `${h.from} → ` : ''}<strong>{h.to}</strong> · {h.changed_by} · {new Date(h.changed_at).toLocaleString()}
                </p>
              ))}
            </dd>
          </div>
        )}
      </dl>

      {notice && (
        <div className="mt-4 rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-700">{notice}</div>
      )}

      {!terminal && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {booking.status === 'booked' && (
            <PrimaryButton disabled={working} onClick={() => run(confirmBooking, 'Confirmed')}>
              Confirm
            </PrimaryButton>
          )}
          {['booked', 'confirmed'].includes(booking.status) && (
            <PrimaryButton disabled={working} onClick={() => run(completeBooking, 'Marked complete')} className="bg-emerald-600 hover:bg-emerald-700">
              Complete
            </PrimaryButton>
          )}
          {started && (
            <SecondaryButton disabled={working} onClick={() => run(markNoShow, 'Marked no-show')}>
              No-show
            </SecondaryButton>
          )}
          {!started && (
            <button
              disabled={working}
              onClick={() => { if (window.confirm('Cancel this appointment?')) run(cancelBookingAsStaff, 'Cancelled'); }}
              className="rounded-lg border border-rose-300 px-5 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      )}
      {isAdmin && <p className="mt-3 text-xs text-slate-400">Admin view — actions apply to any staff member&apos;s appointments.</p>}
    </Modal>
  );
}

function WalkInModal({ onClose, onCreated }) {
  const { data: staffData } = useApi(getAdminStaff, []);
  const { data: svcData } = useApi(getServices, []);
  const [form, setForm] = useState({ service_id: '', staff_id: '', date: todayYMD(), start_time: '', customer_name: '', customer_phone: '', customer_email: '', notes: '' });
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const services = useMemo(
    () => (svcData?.categories || []).flatMap((c) => c.services.map((s) => ({ ...s, category: c.name }))),
    [svcData]
  );

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setWorking(true);
    try {
      const res = await walkInBooking({
        service_id: Number(form.service_id),
        staff_id: Number(form.staff_id),
        date: form.date,
        start_time: form.start_time,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        customer_email: form.customer_email.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      onCreated(res.booking);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal title="Walk-in booking" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Service" required>
          <SelectInput value={form.service_id} onChange={set('service_id')} required>
            <option value="">Select…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Staff" required>
          <SelectInput value={form.staff_id} onChange={set('staff_id')} required>
            <option value="">Select…</option>
            {(staffData?.staff || []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Date" required>
          <TextInput type="date" value={form.date} onChange={set('date')} required />
        </Field>
        <Field label="Start time" required hint="HH:MM, 24-hour">
          <TextInput type="time" value={form.start_time} onChange={set('start_time')} required />
        </Field>
        <Field label="Customer name" required>
          <TextInput value={form.customer_name} onChange={set('customer_name')} required placeholder="Full name" />
        </Field>
        <Field label="Customer phone" required>
          <TextInput value={form.customer_phone} onChange={set('customer_phone')} required placeholder="+92 300 1234567" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Customer email (optional)">
            <TextInput type="email" value={form.customer_email} onChange={set('customer_email')} placeholder="you@example.com" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <TextArea value={form.notes} onChange={set('notes')} />
          </Field>
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2">
          <PrimaryButton type="submit" disabled={working} className="w-full">
            {working ? 'Creating…' : 'Create walk-in booking'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

export default function Schedule() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [date, setDate] = useState(todayYMD());
  const [view, setView] = useState('day');
  const [staffFilter, setStaffFilter] = useState('');
  const [openBooking, setOpenBooking] = useState(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: staffData } = useApi(getAdminStaff, []);
  const { data, loading, error, refetch } = useApi(
    () => getSchedule({ date, view, staffId: staffFilter || undefined }),
    [date, view, staffFilter, refreshKey]
  );

  const refresh = () => {
    setRefreshKey((k) => k + 1);
    refetch();
  };

  const updateOpen = (updated) => {
    setOpenBooking(updated);
    refresh();
  };

  const dayBookings = data?.bookings || [];
  const weekDays = data?.days || [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Schedule</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
            {['day', 'week'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3.5 py-1.5 text-sm font-medium capitalize ${view === v ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {v}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          {isAdmin && (
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All staff</option>
              {(staffData?.staff || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <PrimaryButton onClick={() => setWalkInOpen(true)}>+ Walk-in</PrimaryButton>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <Loading label="Loading schedule…" />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : view === 'day' ? (
          dayBookings.length === 0 ? (
            <EmptyState title="No appointments" hint={`${prettyDate(date)} is clear.`} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {dayBookings.map((b) => (
                <ApptCard key={b.id} booking={b} onOpen={setOpenBooking} />
              ))}
            </div>
          )
        ) : (
          <div className="grid gap-3 md:grid-cols-7">
            {weekDays.map((d) => (
              <div key={d.date} className="rounded-xl border border-slate-200 bg-white p-2">
                <p className={`rounded-lg px-2 py-1.5 text-center text-xs font-bold ${d.date === todayYMD() ? 'bg-rose-100 text-rose-700' : 'text-slate-600'}`}>
                  {dayShort(d.date)}<br />{d.date.slice(8)}
                </p>
                <div className="mt-2 space-y-1.5">
                  {d.bookings.length === 0 && (
                    <p className="py-3 text-center text-[11px] text-slate-300">—</p>
                  )}
                  {d.bookings.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setOpenBooking(b)}
                      className={`w-full rounded-lg border-l-4 bg-slate-50 p-1.5 text-left text-[11px] hover:bg-slate-100 ${statusColor[b.status] || 'border-l-slate-200'}`}
                    >
                      <span className="font-bold text-slate-800">{b.time_label}</span>
                      <span className="block truncate text-slate-600">{b.service?.name}</span>
                      <span className="block truncate text-slate-400">{b.customer?.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {openBooking && (
        <AppointmentDrawer
          booking={openBooking}
          onClose={() => setOpenBooking(null)}
          onChanged={updateOpen}
          isAdmin={isAdmin}
        />
      )}
      {walkInOpen && (
        <WalkInModal
          onClose={() => setWalkInOpen(false)}
          onCreated={() => { setWalkInOpen(false); refresh(); }}
        />
      )}
    </div>
  );
}
