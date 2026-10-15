import { useMemo, useState } from 'react';
import { getAvailability, getAvailabilityCalendar } from '../api/salon.js';
import { useApi } from '../hooks/useApi.js';
import { addDaysYMD, dayShort, prettyDate, timeLabel, todayYMD } from '../utils/format.js';
import Loading from './Loading.jsx';
import ErrorState from './ErrorState.jsx';

/**
 * SlotPicker — reusable date + time picker.
 * Props: serviceId (required), staffId (null = any available),
 *        value {date, time, staffId}, onChange(selection|null),
 *        timezoneLabel (from salon), compact?
 */
export default function SlotPicker({ serviceId, staffId = null, value, onChange, timezoneLabel }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = todayYMD();

  const weekStart = useMemo(() => addDaysYMD(today, weekOffset * 7), [today, weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysYMD(weekStart, i)), [weekStart]);
  const rangeTo = useMemo(() => addDaysYMD(weekStart, 6), [weekStart]);

  const {
    data: calendar,
    loading: calLoading,
    error: calError,
    refetch: refetchCal,
  } = useApi(() => getAvailabilityCalendar(serviceId, staffId, weekStart, rangeTo), [
    serviceId,
    staffId,
    weekStart,
    rangeTo,
  ]);

  const {
    data: day,
    loading: dayLoading,
    error: dayError,
    refetch: refetchDay,
  } = useApi(
    () => (value?.date ? getAvailability(serviceId, staffId, value.date) : Promise.resolve(null)),
    [serviceId, staffId, value?.date]
  );

  const slotsByTime = useMemo(() => {
    if (!day?.slots) return [];
    const map = new Map();
    for (const s of day.slots) {
      if (!map.has(s.time)) map.set(s.time, []);
      map.get(s.time).push(s);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [day]);

  const pickDay = (ymd) => onChange({ date: ymd, time: null, staffId: null });

  return (
    <div>
      {/* Week strip */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setWeekOffset((o) => o - 1)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          ← Prev
        </button>
        <p className="text-sm font-semibold text-slate-700">
          {prettyDate(weekStart)} – {prettyDate(rangeTo)}
        </p>
        <button
          type="button"
          onClick={() => setWeekOffset((o) => o + 1)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Next →
        </button>
      </div>

      {calLoading ? (
        <div className="py-6 text-center text-sm text-slate-500">Loading calendar…</div>
      ) : calError ? (
        <ErrorState error={calError} onRetry={refetchCal} />
      ) : (
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {weekDays.map((ymd) => {
            const info = calendar?.days?.[ymd];
            const isPast = ymd < today;
            const disabled = isPast || !info?.available;
            const selected = value?.date === ymd;
            const d = new Date(ymd + 'T12:00:00');
            return (
              <button
                key={ymd}
                type="button"
                disabled={disabled}
                onClick={() => pickDay(ymd)}
                title={info ? `${info.slots_count} slots` : ''}
                className={`flex flex-col items-center rounded-xl border px-1 py-2.5 text-sm transition-colors ${
                  selected
                    ? 'border-rose-600 bg-rose-600 text-white'
                    : disabled
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50'
                }`}
              >
                <span className="text-[11px] font-medium uppercase">{dayShort(ymd)}</span>
                <span className="mt-0.5 text-base font-bold">{d.getDate()}</span>
                {!disabled && info && (
                  <span className={`mt-0.5 text-[10px] ${selected ? 'text-rose-100' : 'text-emerald-600'}`}>
                    {info.slots_count} open
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Time slots */}
      {value?.date && (
        <div className="mt-5">
          {dayLoading ? (
            <Loading label="Loading available times…" />
          ) : dayError ? (
            <ErrorState error={dayError} onRetry={refetchDay} />
          ) : slotsByTime.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No times available on {prettyDate(value.date)}. Please pick another day.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {slotsByTime.map(([time, slots]) => {
                  const selected = value?.time === time;
                  const staffNames = [...new Set(slots.map((s) => s.staff_name))].join(', ');
                  return (
                    <button
                      key={time}
                      type="button"
                      title={staffId ? '' : `Available with: ${staffNames}`}
                      onClick={() =>
                        onChange({ date: value.date, time, staffId: staffId || slots[0].staff_id, staffName: slots[0].staff_name })
                      }
                      className={`rounded-lg border px-2 py-2.5 text-sm font-semibold transition-colors ${
                        selected
                          ? 'border-rose-600 bg-rose-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50'
                      }`}
                    >
                      {timeLabel(time)}
                      {!staffId && (
                        <span className={`block truncate text-[10px] font-normal ${selected ? 'text-rose-100' : 'text-slate-400'}`}>
                          {staffNames}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {timezoneLabel && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {timezoneLabel}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
