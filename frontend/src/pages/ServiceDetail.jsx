import { Link, useNavigate, useParams } from 'react-router-dom';
import { getSalon, getService } from '../api/salon.js';
import { useApi } from '../hooks/useApi.js';
import { formatDuration, formatMoney, timeLabel } from '../utils/format.js';
import Loading from '../components/Loading.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { PrimaryButton } from '../components/Fields.jsx';

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi(() => getService(id), [id]);
  const { data: salonData } = useApi(getSalon, []);

  if (loading) return <Loading label="Loading service…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} title="Service not found" />;

  const { service, staff, policy } = data;
  const currency = salonData?.salon?.currency || 'USD';

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/" className="text-sm font-medium text-slate-500 hover:text-rose-600">
        ← All services
      </Link>

      <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="bg-gradient-to-r from-rose-600 to-indigo-600 px-6 py-8 sm:px-10">
          <h1 className="text-3xl font-bold text-white">{service.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-white/20 px-3 py-1 font-medium text-white">
              {formatDuration(service.duration_minutes)}
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1 font-bold text-white">
              {service.price_display || formatMoney(service.price_cents, currency)}
            </span>
          </div>
        </div>

        <div className="px-6 py-8 sm:px-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">About this treatment</h2>
          <p className="mt-2 leading-relaxed text-slate-700">{service.description}</p>

          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Performed by
          </h2>
          {staff.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Our team will assign the best available specialist.</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {staff.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  {s.photo_url ? (
                    <img src={s.photo_url} alt={s.name} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-indigo-500 text-lg font-bold text-white">
                      {s.name.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{s.name}</p>
                    {s.bio && <p className="line-clamp-2 text-xs text-slate-500">{s.bio}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 rounded-xl bg-amber-50 px-5 py-4">
            <p className="text-sm font-semibold text-amber-900">Cancellation policy</p>
            <p className="mt-1 line-clamp-3 text-sm text-amber-800">
              Free cancellation up to {policy.free_cancellation_hours} hours before your appointment.{' '}
              {policy.text}
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PrimaryButton className="flex-1 py-3.5 text-base" onClick={() => navigate(`/book/${service.id}`)}>
              Book now — {service.price_display || formatMoney(service.price_cents, currency)}
            </PrimaryButton>
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">
            {salonData?.salon?.timezone_label || 'All times shown in Asia/Karachi'} · No payment taken today
          </p>
        </div>
      </div>
    </div>
  );
}
