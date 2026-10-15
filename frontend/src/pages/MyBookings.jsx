import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getSalon, getMyBookings, cancelMyBooking, rescheduleMyBooking } from '../api/salon.js';
import { useApi, apiErrorMessage } from '../hooks/useApi.js';
import { formatMoney } from '../utils/format.js';
import Loading from '../components/Loading.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';
import SlotPicker from '../components/SlotPicker.jsx';
import { PrimaryButton, SecondaryButton } from '../components/Fields.jsx';

function BookingCard({ booking, currency, onCancel, onReschedule, working }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{booking.service?.name}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {booking.date_label} · {booking.time_label} with {booking.staff?.name}
          </p>
          {booking.guest_name && (
            <p className="mt-0.5 text-xs text-slate-400">Guest: {booking.guest_name}</p>
          )}
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-sm font-bold text-slate-900">{formatMoney(booking.price_cents, currency)}</span>
        <div className="flex gap-2">
          {booking.can_reschedule && (
            <SecondaryButton onClick={() => onReschedule(booking)} className="px-3 py-1.5 text-xs">
              Reschedule
            </SecondaryButton>
          )}
          {booking.can_cancel && (
            <button
              onClick={() => onCancel(booking)}
              disabled={working}
              className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      {booking.free_cancel_deadline && (
        <p className="mt-2 text-xs text-slate-400">
          Free cancellation until {new Date(booking.free_cancel_deadline).toLocaleString()}
        </p>
      )}
    </div>
  );
}

export default function MyBookings() {
  const { data, loading, error, refetch } = useApi(getMyBookings, []);
  const { data: salonData } = useApi(getSalon, []);
  const [rescheduleFor, setRescheduleFor] = useState(null);
  const [slot, setSlot] = useState(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  const currency = salonData?.salon?.currency || 'USD';
  const timezoneLabel = salonData?.salon?.timezone_label;

  const handleCancel = async (booking) => {
    if (!window.confirm(`Cancel your ${booking.service?.name} on ${booking.date_label}?`)) return;
    setWorking(true);
    setNotice({ type: '', text: '' });
    try {
      await cancelMyBooking(booking.id);
      setNotice({ type: 'ok', text: 'Booking cancelled.' });
      refetch();
    } catch (err) {
      setNotice({ type: 'error', text: apiErrorMessage(err) });
    } finally {
      setWorking(false);
    }
  };

  const handleReschedule = async () => {
    if (!slot?.time) return;
    setWorking(true);
    try {
      await rescheduleMyBooking(rescheduleFor.id, slot.date, slot.time, slot.staffId);
      setRescheduleFor(null);
      setSlot(null);
      setNotice({ type: 'ok', text: 'Booking rescheduled.' });
      refetch();
    } catch (err) {
      setNotice({ type: 'error', text: apiErrorMessage(err) });
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <Loading label="Loading your bookings…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const upcoming = data?.upcoming || [];
  const past = data?.past || [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My bookings</h1>
        <Link to="/">
          <PrimaryButton>Book new</PrimaryButton>
        </Link>
      </div>

      {notice.text && (
        <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${notice.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>
          {notice.text}
        </div>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Upcoming ({upcoming.length})
      </h2>
      <div className="mt-3 space-y-3">
        {upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming appointments"
            hint="Treat yourself — browse the service menu and book in under a minute."
            action={<Link to="/"><PrimaryButton>Browse services</PrimaryButton></Link>}
          />
        ) : (
          upcoming.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              currency={currency}
              working={working}
              onCancel={handleCancel}
              onReschedule={(bk) => { setRescheduleFor(bk); setSlot(null); }}
            />
          ))
        )}
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Past ({past.length})
      </h2>
      <div className="mt-3 space-y-3">
        {past.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing here yet.</p>
        ) : (
          past.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">{b.service?.name}</p>
                <p className="text-xs text-slate-500">
                  {b.date_label} · {b.time_label} with {b.staff?.name}
                </p>
              </div>
              <StatusBadge status={b.status} />
            </div>
          ))
        )}
      </div>

      {rescheduleFor && (
        <Modal title={`Reschedule — ${rescheduleFor.service?.name}`} onClose={() => setRescheduleFor(null)} wide>
          <SlotPicker
            serviceId={rescheduleFor.service.id}
            staffId={null}
            value={slot}
            onChange={setSlot}
            timezoneLabel={timezoneLabel}
          />
          {slot?.time && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-600">
                New time: <strong>{slot.date}</strong> at <strong>{slot.time}</strong>
                {slot.staffName ? ` with ${slot.staffName}` : ''}
              </p>
              <PrimaryButton onClick={handleReschedule} disabled={working}>
                {working ? 'Saving…' : 'Confirm'}
              </PrimaryButton>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
