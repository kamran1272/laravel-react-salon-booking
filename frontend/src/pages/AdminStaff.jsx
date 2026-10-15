import { useMemo, useState } from 'react';
import {
  getAdminStaff, createStaffMember, updateStaffMember,
  getWorkingHours, createWorkingHours, deleteWorkingHours,
  getTimeOff, approveTimeOff, declineTimeOff,
  getBlockouts, createBlockout, deleteBlockout,
  getAdminServices,
} from '../api/salon.js';
import { useApi, apiErrorMessage } from '../hooks/useApi.js';
import { timeLabel } from '../utils/format.js';
import Loading from '../components/Loading.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { Checkbox, Field, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput } from '../components/Fields.jsx';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function StaffModal({ staff, services, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: staff?.name || '',
    email: staff?.email || '',
    phone: staff?.phone || '',
    password: '',
    bio: staff?.bio || '',
    photo_url: staff?.photo_url || '',
    bookable_online: staff?.bookable_online ?? true,
    service_ids: staff?.service_ids || [],
  });
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleService = (id) =>
    setForm((f) => ({
      ...f,
      service_ids: f.service_ids.includes(id) ? f.service_ids.filter((x) => x !== id) : [...f.service_ids, id],
    }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setWorking(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        bio: form.bio.trim(),
        photo_url: form.photo_url.trim(),
        bookable_online: form.bookable_online,
        service_ids: form.service_ids,
      };
      if (!staff && form.password) payload.password = form.password;
      if (staff) await updateStaffMember(staff.id, payload);
      else await createStaffMember(payload);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal title={staff ? 'Edit staff member' : 'New staff member'} onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>
          <TextInput value={form.name} onChange={set('name')} required />
        </Field>
        <Field label="Email" required>
          <TextInput type="email" value={form.email} onChange={set('email')} required />
        </Field>
        <Field label="Phone">
          <TextInput value={form.phone} onChange={set('phone')} placeholder="+92 300 1234567" />
        </Field>
        {!staff && (
          <Field label="Password" required hint="For their staff login">
            <TextInput type="password" value={form.password} onChange={set('password')} required />
          </Field>
        )}
        <div className="sm:col-span-2">
          <Field label="Bio">
            <TextArea value={form.bio} onChange={set('bio')} placeholder="Experience, specialities…" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Photo URL">
            <TextInput value={form.photo_url} onChange={set('photo_url')} placeholder="https://…" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Services they perform">
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleService(s.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                    form.service_ids.includes(s.id)
                      ? 'border-rose-600 bg-rose-600 text-white'
                      : 'border-slate-300 text-slate-600 hover:border-rose-300'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Checkbox label="Bookable" hint="Appear on the public booking site" checked={form.bookable_online} onChange={(e) => setForm((f) => ({ ...f, bookable_online: e.target.checked }))} />
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-3 sm:col-span-2">
          <SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton type="submit" disabled={working}>{working ? 'Saving…' : 'Save'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function WorkingHoursEditor({ staffList }) {
  const [staffId, setStaffId] = useState(staffList[0]?.id || '');
  const { data, loading, error, refetch } = useApi(
    () => (staffId ? getWorkingHours(staffId) : Promise.resolve({ working_hours: [] })),
    [staffId]
  );
  const [newWin, setNewWin] = useState({ day_of_week: 1, start_time: '10:00', end_time: '19:00' });
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);

  const hours = data?.working_hours || [];
  const byDay = useMemo(() => {
    const map = {};
    hours.forEach((w) => {
      (map[w.day_of_week] = map[w.day_of_week] || []).push(w);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return map;
  }, [hours]);

  const add = async (e) => {
    e.preventDefault();
    setWorking(true);
    setNotice('');
    try {
      await createWorkingHours({
        user_id: Number(staffId),
        day_of_week: Number(newWin.day_of_week),
        start_time: newWin.start_time,
        end_time: newWin.end_time,
      });
      setNotice('Window added.');
      refetch();
    } catch (err) {
      setNotice(apiErrorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this working window?')) return;
    try {
      await deleteWorkingHours(id);
      refetch();
    } catch (err) {
      setNotice(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Field label="Staff member">
          <SelectInput value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </SelectInput>
        </Field>
      </div>
      {notice && <p className="mt-3 rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-700">{notice}</p>}
      {loading ? <Loading label="Loading hours…" /> : error ? <ErrorState error={error} onRetry={refetch} /> : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {DAYS.map((day, dow) => (
            <div key={dow} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-800">{day}</p>
              {(byDay[dow] || []).length === 0 ? (
                <p className="mt-1 text-xs text-slate-400">Off</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {byDay[dow].map((w) => (
                    <li key={w.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                      <span className="font-medium text-slate-700">{timeLabel(w.start_time)} – {timeLabel(w.end_time)}</span>
                      <button onClick={() => remove(w.id)} className="text-xs font-semibold text-rose-600 hover:text-rose-800">Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-4">
        <Field label="Day">
          <SelectInput value={newWin.day_of_week} onChange={(e) => setNewWin((f) => ({ ...f, day_of_week: e.target.value }))}>
            {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </SelectInput>
        </Field>
        <Field label="Start">
          <TextInput type="time" value={newWin.start_time} onChange={(e) => setNewWin((f) => ({ ...f, start_time: e.target.value }))} required />
        </Field>
        <Field label="End">
          <TextInput type="time" value={newWin.end_time} onChange={(e) => setNewWin((f) => ({ ...f, end_time: e.target.value }))} required />
        </Field>
        <PrimaryButton type="submit" disabled={working || !staffId}>+ Add window</PrimaryButton>
      </form>
    </div>
  );
}

function TimeOffApprovals() {
  const { data, loading, error, refetch } = useApi(() => getTimeOff(), []);
  const [notice, setNotice] = useState('');

  const decide = async (id, fn, label) => {
    try {
      await fn(id);
      setNotice(`Request ${label}.`);
      refetch();
    } catch (err) {
      setNotice(apiErrorMessage(err));
    }
  };

  const list = data?.time_off || [];
  const pending = list.filter((t) => t.status === 'pending');
  const decided = list.filter((t) => t.status !== 'pending');

  return (
    <div>
      {notice && <p className="mb-3 rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-700">{notice}</p>}
      {loading ? <Loading label="Loading requests…" /> : error ? <ErrorState error={error} onRetry={refetch} /> : (
        <>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pending ({pending.length})</h3>
          {pending.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">No pending requests.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {pending.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="text-sm">
                    <p className="font-semibold text-slate-900">{t.staff_name} · <span className="capitalize">{t.type}</span></p>
                    <p className="text-xs text-slate-600">{new Date(t.starts_at).toLocaleString()} → {new Date(t.ends_at).toLocaleString()}</p>
                    {t.note && <p className="mt-0.5 text-xs italic text-slate-500">“{t.note}”</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => decide(t.id, approveTimeOff, 'approved')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Approve</button>
                    <button onClick={() => decide(t.id, declineTimeOff, 'declined')} className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">Decline</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">Decided</h3>
          <ul className="mt-2 space-y-2">
            {decided.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{t.staff_name} · <span className="capitalize">{t.type}</span></p>
                  <p className="text-xs text-slate-500">{new Date(t.starts_at).toLocaleDateString()} → {new Date(t.ends_at).toLocaleDateString()}</p>
                </div>
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function BlockoutsManager({ staffList }) {
  const { data, loading, error, refetch } = useApi(getBlockouts, []);
  const [form, setForm] = useState({ staff_id: '', starts_at: '', ends_at: '', reason: '', blocks_online_booking: true });
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setWorking(true);
    setNotice('');
    try {
      await createBlockout({
        staff_id: form.staff_id ? Number(form.staff_id) : null,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        reason: form.reason.trim(),
        blocks_online_booking: form.blocks_online_booking,
      });
      setNotice('Blockout created.');
      setForm({ staff_id: '', starts_at: '', ends_at: '', reason: '', blocks_online_booking: true });
      refetch();
    } catch (err) {
      setNotice(apiErrorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this blockout?')) return;
    try {
      await deleteBlockout(id);
      refetch();
    } catch (err) {
      setNotice(apiErrorMessage(err));
    }
  };

  return (
    <div>
      {notice && <p className="mb-3 rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-700">{notice}</p>}
      <form onSubmit={submit} className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Staff (blank = whole salon)">
          <SelectInput value={form.staff_id} onChange={(e) => setForm((f) => ({ ...f, staff_id: e.target.value }))}>
            <option value="">Whole salon</option>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="From" required>
          <TextInput type="datetime-local" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} required />
        </Field>
        <Field label="To" required>
          <TextInput type="datetime-local" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} required />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Reason" required>
            <TextInput value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} required placeholder="e.g. Deep cleaning, public holiday" />
          </Field>
        </div>
        <div className="flex items-end">
          <Checkbox label="Blocks online booking" checked={form.blocks_online_booking} onChange={(e) => setForm((f) => ({ ...f, blocks_online_booking: e.target.checked }))} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <PrimaryButton type="submit" disabled={working}>{working ? 'Creating…' : '+ Add blockout'}</PrimaryButton>
        </div>
      </form>
      <div className="mt-4">
        {loading ? <Loading label="Loading blockouts…" /> : error ? <ErrorState error={error} onRetry={refetch} /> : (
          <ul className="space-y-2">
            {(data?.blockouts || []).map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{b.staff_name || 'Whole salon'} — {b.reason}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(b.starts_at).toLocaleString()} → {new Date(b.ends_at).toLocaleString()}
                    {!b.blocks_online_booking && ' · does not block online booking'}
                  </p>
                </div>
                <button onClick={() => remove(b.id)} className="text-sm font-semibold text-rose-600 hover:text-rose-800">Delete</button>
              </li>
            ))}
            {(data?.blockouts || []).length === 0 && <p className="text-sm text-slate-400">No blockouts.</p>}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function AdminStaff() {
  const [tab, setTab] = useState('team');
  const { data, loading, error, refetch } = useApi(getAdminStaff, []);
  const { data: svcData } = useApi(getAdminServices, []);
  const [editing, setEditing] = useState(undefined);
  const [notice, setNotice] = useState('');

  const staffList = data?.staff || [];
  const services = svcData?.services || [];

  const saved = () => {
    setEditing(undefined);
    setNotice('Staff member saved.');
    refetch();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Staff</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
            {[['team', 'Team'], ['hours', 'Working hours'], ['timeoff', 'Time off'], ['blockouts', 'Blockouts']].map(([v, label]) => (
              <button
                key={v}
                onClick={() => setTab(v)}
                className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${tab === v ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'team' && <PrimaryButton onClick={() => setEditing(null)}>+ New staff</PrimaryButton>}
        </div>
      </div>

      {notice && <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{notice}</div>}

      <div className="mt-6">
        {tab === 'team' && (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
            {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={refetch} /> : (
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-5 py-3 font-semibold">Contact</th>
                    <th className="px-5 py-3 font-semibold">Services</th>
                    <th className="px-5 py-3 font-semibold">Bookable</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {staffList.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-indigo-500 text-sm font-bold text-white">
                            {s.name.charAt(0)}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900">{s.name}</p>
                            {s.bio && <p className="max-w-xs truncate text-xs text-slate-400">{s.bio}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        <p>{s.email}</p>
                        <p className="text-xs text-slate-400">{s.phone}</p>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        <p className="max-w-xs truncate text-xs">{(s.services || []).join(', ') || '—'}</p>
                      </td>
                      <td className="px-5 py-3.5">{s.bookable_online ? '✓' : '—'}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => setEditing(s)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {tab === 'hours' && <div className="rounded-2xl bg-white p-6 shadow-sm"><WorkingHoursEditor staffList={staffList} /></div>}
        {tab === 'timeoff' && <div className="rounded-2xl bg-white p-6 shadow-sm"><TimeOffApprovals /></div>}
        {tab === 'blockouts' && <div className="rounded-2xl bg-white p-6 shadow-sm"><BlockoutsManager staffList={staffList} /></div>}
      </div>

      {editing !== undefined && (
        <StaffModal staff={editing} services={services} onClose={() => setEditing(undefined)} onSaved={saved} />
      )}
    </div>
  );
}
