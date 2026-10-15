import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createBooking, getSalon, getService, getStaff } from '../api/salon.js';
import { useApi, apiErrorMessage } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDuration, formatMoney, prettyDate, timeLabel } from '../utils/format.js';
import Loading from '../components/Loading.jsx';
import ErrorState from '../components/ErrorState.jsx';
import SlotPicker from '../components/SlotPicker.jsx';
import { Checkbox, Field, PrimaryButton, SecondaryButton, TextArea, TextInput, Toggle } from '../components/Fields.jsx';

const STEPS = ['Staff', 'Date & time', 'Your details', 'Review'];

export default function BookFlow() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [staffSel, setStaffSel] = useState({ id: null, name: 'Any available' });
  const [slot, setSlot] = useState(null); // {date, time, staffId, staffName}
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', notes: '' });
  const [forSomeoneElse, setForSomeoneElse] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const { data: svcData, loading: svcLoading, error: svcError, refetch: svcRefetch } = useApi(
    () => getService(serviceId), [serviceId]
  );
  const { data: staffData, loading: staffLoading } = useApi(() => getStaff(serviceId), [serviceId]);
  const { data: salonData } = useApi(getSalon, []);

  const service = svcData?.service;
  const policy = svcData?.policy;
  const staffList = useMemo(() => staffData?.staff || [], [staffData]);
  const currency = salonData?.salon?.currency || 'USD';
  const timezoneLabel = salonData?.salon?.timezone_label;

  // Prefill details from the signed-in account.
  useEffect(() => {
    if (user) {
      const [first, ...rest] = (user.name || '').split(' ');
      setForm((f) => ({
        ...f,
        first_name: f.first_name || first || '',
        last_name: f.last_name || rest.join(' ') || '',
        email: f.email || user.email || '',
        phone: f.phone || user.phone || '',
      }));
    }
  }, [user]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validateDetails = () => {
    const errs = {};
    if (!form.first_name.trim()) errs.first_name = 'First name is required.';
    if (!form.last_name.trim()) errs.last_name = 'Last name is required.';
    if (!form.phone.trim()) errs.phone = 'Phone is required.';
    if (!form.email.trim()) errs.email = 'Email is required.';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email address.';
    if (forSomeoneElse && !guestName.trim()) errs.guest_name = 'Guest name is required.';
    if (!policyAccepted) errs.policy = 'You must accept the cancellation policy.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const confirm = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const payload = {
        service_id: Number(serviceId),
        staff_id: staffSel.id,
        date: slot.date,
        start_time: slot.time,
        customer: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          notes: form.notes.trim() || undefined,
        },
        guest_name: forSomeoneElse ? guestName.trim() : undefined,
        policy_accepted: true,
      };
      const res = await createBooking(payload);
      const booking = res.booking;
      try {
        sessionStorage.setItem(`booking:${booking.reference_code}`, JSON.stringify(booking));
      } catch { /* storage unavailable — confirmation page still works from state */ }
      navigate(`/confirmation/${booking.reference_code}`, { state: { booking } });
    } catch (err) {
      setSubmitError(apiErrorMessage(err));
      if (err.response?.status === 422 && err.response.data?.errors) {
        const mapped = {};
        Object.entries(err.response.data.errors).forEach(([k, v]) => {
          mapped[k.replace('customer.', '')] = Array.isArray(v) ? v[0] : v;
        });
        setFieldErrors((e) => ({ ...e, ...mapped }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (svcLoading) return <Loading label="Loading booking…" />;
  if (svcError) return <ErrorState error={svcError} onRetry={svcRefetch} title="Service not found" />;

  const canNext =
    (step === 0 && true) ||
    (step === 1 && slot?.date && slot?.time) ||
    (step === 2 && true);

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/services/${serviceId}`} className="text-sm font-medium text-slate-500 hover:text-rose-600">
        ← Back to {service.name}
      </Link>

      <div className="mt-4 rounded-3xl bg-white p-6 shadow-sm sm:p-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Book: {service.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {formatDuration(service.duration_minutes)} · {service.price_display || formatMoney(service.price_cents, currency)}
            </p>
          </div>
        </div>

        {/* Progress */}
        <ol className="mt-6 flex items-center gap-1 sm:gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-1 sm:gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </span>
              <span className={`hidden text-xs font-medium sm:block ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200" />}
            </li>
          ))}
        </ol>

        <div className="mt-8">
          {/* STEP 1 — staff */}
          {step === 0 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Choose your specialist</h2>
              {staffLoading ? (
                <Loading label="Loading staff…" />
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setStaffSel({ id: null, name: 'Any available' })}
                    className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                      staffSel.id === null ? 'border-rose-600 bg-rose-50' : 'border-slate-200 hover:border-rose-300'
                    }`}
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-indigo-600 text-xl text-white">
                      ✦
                    </span>
                    <p className="mt-2 font-semibold text-slate-900">Any available</p>
                    <p className="text-xs text-slate-500">First open slot with a qualified specialist</p>
                  </button>
                  {staffList.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStaffSel({ id: s.id, name: s.name })}
                      className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                        staffSel.id === s.id ? 'border-rose-600 bg-rose-50' : 'border-slate-200 hover:border-rose-300'
                      }`}
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-indigo-500 text-lg font-bold text-white">
                        {s.photo_url ? <img src={s.photo_url} alt={s.name} className="h-12 w-12 rounded-full object-cover" /> : s.name.charAt(0)}
                      </span>
                      <p className="mt-2 font-semibold text-slate-900">{s.name}</p>
                      <p className="text-xs text-slate-500">
                        {s.next_available
                          ? `Next available: ${new Date(s.next_available).toLocaleString()}`
                          : 'No availability in the booking window'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — slot */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Pick a date & time <span className="font-normal text-slate-500">— {staffSel.name}</span>
              </h2>
              <div className="mt-4">
                <SlotPicker
                  serviceId={Number(serviceId)}
                  staffId={staffSel.id}
                  value={slot}
                  onChange={setSlot}
                  timezoneLabel={timezoneLabel}
                />
              </div>
            </div>
          )}

          {/* STEP 3 — details */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Your details</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="First name" required error={fieldErrors.first_name}>
                  <TextInput value={form.first_name} onChange={set('first_name')} placeholder="Ayesha" />
                </Field>
                <Field label="Last name" required error={fieldErrors.last_name}>
                  <TextInput value={form.last_name} onChange={set('last_name')} placeholder="Khan" />
                </Field>
                <Field label="Phone" required error={fieldErrors.phone} hint="We may call to confirm.">
                  <TextInput value={form.phone} onChange={set('phone')} placeholder="+92 300 1234567" inputMode="tel" />
                </Field>
                <Field label="Email" required error={fieldErrors.email} hint="Confirmation and reminders go here.">
                  <TextInput value={form.email} onChange={set('email')} placeholder="you@example.com" inputMode="email" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Notes for your specialist">
                    <TextArea value={form.notes} onChange={set('notes')} placeholder="Allergies, preferences, inspiration photos…" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Toggle
                    label="I'm booking for someone else"
                    hint="The appointment will be held under their name."
                    checked={forSomeoneElse}
                    onChange={setForSomeoneElse}
                  />
                  {forSomeoneElse && (
                    <div className="mt-3">
                      <Field label="Guest name" required error={fieldErrors.guest_name}>
                        <TextInput value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Guest's full name" />
                      </Field>
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2 rounded-xl bg-slate-50 p-4">
                  <Checkbox
                    label={`I accept the cancellation policy (free cancellation up to ${policy?.free_cancellation_hours ?? 24}h before)`}
                    hint={policy?.text}
                    checked={policyAccepted}
                    onChange={(e) => setPolicyAccepted(e.target.checked)}
                  />
                  {fieldErrors.policy && <p className="mt-1 text-xs text-rose-600">{fieldErrors.policy}</p>}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 — review */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Review & confirm</h2>
              <dl className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {[
                  ['Treatment', service.name],
                  ['Specialist', slot?.staffName || staffSel.name],
                  ['Date', slot?.date ? prettyDate(slot.date) : '—'],
                  ['Time', slot?.time ? timeLabel(slot.time) : '—'],
                  ['Duration', formatDuration(service.duration_minutes)],
                  ['Price', service.price_display || formatMoney(service.price_cents, currency)],
                  ['Name', `${form.first_name} ${form.last_name}`.trim()],
                  ['Phone', form.phone],
                  ['Email', form.email],
                  ...(forSomeoneElse ? [['Guest', guestName]] : []),
                  ...(form.notes ? [['Notes', form.notes]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 px-5 py-3">
                    <dt className="text-sm text-slate-500">{k}</dt>
                    <dd className="text-right text-sm font-semibold text-slate-900">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-slate-500">
                Free cancellation until 24h before your appointment. {timezoneLabel}
              </p>
              {submitError && (
                <div className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</div>
              )}
            </div>
          )}
        </div>

        {/* Nav buttons */}
        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
          <div>
            {step > 0 && (
              <SecondaryButton onClick={() => { setStep(step - 1); setSubmitError(''); }}>
                ← Back
              </SecondaryButton>
            )}
          </div>
          {step < 3 ? (
            <PrimaryButton
              disabled={!canNext}
              onClick={() => {
                if (step === 2 && !validateDetails()) return;
                setStep(step + 1);
                window.scrollTo(0, 0);
              }}
            >
              Continue →
            </PrimaryButton>
          ) : (
            <PrimaryButton disabled={submitting} onClick={confirm} className="px-8 py-3">
              {submitting ? 'Confirming…' : 'Confirm booking'}
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}
