import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { formatMoney } from '../utils/format.js';
import { PrimaryButton } from '../components/Fields.jsx';

function BookingSummary({ booking }) {
  const freeCancel = booking.free_cancel_deadline
    ? new Date(booking.free_cancel_deadline).toLocaleString()
    : null;
  return (
    <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
      {[
        ['Treatment', booking.service?.name],
        ['Specialist', booking.staff?.name],
        ['Date', booking.date_label],
        ['Time', `${booking.time_label} (${booking.timezone || 'Asia/Karachi'})`],
        ['Price', formatMoney(booking.price_cents)],
        ['Booked for', booking.guest_name ? `${booking.guest_name} (guest of ${booking.customer?.name})` : booking.customer?.name],
        ['Contact', `${booking.customer?.phone} · ${booking.customer?.email}`],
      ].map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-4 px-5 py-3.5">
          <dt className="text-sm text-slate-500">{k}</dt>
          <dd className="text-right text-sm font-semibold text-slate-900">{v}</dd>
        </div>
      ))}
      {freeCancel && (
        <div className="flex items-center justify-between gap-4 bg-emerald-50 px-5 py-3.5">
          <dt className="text-sm font-medium text-emerald-800">Free cancellation until</dt>
          <dd className="text-right text-sm font-bold text-emerald-900">{freeCancel}</dd>
        </div>
      )}
    </dl>
  );
}

export default function Confirmation() {
  const { reference } = useParams();
  const location = useLocation();
  const [booking] = useState(() => {
    if (location.state?.booking) return location.state.booking;
    try {
      const raw = sessionStorage.getItem(`booking:${reference}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  if (!booking) {
    return (
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Booking reference: {reference}</h1>
        <p className="mt-2 text-sm text-slate-500">
          We could not load the booking details on this device. Use “Manage booking” with your
          reference code and email to view it.
        </p>
        <Link to="/manage">
          <PrimaryButton className="mt-6">Manage booking</PrimaryButton>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 px-6 py-10 text-center text-white sm:px-12">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-3xl">
          ✓
        </span>
        <h1 className="mt-4 text-3xl font-bold">You&apos;re booked!</h1>
        <p className="mt-2 text-emerald-50">
          A confirmation has been sent to {booking.customer?.email}. We look forward to seeing you.
        </p>
        <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-emerald-100">
          Your booking reference
        </p>
        <p className="mt-1 font-mono text-4xl font-bold tracking-wider">{booking.reference_code}</p>
        <p className="mt-2 text-xs text-emerald-100">Keep this code — you will need it to manage your booking.</p>
      </div>

      <div className="mt-6">
        <BookingSummary booking={booking} />
      </div>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Good to know</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Please arrive 10 minutes early so we can start on time.</li>
          <li>
            Need to change anything? Use your reference code and email on the{' '}
            <Link to="/manage" className="font-semibold text-rose-600 hover:text-rose-700">
              manage booking
            </Link>{' '}
            page — free cancellation up to 24 hours before.
          </li>
          <li>Running late? Call us and we will do our best to accommodate you.</li>
        </ul>
      </div>

      <div className="mt-6 text-center">
        <Link to="/" className="text-sm font-semibold text-rose-600 hover:text-rose-700">
          ← Back to services
        </Link>
      </div>
    </div>
  );
}
