import { useState } from 'react';
import { getShifts, requestTimeOff } from '../api/salon.js';
import { useApi, apiErrorMessage } from '../hooks/useApi.js';
import { timeLabel } from '../utils/format.js';
import Loading from '../components/Loading.jsx';
import ErrorState from '../components/ErrorState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { Field, PrimaryButton, SelectInput, TextArea, TextInput } from '../components/Fields.jsx';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function MyShifts() {
  const { data, loading, error, refetch } = useApi(getShifts, []);
  const [form, setForm] = useState({ type: 'vacation', starts_at: '', ends_at: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setNotice({ type: '', text: '' });
    setSubmitting(true);
    try {
      await requestTimeOff({
        type: form.type,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        note: form.note.trim() || undefined,
      });
      setNotice({ type: 'ok', text: 'Time-off request submitted for approval.' });
      setForm({ type: 'vacation', starts_at: '', ends_at: '', note: '' });
      refetch();
    } catch (err) {
      setNotice({ type: 'error', text: apiErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading label="Loading shifts…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const hours = [...(data?.working_hours || [])].sort(
    (a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)
  );
  const timeOff = data?.time_off || [];
  const blockouts = data?.blockouts || [];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">My shifts</h1>

      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Working hours</h2>
        <p className="text-sm text-slate-500">Set by your salon manager.</p>
        {hours.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No working hours set yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {hours.map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-medium text-slate-700">{DAYS[w.day_of_week]}</span>
                <span className="font-semibold text-slate-900">
                  {timeLabel(w.start_time)} – {timeLabel(w.end_time)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {blockouts.length > 0 && (
          <>
            <h3 className="mt-6 text-sm font-semibold text-slate-700">Blocked periods</h3>
            <ul className="mt-2 space-y-2">
              {blockouts.map((b) => (
                <li key={b.id} className="rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                  {new Date(b.starts_at).toLocaleString()} – {new Date(b.ends_at).toLocaleString()}
                  {b.reason && <span className="text-slate-500"> · {b.reason}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Time off</h2>
        {timeOff.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No time-off requests yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {timeOff.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold capitalize text-slate-800">{t.type}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(t.starts_at).toLocaleString()} → {new Date(t.ends_at).toLocaleString()}
                  </p>
                  {t.note && <p className="mt-0.5 text-xs italic text-slate-500">“{t.note}”</p>}
                </div>
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-6 text-sm font-semibold text-slate-700">Request time off</h3>
        {notice.text && (
          <div className={`mt-3 rounded-lg px-4 py-2.5 text-sm ${notice.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>
            {notice.text}
          </div>
        )}
        <form onSubmit={submit} className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Type" required>
            <SelectInput value={form.type} onChange={set('type')}>
              <option value="vacation">Vacation</option>
              <option value="sick">Sick</option>
              <option value="other">Other</option>
            </SelectInput>
          </Field>
          <div />
          <Field label="From" required>
            <TextInput type="datetime-local" value={form.starts_at} onChange={set('starts_at')} required />
          </Field>
          <Field label="To" required>
            <TextInput type="datetime-local" value={form.ends_at} onChange={set('ends_at')} required />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Note">
              <TextArea value={form.note} onChange={set('note')} placeholder="Optional note for your manager…" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <PrimaryButton type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </PrimaryButton>
          </div>
        </form>
      </section>
    </div>
  );
}
