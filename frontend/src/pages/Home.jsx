import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSalon, getServices } from '../api/salon.js';
import { useApi } from '../hooks/useApi.js';
import { formatDuration, formatMoney, timeLabel } from '../utils/format.js';
import Loading from '../components/Loading.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { TextInput } from '../components/Fields.jsx';

export default function Home() {
  const { data: salonData, loading: salonLoading } = useApi(getSalon, []);
  const { data, loading, error, refetch } = useApi(getServices, []);
  const [query, setQuery] = useState('');

  const salon = salonData?.salon;
  const currency = salon?.currency || 'USD';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.categories || []).map((cat) => ({
      ...cat,
      services: cat.services.filter(
        (s) => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.services.length > 0);
  }, [data, query]);

  const totalServices = (data?.categories || []).reduce((n, c) => n + c.services.length, 0);

  return (
    <div>
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600 via-rose-500 to-indigo-600 px-6 py-14 text-white sm:px-12">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-rose-100">Karachi · Since 2016</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
            {salonLoading ? 'Welcome' : salon?.name || 'Glow & Grace Salon'}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-rose-50">
            Hair, skin and nails — done properly. Book online in under a minute, pick your
            favourite stylist, and we will take care of the rest.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-rose-50">
            {salon?.address && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {salon.address}
              </span>
            )}
            {salon?.opening_hours?.[0]?.open && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mon–Sat · {timeLabel(salon.opening_hours[0].open)} – {timeLabel(salon.opening_hours[0].close)}
              </span>
            )}
          </div>
          <a
            href="#services"
            className="mt-8 inline-block rounded-xl bg-white px-7 py-3.5 text-base font-bold text-rose-700 shadow-lg transition-transform hover:scale-[1.02]"
          >
            Book an appointment
          </a>
        </div>
      </section>

      {/* Catalog */}
      <section id="services" className="mt-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Services & pricing</h2>
            <p className="mt-1 text-sm text-slate-500">
              {totalServices} treatments · {salon?.timezone_label || 'All times shown in Asia/Karachi'}
            </p>
          </div>
          <div className="w-full sm:w-80">
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search treatments… e.g. facial"
              aria-label="Search services"
            />
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <Loading label="Loading services…" />
          ) : error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : filtered.length === 0 ? (
            <div className="rounded-xl bg-white px-6 py-12 text-center text-sm text-slate-500">
              No treatments match “{query}”. Try a different search.
            </div>
          ) : (
            filtered.map((cat) => (
              <div key={cat.id} className="mb-10">
                <h3 className="flex items-center gap-3 text-lg font-bold text-slate-900">
                  <span className="h-6 w-1.5 rounded-full bg-gradient-to-b from-rose-500 to-indigo-500" />
                  {cat.name}
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cat.services.map((s) => (
                    <Link
                      key={s.id}
                      to={`/services/${s.id}`}
                      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-lg"
                    >
                      <h4 className="font-semibold text-slate-900 group-hover:text-rose-700">{s.name}</h4>
                      <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-slate-500">{s.description}</p>
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="text-sm text-slate-500">{formatDuration(s.duration_minutes)}</span>
                        <span className="text-lg font-bold text-slate-900">
                          {s.price_display || formatMoney(s.price_cents, currency)}
                        </span>
                      </div>
                      <span className="mt-3 inline-flex items-center justify-center rounded-lg bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors group-hover:bg-rose-600 group-hover:text-white">
                        View & book →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
