import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../api/salon.js';
import { useApi, apiErrorMessage } from '../hooks/useApi.js';
import Loading from '../components/Loading.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { Field, PrimaryButton, TextArea, TextInput } from '../components/Fields.jsx';

export default function AdminSettings() {
  const { data, loading, error, refetch } = useApi(getSettings, []);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  useEffect(() => {
    if (data?.settings) {
      const s = data.settings;
      setForm({
        salon_name: s.salon_name || '',
        timezone: s.timezone || '',
        currency: s.currency || '',
        phone: s.phone || '',
        email: s.email || '',
        address: s.address || '',
        booking_window_days: s.booking_window_days ?? 42,
        lead_time_minutes: s.lead_time_minutes ?? 120,
        slot_step_minutes: s.slot_step_minutes ?? 15,
        free_cancellation_hours: s.free_cancellation_hours ?? 24,
        cancellation_policy_text: s.cancellation_policy_text || '',
      });
    }
  }, [data]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNotice({ type: '', text: '' });
    try {
      await updateSettings({
        ...form,
        booking_window_days: Number(form.booking_window_days),
        lead_time_minutes: Number(form.lead_time_minutes),
        slot_step_minutes: Number(form.slot_step_minutes),
        free_cancellation_hours: Number(form.free_cancellation_hours),
      });
      setNotice({ type: 'ok', text: 'Settings saved.' });
      refetch();
    } catch (err) {
      setNotice({ type: 'error', text: apiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) return <Loading label="Loading settings…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Salon settings</h1>

      {notice.text && (
        <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${notice.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>
          {notice.text}
        </div>
      )}

      <form onSubmit={submit} className="mt-6 space-y-6">
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Salon profile</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Salon name" required>
              <TextInput value={form.salon_name} onChange={set('salon_name')} required />
            </Field>
            <Field label="Timezone" required hint="IANA name, e.g. Asia/Karachi">
              <TextInput value={form.timezone} onChange={set('timezone')} required />
            </Field>
            <Field label="Currency" required hint="ISO code, e.g. USD">
              <TextInput value={form.currency} onChange={set('currency')} required />
            </Field>
            <Field label="Phone">
              <TextInput value={form.phone} onChange={set('phone')} />
            </Field>
            <Field label="Email">
              <TextInput type="email" value={form.email} onChange={set('email')} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <TextInput value={form.address} onChange={set('address')} />
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Booking rules</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Booking window (days)" required hint="How far ahead guests can book">
              <TextInput type="number" min="1" max="365" value={form.booking_window_days} onChange={set('booking_window_days')} required />
            </Field>
            <Field label="Lead time (minutes)" required hint="Minimum notice before a slot becomes bookable">
              <TextInput type="number" min="0" step="15" value={form.lead_time_minutes} onChange={set('lead_time_minutes')} required />
            </Field>
            <Field label="Slot step (minutes)" required hint="Granularity of bookable start times">
              <TextInput type="number" min="5" step="5" value={form.slot_step_minutes} onChange={set('slot_step_minutes')} required />
            </Field>
            <Field label="Free cancellation (hours)" required hint="Cancel free of charge up to this long before">
              <TextInput type="number" min="0" value={form.free_cancellation_hours} onChange={set('free_cancellation_hours')} required />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Cancellation policy text" required>
                <TextArea rows={5} value={form.cancellation_policy_text} onChange={set('cancellation_policy_text')} required />
              </Field>
            </div>
          </div>
        </section>

        <PrimaryButton type="submit" disabled={saving} className="px-8 py-3">
          {saving ? 'Saving…' : 'Save settings'}
        </PrimaryButton>
      </form>
    </div>
  );
}
