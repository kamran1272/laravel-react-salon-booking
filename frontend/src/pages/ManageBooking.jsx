import { useState } from 'react';
import { getSalon, cancelManagedBooking, lookupManagedBooking, rescheduleManagedBooking } from '../api/salon.js';
import { useApi, apiErrorMessage } from '../hooks/useApi.js';
import { formatMoney } from '../utils/format.js';
import SlotPicker from '../components/SlotPicker.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';
import { Field, PrimaryButton, SecondaryButton, TextInput } from '../components/Fields.jsx';

export default function ManageBooking() {
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [booking, setBooking] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionOk, setActionOk] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [slot, setSlot] = useState(null);
  const [working, setWorking] = useState(false);

  const { data: salonData } = useApi(getSalon, []);
  const currency = salonData?.salon?.currency || 'USD';
  const timezoneLabel = salonData?.salon?.timezone_label;

  const lookup = async (e) => {
    e?.preventDefault();
    setLookupError('');
    setActionError('');
    setActionOk('');
    setLookupLoading(true);
    try {
      const res = await lookupManagedBooking(reference.trim(), email.trim());
      setBooking(res.booking);
    } catch (err) {
      setBooking(null);
      setLookupError(apiErrorMessage(err, 'Booking not found. Check your reference code and email.'));
    } finally {
      setLookupLoading(false);
    }
  };

  const doCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    setActionError('');
    setActionOk('');
    setWorking(true);
    try {
      const res = await cancelManagedBooking(booking.reference_code, booking.customer.email);
      setBooking(res.booking);
      setActionOk('Your booking has been cancelled.');
    } catch (err) {
      // 422 inside the cutoff → the API message tells the caller to contact the salon.
      setActionError(apiErrorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  const doReschedule = async () => {
    setActionError('');
    setWorking(true);
    try {
      const res = await rescheduleManagedBooking(booking.reference_code, booking.customer.email, slot.date, slot.time);
      setBooking(res.booking);
      setRescheduling(false);
      setSlot(null);
      setActionOk(`Rescheduled to ${res.booking.date_label} at ${res.booking.time_label}.`);
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  const freeCancel = booking?.free_cancel_deadline
    ? new Date(booking.free_cancel_deadline).toLocaleString()
    : null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Manage your booking</h1>
      <p className="mt-1 text-sm text-slate-500">
        Enter your booking reference code and the email you booked with.
      </p>

      <form onSubmit={lookup} className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reference code" required>
            <TextInput
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="BK-XXXXXX"
              className="font-mono uppercase"
            />
          </Field>
          <Field label="Email" required>
            <TextInput
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              inputMode="email"
            />
          </Field>
        </div>
        {lookupError && (
          <div className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{lookupError}</div>
        )}
        <PrimaryButton type="submit" disabled={lookupLoading || !reference.trim() || !email.trim()} className="mt-4">
          {lookupLoading ? 'Looking up…' : 'Find my booking'}
        </PrimaryButton>
      </form>

      {booking && (
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-lg font-bold text-slate-900">{booking.reference_code}</p>
              <p className="mt-1 text-sm text-slate-500">
                {booking.service?.name} with {booking.staff?.name}
              </p>
            </div>
            <StatusBadge status={booking.status} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Date</dt>
              <dd className="font-semibold text-slate-900">{booking.date_label}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Time</dt>
              <dd className="font-semibold text-slate-900">{booking.time_label}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Price</dt>
              <dd className="font-semibold text-slate-900">{formatMoney(booking.price_cents, currency)}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Booked for</dt>
              <dd className="font-semibold text-slate-900">{booking.guest_name || booking.customer?.name}</dd>
            </div>
          </dl>

          {freeCancel && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
              Free cancellation until <strong>{freeCancel}</strong>
            </p>
          )}

          {actionOk && (
            <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{actionOk}</div>
          )}
          {actionError && (
            <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Please contact the salon</p>
              <p className="mt-1">{actionError}</p>
              {salonData?.salon?.phone && (
                <p className="mt-1 font-semibold">{salonData.salon.phone}</p>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            {booking.can_reschedule && (
              <SecondaryButton onClick={() => { setRescheduling(true); setSlot(null); }}>
                Reschedule
              </SecondaryButton>
            )}
            {booking.can_cancel && (
              <button
                onClick={doCancel}
                disabled={working}
                className="rounded-lg border border-rose-300 bg-white px-5 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                {working ? 'Working…' : 'Cancel booking'}
              </button>
            )}
            {!booking.can_cancel && !booking.can_reschedule && ['booked', 'confirmed'].includes(booking.status) && (
              <p className="w-full rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                This booking is inside the free-cancellation window. To change or cancel it, please
                contact the salon directly{salonData?.salon?.phone ? ` at ${salonData.salon.phone}` : ''}.
              </p>
            )}
          </div>
        </div>
      )}

      {rescheduling && booking && (
        <Modal title="Reschedule booking" onClose={() => setRescheduling(false)} wide>
          <SlotPicker
            serviceId={booking.service.id}
            staffId={booking.staff.id}
            value={slot}
            onChange={setSlot}
            timezoneLabel={timezoneLabel}
          />
          {slot?.time && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-600">
                New time: <strong>{slot.date}</strong> at <strong>{slot.time}</strong>
              </p>
              <PrimaryButton onClick={doReschedule} disabled={working}>
                {working ? 'Saving…' : 'Confirm new time'}
              </PrimaryButton>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
