import { useMemo, useState } from 'react';
import {
  getAdminBookings, createAdminBooking, updateAdminBooking,
  getAdminStaff, getAdminServices, getCustomers,
  confirmBooking, completeBooking, markNoShow, cancelBookingAsStaff,
} from '../api/salon.js';
import { useApi, apiErrorMessage } from '../hooks/useApi.js';
import { formatMoney, todayYMD } from '../utils/format.js';
import Loading from '../components/Loading.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';
import { Field, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput } from '../components/Fields.jsx';

const STATUSES = ['', 'booked', 'confirmed', 'completed', 'cancelled', 'no_show'];

function BookingFormModal({ booking, services, staffList, customers, onClose, onSaved }) {
  const [form, setForm] = useState({
    service_id: booking?.service?.id || services[0]?.id || '',
    staff_id: booking?.staff?.id || staffList[0]?.id || '',
    date: booking ? booking.starts_at.slice(0, 10) : todayYMD(),
    start_time: booking ? booking.starts_at.slice(11, 16) : '10:00',
    customer_id: booking?.customer?.id || '',
    customer_name: booking && !booking.customer?.id ? booking.customer?.name || '' : '',
    customer_phone: booking?.customer?.phone || '',
    customer_email: booking?.customer?.email || '',
    guest_name: booking?.guest_name || '',
    notes: booking?.notes || '',
    source: booking?.source || 'admin',
  });
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setWorking(true);
    try {
      if (booking) {
        await updateAdminBooking(booking.id, {
          service_id: Number(form.service_id),
          staff_id: Number(form.staff_id),
          date: form.date,
          start_time: form.start_time,
          guest_name: form.guest_name.trim() || null,
          notes: form.notes.trim(),
        });
      } else {
        await createAdminBooking({
          service_id: Number(form.service_id),
          staff_id: Number(form.staff_id),
          date: form.date,
          start_time: form.start_time,
          customer_id: form.customer_id ? Number(form.customer_id) : undefined,
          customer_name: form.customer_name.trim() || undefined,
          customer_phone: form.customer_phone.trim() || undefined,
          customer_email: form.customer_email.trim() || undefined,
          guest_name: form.guest_name.trim() || undefined,
          notes: form.notes.trim() || undefined,
          source: form.source,
        });
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal title={booking ? `Edit booking ${booking.reference_code}` : 'New booking'} onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Service" required>
          <SelectInput value={form.service_id} onChange={set('service_id')} required>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Staff" required hint="Reassign by picking another specialist">
          <SelectInput value={form.staff_id} onChange={set('staff_id')} required>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Date" required>
          <TextInput type="date" value={form.date} onChange={set('date')} required />
        </Field>
        <Field label="Start time" required>
          <TextInput type="time" value={form.start_time} onChange={set('start_time')} required />
        </Field>
        {!booking && (
          <>
            <Field label="Existing customer">
              <SelectInput value={form.customer_id} onChange={set('customer_id')}>
                <option value="">— new / walk-in —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
              </SelectInput>
            </Field>
            <div />
            <Field label="Customer name">
              <TextInput value={form.customer_name} onChange={set('customer_name')} placeholder="Full name" />
            </Field>
            <Field label="Customer phone">
              <TextInput value={form.customer_phone} onChange={set('customer_phone')} placeholder="+92 300 1234567" />
            </Field>
            <Field label="Customer email">
              <TextInput type="email" value={form.customer_email} onChange={set('customer_email')} placeholder="you@example.com" />
            </Field>
            <Field label="Source">
              <SelectInput value={form.source} onChange={set('source')}>
                <option value="admin">Admin / front desk</option>
                <option value="walk_in">Walk-in</option>
                <option value="phone">Phone</option>
                <option value="online">Online</option>
              </SelectInput>
            </Field>
          </>
        )}
        <div className="sm:col-span-2">
          <Field label="Guest name" hint="If the appointment is for someone else">
            <TextInput value={form.guest_name} onChange={set('guest_name')} placeholder="Guest's full name" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <TextArea value={form.notes} onChange={set('notes')} />
          </Field>
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-3 sm:col-span-2">
          <SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton type="submit" disabled={working}>{working ? 'Saving…' : 'Save booking'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function StatusButtons({ booking, onDone }) {
  const [working, setWorking] = useState(false);
  const run = async (fn, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
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
  if (terminal) return <span className="text-xs text-slate-400">Closed</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {booking.status === 'booked' && (
        <button disabled={working} onClick={() => run(confirmBooking)} className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-200">Confirm</button>
      )}
      <button disabled={working} onClick={() => run(completeBooking)} className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200">Complete</button>
      <button disabled={working} onClick={() => run(markNoShow)} className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200">No-show</button>
      <button disabled={working} onClick={() => run(cancelBookingAsStaff, 'Cancel this booking?')} className="rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200">Cancel</button>
    </div>
  );
}

export default function AdminBookings() {
  const [filters, setFilters] = useState({ date: todayYMD(), staff_id: '', status: '', search: '' });
  const [applied, setApplied] = useState({ date: todayYMD() });
  const { data, loading, error, refetch } = useApi(
    () => getAdminBookings(Object.fromEntries(Object.entries(applied).filter(([, v]) => v))),
    [applied]
  );
  const { data: staffData } = useApi(getAdminStaff, []);
  const { data: svcData } = useApi(getAdminServices, []);
  const { data: custData } = useApi(() => getCustomers(''), []);
  const [modal, setModal] = useState(undefined); // undefined closed, null new, object edit
  const [notice, setNotice] = useState('');

  const bookings = data?.bookings || [];
  const staffList = staffData?.staff || [];
  const services = useMemo(
    () => (svcData?.services || []).filter((s) => s.is_active),
    [svcData]
  );
  const customers = custData?.customers || [];

  const apply = (e) => {
    e.preventDefault();
    setApplied({ ...filters });
  };
  const clear = () => {
    const f = { date: '', staff_id: '', status: '', search: '' };
    setFilters(f);
    setApplied(f);
  };

  const saved = () => {
    setModal(undefined);
    setNotice('Booking saved.');
    refetch();
  };

  const setF = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Bookings</h1>
        <PrimaryButton onClick={() => setModal(null)}>+ New booking</PrimaryButton>
      </div>

      {notice && <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{notice}</div>}

      <form onSubmit={apply} className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <Field label="Date">
          <TextInput type="date" value={filters.date} onChange={setF('date')} />
        </Field>
        <Field label="Staff">
          <SelectInput value={filters.staff_id} onChange={setF('staff_id')}>
            <option value="">All staff</option>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Status">
          <SelectInput value={filters.status} onChange={setF('status')}>
            {STATUSES.map((s) => <option key={s} value={s}>{s === '' ? 'All statuses' : s.replace('_', ' ')}</option>)}
          </SelectInput>
        </Field>
        <Field label="Search">
          <TextInput value={filters.search} onChange={setF('search')} placeholder="Name, email, phone, ref…" className="w-56" />
        </Field>
        <PrimaryButton type="submit">Filter</PrimaryButton>
        <SecondaryButton type="button" onClick={clear}>Clear</SecondaryButton>
      </form>

      <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
        {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={refetch} /> : bookings.length === 0 ? (
          <div className="p-6"><EmptyState title="No bookings found" hint="Try widening the filters." /></div>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                <th className="px-5 py-3 font-semibold">When</th>
                <th className="px-5 py-3 font-semibold">Client</th>
                <th className="px-5 py-3 font-semibold">Service</th>
                <th className="px-5 py-3 font-semibold">Staff</th>
                <th className="px-5 py-3 font-semibold">Price</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-slate-900">{b.date_label}</p>
                    <p className="text-xs text-slate-500">{b.time_label}</p>
                    <p className="font-mono text-[11px] text-slate-400">{b.reference_code}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-800">{b.guest_name || b.customer?.name}</p>
                    <p className="text-xs text-slate-500">{b.customer?.phone}</p>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{b.service?.name}</td>
                  <td className="px-5 py-3.5 text-slate-600">{b.staff?.name}</td>
                  <td className="px-5 py-3.5 font-semibold text-slate-900">{formatMoney(b.price_cents)}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={b.status} /></td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-2">
                      <StatusButtons booking={b} onDone={refetch} />
                      <button onClick={() => setModal(b)} className="self-start text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                        Edit / reschedule
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal !== undefined && (
        <BookingFormModal
          booking={modal}
          services={services}
          staffList={staffList}
          customers={customers}
          onClose={() => setModal(undefined)}
          onSaved={saved}
        />
      )}
    </div>
  );
}
