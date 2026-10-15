/** Shared formatting helpers. Times arrive from the API with *_local, date_label
 *  and time_label fields — always prefer those over client-side conversion. */

export function formatMoney(priceCents, currency = 'USD') {
  const amount = (priceCents || 0) / 100;
  if (currency === 'PKR') return `Rs ${amount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (currency === 'USD') return `$${amount.toFixed(2)}`;
  if (currency === 'GBP') return `£${amount.toFixed(2)}`;
  if (currency === 'EUR') return `€${amount.toFixed(2)}`;
  return `${currency} ${amount.toFixed(2)}`;
}

export function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? '1 hr' : `${h} hrs`;
  return `${h} hr ${m} min`;
}

/** "2026-10-20" → Date at local noon (avoids TZ edge shifts). */
export function ymdToDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/** Date → "2026-10-20". */
export function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysYMD(ymd, n) {
  const d = ymdToDate(ymd);
  d.setDate(d.getDate() + n);
  return toYMD(d);
}

export function todayYMD() {
  return toYMD(new Date());
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayShort(ymd) {
  return DAY_NAMES[ymdToDate(ymd).getDay()];
}

export function dayFull(ymd) {
  return DAY_FULL[ymdToDate(ymd).getDay()];
}

export function prettyDate(ymd) {
  const d = ymdToDate(ymd);
  return `${DAY_NAMES[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "14:30" → "2:30 PM" */
export function timeLabel(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}
