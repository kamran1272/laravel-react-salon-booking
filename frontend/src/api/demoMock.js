/**
 * Demo-mode API mock — full implementation of API-CONTRACT.md v1.
 *
 * Active only when the build sets VITE_DEMO_MODE=true (public GitHub Pages
 * preview). Mirrors every contract endpoint with in-memory data for the
 * "Glow & Grace Salon" demo: 3 categories, 8 services, 3 staff with working
 * hours, bookings across past/today/future in all statuses, customers,
 * time-off, blockouts and notifications.
 *
 * Slot generation honours the contract rules: slot_step_minutes steps,
 * lead_time_minutes lead time, booking_window_days window, no past slots,
 * staff working hours, overlap checks against live bookings, time-off and
 * blockouts. All datetimes are ISO 8601 UTC; display labels are computed
 * for the salon timezone (Asia/Karachi, UTC+5, no DST).
 */

/* ------------------------------------------------------------------ */
/* Time helpers (Karachi = UTC+5, no DST)                              */
/* ------------------------------------------------------------------ */

const KHI_OFFSET_MIN = 5 * 60;

const pad = (n) => String(n).padStart(2, '0');
const iso = (ms) => new Date(ms).toISOString();

function khiShift(ms) {
  return new Date(ms + KHI_OFFSET_MIN * 60000);
}
function ymdOf(ms) {
  const d = khiShift(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function hmOf(ms) {
  const d = khiShift(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function dowOf(ms) {
  return khiShift(ms).getUTCDay(); // 0 = Sunday
}
function msOfYmdHm(ymd, hhmm) {
  const [Y, M, D] = ymd.split('-').map(Number);
  const [h, m] = hhmm.split(':').map(Number);
  return Date.UTC(Y, M - 1, D, h, m) - KHI_OFFSET_MIN * 60000;
}
function hmToMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function minToHm(min) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}
function localYmdToDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateLabel(ms) {
  const d = khiShift(ms);
  return `${DAY_SHORT[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
function timeLabelOf(ms) {
  const d = khiShift(ms);
  let h = d.getUTCHours();
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${pad(d.getUTCMinutes())} ${suffix}`;
}
function startsAtLocal(ms) {
  return `${ymdOf(ms)} ${hmOf(ms)}`;
}

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

const SETTINGS = {
  salon_name: 'Glow & Grace Salon',
  timezone: 'Asia/Karachi',
  timezone_label: 'All times shown in Asia/Karachi',
  currency: 'USD',
  phone: '+92 21 34567890',
  email: 'hello@glowgrace.pk',
  address: '24-C Khayaban-e-Ittehad, DHA Phase 6, Karachi, Pakistan',
  booking_window_days: 42,
  lead_time_minutes: 120,
  slot_step_minutes: 15,
  free_cancellation_hours: 24,
  cancellation_policy_text:
    'Life happens — we get it. You can cancel or reschedule free of charge up to 24 hours before your appointment. ' +
    'Cancellations within 24 hours of the appointment time, or no-shows, may be charged 50% of the service price. ' +
    'Please arrive 10 minutes early so we can start your treatment on time. If you are running more than 15 minutes late, ' +
    'we may need to shorten or reschedule your service.',
  opening_hours: [
    { day: 'Monday', open: '10:00', close: '19:00' },
    { day: 'Tuesday', open: '10:00', close: '19:00' },
    { day: 'Wednesday', open: '10:00', close: '19:00' },
    { day: 'Thursday', open: '10:00', close: '19:00' },
    { day: 'Friday', open: '10:00', close: '19:00' },
    { day: 'Saturday', open: '10:00', close: '19:00' },
    { day: 'Sunday', open: null, close: null },
  ],
};

const CATEGORIES = [
  { id: 1, name: 'Hair', sort_order: 1, active: true },
  { id: 2, name: 'Skin & Facials', sort_order: 2, active: true },
  { id: 3, name: 'Nails & Makeup', sort_order: 3, active: true },
];

const SERVICES = [
  {
    id: 1, name: 'Signature Haircut & Styling', category_id: 1,
    description: 'A precision cut tailored to your face shape and lifestyle, finished with a luxurious wash, blow-dry and styling. Includes a complimentary consultation with our senior stylist.',
    duration_minutes: 45, buffer_minutes: 10, price_cents: 2500, bookable_online: true, is_active: true,
  },
  {
    id: 2, name: 'Full Hair Colouring', category_id: 1,
    description: 'Complete colour transformation using premium ammonia-free colour. Includes pre-colour consultation, colour application, gloss treatment and styling. Patch test required 48 hours before first visit.',
    duration_minutes: 120, buffer_minutes: 15, price_cents: 6500, bookable_online: true, is_active: true,
  },
  {
    id: 3, name: 'Keratin Smoothening Treatment', category_id: 1,
    description: 'Frizz-free, mirror-shine hair for up to 4 months. Our formaldehyde-free keratin treatment smooths and repairs, cutting your daily styling time in half.',
    duration_minutes: 90, buffer_minutes: 15, price_cents: 8000, bookable_online: true, is_active: true,
  },
  {
    id: 4, name: 'Classic Deep-Cleanse Facial', category_id: 2,
    description: 'A 60-minute reset for tired skin: double cleanse, exfoliation, extractions, relaxing massage and a custom mask matched to your skin type.',
    duration_minutes: 60, buffer_minutes: 10, price_cents: 4000, bookable_online: true, is_active: true,
  },
  {
    id: 5, name: 'Hydra Glow Facial', category_id: 2,
    description: 'Our signature red-carpet facial. Hydra-dermabrasion, oxygen infusion and LED light therapy leave skin plump, dewy and glowing for days.',
    duration_minutes: 75, buffer_minutes: 10, price_cents: 5500, bookable_online: true, is_active: true,
  },
  {
    id: 6, name: 'Luxury Manicure & Pedicure', category_id: 3,
    description: 'Soak, exfoliate, massage and perfect polish. Includes cuticle care, callus treatment and your choice of over 80 premium shades.',
    duration_minutes: 90, buffer_minutes: 10, price_cents: 3500, bookable_online: true, is_active: true,
  },
  {
    id: 7, name: 'Gel Nail Extensions', category_id: 3,
    description: 'Salon-perfect length and shape with lightweight gel extensions, finished with art or a classic French tip. Lasts 3–4 weeks with proper care.',
    duration_minutes: 75, buffer_minutes: 10, price_cents: 4500, bookable_online: true, is_active: true,
  },
  {
    id: 8, name: 'Party Makeup', category_id: 3,
    description: 'Camera-ready glam for your big night out. Long-wear base, sculpted features and lashes included. Trial recommended for bridal parties.',
    duration_minutes: 60, buffer_minutes: 15, price_cents: 5000, bookable_online: true, is_active: true,
  },
];

/* Users double as staff profiles (role staff) and login accounts. */
const USERS = [
  { id: 1, name: 'Salon Admin', email: 'admin@demo.io', phone: '+92 300 0000001', role: 'admin', photo_url: '', bio: '' },
  {
    id: 2, name: 'Maria Santos', email: 'maria@demo.io', phone: '+92 300 1112233', role: 'staff',
    bio: 'Senior stylist with 9 years of experience in precision cutting and colour correction.',
    photo_url: '', bookable_online: true, service_ids: [1, 2, 3],
  },
  {
    id: 3, name: 'James Carter', email: 'james@demo.io', phone: '+92 300 4445566', role: 'staff',
    bio: 'Licensed aesthetician specialising in hydra-facials and sensitive-skin treatments.',
    photo_url: '', bookable_online: true, service_ids: [4, 5],
  },
  {
    id: 4, name: 'Ayesha Raza', email: 'ayesha@demo.io', phone: '+92 300 7778899', role: 'staff',
    bio: 'Nail artist and makeup specialist known for detailed nail art and soft-glam looks.',
    photo_url: '', bookable_online: true, service_ids: [6, 7, 8],
  },
  {
    id: 10, name: 'Demo Customer', email: 'customer@demo.io', phone: '+92 321 9998888', role: 'customer',
    photo_url: '', bio: '',
  },
];

let WORKING_HOURS = [
  // Sana — Mon–Sat 10:00–19:00
  ...[1, 2, 3, 4, 5, 6].map((d, i) => ({ id: 10 + i, user_id: 2, day_of_week: d, start_time: '10:00', end_time: '19:00' })),
  // Mahnoor — Mon–Fri 10:00–18:00, Sat 11:00–17:00
  ...[1, 2, 3, 4, 5].map((d, i) => ({ id: 20 + i, user_id: 3, day_of_week: d, start_time: '10:00', end_time: '18:00' })),
  { id: 26, user_id: 3, day_of_week: 6, start_time: '11:00', end_time: '17:00' },
  // Ayesha — Tue–Sat, split shift on Wednesdays (two windows)
  { id: 30, user_id: 4, day_of_week: 2, start_time: '11:00', end_time: '19:00' },
  { id: 31, user_id: 4, day_of_week: 3, start_time: '11:00', end_time: '15:00' },
  { id: 32, user_id: 4, day_of_week: 3, start_time: '16:00', end_time: '19:00' },
  { id: 33, user_id: 4, day_of_week: 4, start_time: '11:00', end_time: '19:00' },
  { id: 34, user_id: 4, day_of_week: 5, start_time: '11:00', end_time: '19:00' },
  { id: 35, user_id: 4, day_of_week: 6, start_time: '11:00', end_time: '19:00' },
];

const CUSTOMERS = [
  { id: 101, name: 'Ayesha Khan', email: 'ayesha.k@example.com', phone: '+92 300 1234567', notes: 'Prefers morning slots. Allergic to latex gloves.', created_at: iso(Date.now() - 90 * 864e5) },
  { id: 102, name: 'Bilal Ahmed', email: 'bilal.a@example.com', phone: '+92 321 2345678', notes: '', created_at: iso(Date.now() - 75 * 864e5) },
  { id: 103, name: 'Chen Wei', email: 'chen.w@example.com', phone: '+92 333 3456789', notes: 'First-time visitor — gave a tour of the salon.', created_at: iso(Date.now() - 60 * 864e5) },
  { id: 104, name: 'Dana Smith', email: 'dana.s@example.com', phone: '+92 344 4567890', notes: '', created_at: iso(Date.now() - 45 * 864e5) },
  { id: 105, name: 'Elena Petrova', email: 'elena.p@example.com', phone: '+92 355 5678901', notes: 'Bridal package enquiry for December.', created_at: iso(Date.now() - 30 * 864e5) },
  { id: 106, name: 'Fahad Malik', email: 'fahad.m@example.com', phone: '+92 366 6789012', notes: '', created_at: iso(Date.now() - 20 * 864e5) },
  { id: 107, name: 'Grace Lee', email: 'grace.l@example.com', phone: '+92 377 7890123', notes: 'Sensitive skin — patch test everything.', created_at: iso(Date.now() - 12 * 864e5) },
  { id: 108, name: 'Hassan Raza', email: 'hassan.r@example.com', phone: '+92 388 8901234', notes: '', created_at: iso(Date.now() - 8 * 864e5) },
  { id: 109, name: 'Iqra Naveed', email: 'iqra.n@example.com', phone: '+92 399 9012345', notes: '', created_at: iso(Date.now() - 3 * 864e5) },
  { id: 110, name: 'Demo Customer', email: 'customer@demo.io', phone: '+92 321 9998888', notes: '', created_at: iso(Date.now() - 5 * 864e5) },
];

/* ---------------- Bookings ---------------- */

const BOOKINGS = [];
let nextBookingId = 1;
let nextCustomerId = 200;
const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeReference() {
  let s = '';
  for (let i = 0; i < 6; i++) s += REF_CHARS[Math.floor(Math.random() * REF_CHARS.length)];
  return `BK-${s}`;
}

function seedBooking({ dayOffset, time, serviceId, staffId, customerId, status, source = 'online', notes = '', guestName = null, cancelledAtOffsetHrs = null }) {
  const svc = SERVICES.find((s) => s.id === serviceId);
  const now = Date.now();
  const todayYmd = ymdOf(now);
  const targetYmd = (() => {
    const d = localYmdToDate(todayYmd);
    d.setDate(d.getDate() + dayOffset);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();
  const startsAt = msOfYmdHm(targetYmd, time);
  const endsAt = startsAt + (svc.duration_minutes + svc.buffer_minutes) * 60000;
  const cust = CUSTOMERS.find((c) => c.id === customerId);
  const createdAt = Math.min(now - 2 * 864e5, startsAt - 26 * 36e5);
  const booking = {
    id: nextBookingId++,
    reference_code: makeReference(),
    status,
    source,
    starts_at: startsAt,
    ends_at: endsAt,
    service_id: serviceId,
    staff_id: staffId,
    customer_id: cust ? cust.id : null,
    customer: cust ? { name: cust.name, phone: cust.phone, email: cust.email } : { name: 'Walk-in guest', phone: '', email: '' },
    guest_name: guestName,
    notes,
    price_cents: svc.price_cents,
    cancel_reason: null,
    cancelled_at: null,
    status_history: [{ from: null, to: 'booked', changed_by: 'system', changed_at: iso(createdAt) }],
    created_at: createdAt,
  };
  if (status !== 'booked') {
    booking.status_history.push({
      from: 'booked', to: status, changed_by: status === 'cancelled' ? 'customer' : 'staff',
      changed_at: iso(status === 'cancelled' && cancelledAtOffsetHrs != null ? startsAt - cancelledAtOffsetHrs * 36e5 : Math.min(now, startsAt)),
    });
  }
  if (status === 'confirmed') {
    booking.status_history.push({ from: 'booked', to: 'confirmed', changed_by: 'staff', changed_at: iso(createdAt + 36e5) });
  }
  if (status === 'cancelled' && cancelledAtOffsetHrs != null) {
    booking.cancelled_at = startsAt - cancelledAtOffsetHrs * 36e5;
    booking.cancel_reason = cancelledAtOffsetHrs < SETTINGS.free_cancellation_hours ? 'Cancelled by customer' : 'Cancelled by customer (late)';
  }
  BOOKINGS.push(booking);
  return booking;
}

function seedAll() {
  const C = (i) => CUSTOMERS[i].id;
  // Past — completed / no_show / cancelled
  seedBooking({ dayOffset: -14, time: '11:00', serviceId: 1, staffId: 2, customerId: C(0), status: 'completed' });
  seedBooking({ dayOffset: -14, time: '15:00', serviceId: 4, staffId: 3, customerId: C(1), status: 'completed' });
  seedBooking({ dayOffset: -9, time: '12:30', serviceId: 6, staffId: 4, customerId: C(2), status: 'no_show' });
  seedBooking({ dayOffset: -9, time: '17:00', serviceId: 2, staffId: 2, customerId: C(3), status: 'completed' });
  seedBooking({ dayOffset: -7, time: '10:30', serviceId: 5, staffId: 3, customerId: C(4), status: 'completed' });
  seedBooking({ dayOffset: -6, time: '14:00', serviceId: 1, staffId: 2, customerId: C(5), status: 'cancelled', cancelledAtOffsetHrs: 50 });
  seedBooking({ dayOffset: -5, time: '16:00', serviceId: 7, staffId: 4, customerId: C(6), status: 'completed' });
  seedBooking({ dayOffset: -3, time: '11:30', serviceId: 3, staffId: 2, customerId: C(0), status: 'completed' });
  seedBooking({ dayOffset: -3, time: '13:00', serviceId: 8, staffId: 4, customerId: C(7), status: 'no_show' });
  seedBooking({ dayOffset: -2, time: '10:00', serviceId: 4, staffId: 3, customerId: C(8), status: 'cancelled', cancelledAtOffsetHrs: 5 });
  seedBooking({ dayOffset: -1, time: '15:30', serviceId: 6, staffId: 4, customerId: C(1), status: 'completed' });
  seedBooking({ dayOffset: -1, time: '17:30', serviceId: 1, staffId: 2, customerId: C(9), status: 'completed', notes: 'Booked from the demo customer account.' });
  // Today — mix around "now" (times are Karachi-local; morning ones read as past, evening as upcoming)
  seedBooking({ dayOffset: 0, time: '10:30', serviceId: 1, staffId: 2, customerId: C(2), status: 'completed' });
  seedBooking({ dayOffset: 0, time: '12:00', serviceId: 5, staffId: 3, customerId: C(3), status: 'confirmed' });
  seedBooking({ dayOffset: 0, time: '14:30', serviceId: 6, staffId: 4, customerId: C(4), status: 'booked' });
  seedBooking({ dayOffset: 0, time: '16:00', serviceId: 2, staffId: 2, customerId: C(5), status: 'confirmed', notes: 'Wants a consultation about going copper first.' });
  seedBooking({ dayOffset: 0, time: '17:30', serviceId: 7, staffId: 4, customerId: C(9), status: 'booked', notes: 'Demo customer evening slot.' });
  // Future
  seedBooking({ dayOffset: 1, time: '11:00', serviceId: 4, staffId: 3, customerId: C(6), status: 'confirmed' });
  seedBooking({ dayOffset: 1, time: '15:00', serviceId: 3, staffId: 2, customerId: C(0), status: 'booked' });
  seedBooking({ dayOffset: 2, time: '10:00', serviceId: 8, staffId: 4, customerId: C(7), status: 'booked', guestName: 'Sana Tariq', notes: 'Booking for a friend — guest name provided.' });
  seedBooking({ dayOffset: 3, time: '13:30', serviceId: 1, staffId: 2, customerId: C(8), status: 'confirmed' });
  seedBooking({ dayOffset: 5, time: '12:00', serviceId: 5, staffId: 3, customerId: C(4), status: 'booked' });
  seedBooking({ dayOffset: 7, time: '16:30', serviceId: 6, staffId: 4, customerId: C(2), status: 'booked' });
  seedBooking({ dayOffset: 10, time: '11:30', serviceId: 2, staffId: 2, customerId: C(1), status: 'booked' });
  seedBooking({ dayOffset: 14, time: '14:00', serviceId: 4, staffId: 3, customerId: C(9), status: 'booked', notes: 'Demo customer future facial.' });
  seedBooking({ dayOffset: 21, time: '10:30', serviceId: 7, staffId: 4, customerId: C(5), status: 'booked' });
  seedBooking({ dayOffset: 30, time: '15:00', serviceId: 3, staffId: 2, customerId: C(3), status: 'booked' });
}
seedAll();

/* ---------------- Time-off / blockouts / notifications ---------------- */

let TIME_OFF = [
  {
    id: 1, user_id: 3, staff_name: 'Mahnoor Asif', type: 'vacation',
    starts_at: msOfYmdHm(ymdOf(Date.now() + 9 * 864e5), '10:00'),
    ends_at: msOfYmdHm(ymdOf(Date.now() + 11 * 864e5), '18:00'),
    note: 'Family wedding in Lahore.', status: 'approved',
  },
  {
    id: 2, user_id: 4, staff_name: 'Ayesha Raza', type: 'sick',
    starts_at: msOfYmdHm(ymdOf(Date.now() + 4 * 864e5), '11:00'),
    ends_at: msOfYmdHm(ymdOf(Date.now() + 4 * 864e5), '19:00'),
    note: '', status: 'pending',
  },
];
let nextTimeOffId = 3;

let BLOCKOUTS = [
  {
    id: 1, staff_id: null, staff_name: null,
    starts_at: msOfYmdHm(ymdOf(Date.now() + 16 * 864e5), '10:00'),
    ends_at: msOfYmdHm(ymdOf(Date.now() + 16 * 864e5), '14:00'),
    reason: 'Deep-cleaning morning — salon opens at 2 PM.', blocks_online_booking: true,
  },
];
let nextBlockoutId = 2;

const NOTIFICATIONS = [];
let nextNotifId = 1;
function seedNotification(bookingId, type, channel, scheduledFor, sentAt) {
  NOTIFICATIONS.push({
    id: nextNotifId++, booking_id: bookingId, type, channel,
    scheduled_for: iso(scheduledFor), sent_at: sentAt ? iso(sentAt) : null,
    status: sentAt ? 'sent' : 'queued',
  });
}
(function seedNotifications() {
  const upcoming = BOOKINGS.filter((b) => b.starts_at > Date.now() && (b.status === 'booked' || b.status === 'confirmed')).slice(0, 6);
  upcoming.forEach((b) => {
    seedNotification(b.id, 'booking_confirmation', 'email', b.created_at + 6e4, b.created_at + 9e4);
    seedNotification(b.id, 'reminder_24h', 'sms', b.starts_at - 24 * 36e5, null);
  });
  const past = BOOKINGS.filter((b) => b.status === 'completed').slice(0, 3);
  past.forEach((b) => {
    seedNotification(b.id, 'booking_confirmation', 'email', b.created_at + 6e4, b.created_at + 9e4);
    seedNotification(b.id, 'reminder_24h', 'sms', b.starts_at - 24 * 36e5, b.starts_at - 24 * 36e5 + 6e4);
  });
})();

/* ------------------------------------------------------------------ */
/* Booking resource                                                    */
/* ------------------------------------------------------------------ */

const TERMINAL = ['completed', 'cancelled', 'no_show'];
const ACTIVE = ['booked', 'confirmed'];

function freeCancelDeadline(booking) {
  return booking.starts_at - SETTINGS.free_cancellation_hours * 36e5;
}

function toBookingResource(b) {
  const svc = SERVICES.find((s) => s.id === b.service_id) || {};
  const staff = USERS.find((u) => u.id === b.staff_id) || {};
  const now = Date.now();
  const deadline = freeCancelDeadline(b);
  const live = ACTIVE.includes(b.status) && b.starts_at > now;
  return {
    id: b.id,
    reference_code: b.reference_code,
    status: b.status,
    source: b.source,
    starts_at: iso(b.starts_at),
    ends_at: iso(b.ends_at),
    starts_at_local: startsAtLocal(b.starts_at),
    date_label: dateLabel(b.starts_at),
    time_label: timeLabelOf(b.starts_at),
    timezone: SETTINGS.timezone,
    duration_minutes: svc.duration_minutes,
    service: { id: svc.id, name: svc.name, duration_minutes: svc.duration_minutes, price_cents: b.price_cents },
    staff: { id: staff.id, name: staff.name },
    customer: { id: b.customer_id, name: b.customer.name, phone: b.customer.phone, email: b.customer.email },
    guest_name: b.guest_name,
    notes: b.notes,
    price_cents: b.price_cents,
    free_cancel_deadline: live ? iso(deadline) : null,
    can_cancel: live && now < deadline,
    can_reschedule: live && now < deadline,
    late_cancel: b.status === 'cancelled' && b.cancelled_at != null && b.cancelled_at > deadline,
    cancel_reason: b.cancel_reason,
    status_history: b.status_history,
    created_at: iso(b.created_at),
  };
}

/* ------------------------------------------------------------------ */
/* Slot engine                                                         */
/* ------------------------------------------------------------------ */

function salonOpenOn(dow) {
  const entry = SETTINGS.opening_hours[dow === 0 ? 6 : dow - 1]; // opening_hours is Monday-first
  return entry && entry.open ? entry : null;
}

function staffWindows(userId, dow) {
  return WORKING_HOURS.filter((w) => w.user_id === userId && w.day_of_week === dow)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

function bookingOverlaps(staffId, startMs, endMs, ignoreId = null) {
  return BOOKINGS.some(
    (b) =>
      b.id !== ignoreId &&
      b.staff_id === staffId &&
      ACTIVE.includes(b.status) &&
      startMs < b.ends_at &&
      endMs > b.starts_at
  );
}

function blockedByTimeOff(staffId, startMs, endMs) {
  return TIME_OFF.some(
    (t) =>
      t.user_id === staffId &&
      t.status === 'approved' &&
      startMs < t.ends_at &&
      endMs > t.starts_at
  );
}

function blockedByBlockout(staffId, startMs, endMs) {
  return BLOCKOUTS.some(
    (bl) =>
      bl.blocks_online_booking &&
      (bl.staff_id == null || bl.staff_id === staffId) &&
      startMs < bl.ends_at &&
      endMs > bl.starts_at
  );
}

/**
 * All bookable slots for a service on a Karachi-local date (Y-m-d).
 * staffId null = "any available": merged across eligible staff, each slot
 * tagged with the staff member who would take it.
 */
function slotsFor(serviceId, staffId, ymd, ignoreBookingId = null) {
  const svc = SERVICES.find((s) => s.id === serviceId && s.is_active);
  if (!svc) return [];
  const dow = localYmdToDate(ymd).getDay();
  if (!salonOpenOn(dow)) return [];
  const totalMin = svc.duration_minutes + svc.buffer_minutes;
  const eligible = USERS.filter(
    (u) => u.role === 'staff' && u.bookable_online && u.service_ids.includes(serviceId) && (!staffId || u.id === staffId)
  );
  const now = Date.now();
  const leadMs = SETTINGS.lead_time_minutes * 60000;
  const windowEndMs = now + SETTINGS.booking_window_days * 864e5;
  const out = [];
  for (const st of eligible) {
    for (const w of staffWindows(st.id, dow)) {
      const wStart = hmToMin(w.start_time);
      const wEnd = hmToMin(w.end_time);
      for (let m = wStart; m + totalMin <= wEnd; m += SETTINGS.slot_step_minutes) {
        const startMs = msOfYmdHm(ymd, minToHm(m));
        if (startMs < now + leadMs) continue; // lead time + no past
        if (startMs > windowEndMs) continue; // booking window
        const endMs = startMs + totalMin * 60000;
        if (bookingOverlaps(st.id, startMs, endMs, ignoreBookingId)) continue;
        if (blockedByTimeOff(st.id, startMs, endMs)) continue;
        if (blockedByBlockout(st.id, startMs, endMs)) continue;
        out.push({
          time: minToHm(m),
          starts_at: iso(startMs),
          staff_id: st.id,
          staff_name: st.name,
        });
      }
    }
  }
  out.sort((a, b) => a.time.localeCompare(b.time) || a.staff_id - b.staff_id);
  return out;
}

/** Earliest bookable slot start (ISO) for a staff member, optionally for one service. */
function nextAvailableFor(staffId, serviceId = null) {
  const serviceIds = serviceId
    ? [serviceId]
    : USERS.find((u) => u.id === staffId)?.service_ids || [];
  let best = null;
  const today = ymdOf(Date.now());
  for (let d = 0; d < SETTINGS.booking_window_days; d++) {
    const dd = localYmdToDate(today);
    dd.setDate(dd.getDate() + d);
    const ymd = `${dd.getFullYear()}-${pad(dd.getMonth() + 1)}-${pad(dd.getDate())}`;
    for (const sid of serviceIds) {
      const slots = slotsFor(sid, staffId, ymd);
      if (slots.length) {
        const first = slots[0].starts_at;
        if (!best || first < best) best = first;
      }
    }
    if (best) return best;
  }
  return null;
}

function staffPublic(staffId, serviceId = null) {
  const u = USERS.find((x) => x.id === staffId);
  return {
    id: u.id,
    name: u.name,
    photo_url: u.photo_url,
    bio: u.bio,
    next_available: nextAvailableFor(u.id, serviceId),
  };
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

const tokens = {}; // token -> userId

function userResource(u) {
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone || null,
    role: u.role, photo_url: u.photo_url || null, bio: u.bio || null,
    bookable_online: u.role === 'staff' ? !!u.bookable_online : undefined,
  };
}

function authUser(config = {}) {
  const header = config.headers?.Authorization || config.headers?.authorization;
  let token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token && typeof localStorage !== 'undefined') token = localStorage.getItem('salon_token');
  if (!token) return null;
  const id = tokens[token];
  return USERS.find((u) => u.id === id) || null;
}

function requireAuth(config, roles = null) {
  const user = authUser(config);
  if (!user) throw err(401, 'Unauthenticated.');
  if (roles && !roles.includes(user.role)) throw err(403, 'Forbidden.');
  return user;
}

/* ------------------------------------------------------------------ */
/* Response helpers                                                    */
/* ------------------------------------------------------------------ */

const ok = (data) => Promise.resolve({ data });
function err(status, message, errors = {}) {
  const e = new Error(message);
  e.response = { status, data: { message, errors } };
  return e;
}
const fail = (status, message, errors = {}) => Promise.reject(err(status, message, errors));

function findOrCreateCustomer({ first_name, last_name, phone, email, notes }) {
  const name = `${first_name} ${last_name}`.trim();
  let cust = CUSTOMERS.find((c) => c.email.toLowerCase() === String(email).toLowerCase());
  if (!cust) {
    cust = {
      id: nextCustomerId++, name, email, phone: phone || '',
      notes: notes || '', created_at: iso(Date.now()),
    };
    CUSTOMERS.push(cust);
  }
  return cust;
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

export function createDemoClient() {
  const matchId = (url, prefix) => {
    const m = url.match(new RegExp(`^${prefix}/(\\d+)$`));
    return m ? Number(m[1]) : null;
  };

  async function post(url, body = {}, config = {}) {
    /* ----- Auth ----- */
    if (url === '/auth/login') {
      const user = USERS.find((u) => u.email.toLowerCase() === String(body.email || '').toLowerCase());
      if (!user || body.password !== 'password') {
        return fail(401, 'Invalid credentials');
      }
      const token = `demo-token-${user.id}-${Date.now()}`;
      tokens[token] = user.id;
      return ok({ user: userResource(user), token });
    }
    if (url === '/auth/register') {
      const errors = {};
      if (!body.name) errors.name = ['The name field is required.'];
      if (!body.email) errors.email = ['The email field is required.'];
      if (!body.password || String(body.password).length < 8) errors.password = ['The password must be at least 8 characters.'];
      if (body.password !== body.password_confirmation) errors.password_confirmation = ['The password confirmation does not match.'];
      if (USERS.some((u) => u.email.toLowerCase() === String(body.email || '').toLowerCase())) {
        errors.email = ['The email has already been taken.'];
      }
      if (Object.keys(errors).length) return fail(422, 'The given data was invalid.', errors);
      const user = {
        id: Math.max(...USERS.map((u) => u.id)) + 1,
        name: body.name, email: body.email, phone: body.phone || '', role: 'customer', photo_url: '', bio: '',
      };
      USERS.push(user);
      const token = `demo-token-${user.id}-${Date.now()}`;
      tokens[token] = user.id;
      return ok({ user: userResource(user), token });
    }
    if (url === '/auth/logout') {
      const user = authUser(config);
      if (user) {
        Object.keys(tokens).forEach((t) => { if (tokens[t] === user.id) delete tokens[t]; });
      }
      return ok({ message: 'Logged out.' });
    }

    /* ----- Public: create booking ----- */
    if (url === '/bookings') {
      const errors = {};
      if (!body.service_id) errors.service_id = ['Select a service.'];
      if (!body.date) errors.date = ['Select a date.'];
      if (!body.start_time) errors.start_time = ['Select a time.'];
      if (!body.customer?.first_name) errors['customer.first_name'] = ['First name is required.'];
      if (!body.customer?.last_name) errors['customer.last_name'] = ['Last name is required.'];
      if (!body.customer?.phone) errors['customer.phone'] = ['Phone is required.'];
      if (!body.customer?.email) errors['customer.email'] = ['Email is required.'];
      if (body.policy_accepted !== true) errors.policy_accepted = ['You must accept the cancellation policy.'];
      if (Object.keys(errors).length) return fail(422, 'The given data was invalid.', errors);

      const svc = SERVICES.find((s) => s.id === Number(body.service_id) && s.is_active && s.bookable_online);
      if (!svc) return fail(422, 'This service is not available for online booking.');

      const slots = slotsFor(svc.id, body.staff_id ? Number(body.staff_id) : null, body.date);
      let slot = slots.find((s) => s.time === body.start_time);
      if (!slot) {
        return fail(422, 'That time is no longer available. Please choose another slot.');
      }
      const cust = findOrCreateCustomer(body.customer);
      const startsAt = msOfYmdHm(body.date, body.start_time);
      const totalMin = svc.duration_minutes + svc.buffer_minutes;
      const booking = {
        id: nextBookingId++,
        reference_code: makeReference(),
        status: 'confirmed',
        source: 'online',
        starts_at: startsAt,
        ends_at: startsAt + totalMin * 60000,
        service_id: svc.id,
        staff_id: slot.staff_id,
        customer_id: cust.id,
        customer: { name: `${body.customer.first_name} ${body.customer.last_name}`.trim(), phone: body.customer.phone, email: body.customer.email },
        guest_name: body.guest_name || null,
        notes: body.customer.notes || '',
        price_cents: svc.price_cents,
        cancel_reason: null,
        cancelled_at: null,
        status_history: [
          { from: null, to: 'booked', changed_by: 'customer', changed_at: iso(Date.now()) },
          { from: 'booked', to: 'confirmed', changed_by: 'system', changed_at: iso(Date.now()) },
        ],
        created_at: Date.now(),
      };
      BOOKINGS.push(booking);
      seedNotification(booking.id, 'booking_confirmation', 'email', Date.now() + 6e4, Date.now() + 9e4);
      seedNotification(booking.id, 'reminder_24h', 'sms', booking.starts_at - 24 * 36e5, null);
      return ok({ booking: toBookingResource(booking) });
    }

    /* ----- Public: manage booking ----- */
    if (url === '/bookings/manage/lookup') {
      const b = BOOKINGS.find(
        (x) => x.reference_code.toLowerCase() === String(body.reference_code || '').trim().toLowerCase()
          && x.customer.email.toLowerCase() === String(body.email || '').trim().toLowerCase()
      );
      if (!b) return fail(404, 'No booking found with that reference code and email.');
      return ok({ booking: toBookingResource(b) });
    }
    let m = url.match(/^\/bookings\/manage\/([A-Za-z0-9-]+)\/cancel$/);
    if (m) {
      const b = BOOKINGS.find((x) => x.reference_code.toLowerCase() === m[1].toLowerCase());
      if (!b || b.customer.email.toLowerCase() !== String(body.email || '').trim().toLowerCase()) {
        return fail(404, 'No booking found with that reference code and email.');
      }
      const res = toBookingResource(b);
      if (!res.can_cancel) {
        return fail(422, 'This booking is inside the free-cancellation window. Please contact the salon directly and we will help you.');
      }
      b.status = 'cancelled';
      b.cancelled_at = Date.now();
      b.cancel_reason = 'Cancelled by customer';
      b.status_history.push({ from: 'confirmed', to: 'cancelled', changed_by: 'customer', changed_at: iso(Date.now()) });
      return ok({ booking: toBookingResource(b) });
    }
    m = url.match(/^\/bookings\/manage\/([A-Za-z0-9-]+)\/reschedule$/);
    if (m) {
      const b = BOOKINGS.find((x) => x.reference_code.toLowerCase() === m[1].toLowerCase());
      if (!b || b.customer.email.toLowerCase() !== String(body.email || '').trim().toLowerCase()) {
        return fail(404, 'No booking found with that reference code and email.');
      }
      const res = toBookingResource(b);
      if (!res.can_reschedule) {
        return fail(422, 'This booking can no longer be rescheduled online. Please contact the salon directly and we will help you.');
      }
      const slots = slotsFor(b.service_id, b.staff_id, body.date, b.id);
      const slot = slots.find((s) => s.time === body.start_time);
      if (!slot) return fail(422, 'That time is no longer available. Please choose another slot.');
      const svc = SERVICES.find((s) => s.id === b.service_id);
      b.starts_at = msOfYmdHm(body.date, body.start_time);
      b.ends_at = b.starts_at + (svc.duration_minutes + svc.buffer_minutes) * 60000;
      b.staff_id = slot.staff_id;
      b.status_history.push({ from: b.status, to: b.status, changed_by: 'customer', changed_at: iso(Date.now()) });
      return ok({ booking: toBookingResource(b) });
    }

    /* ----- Cancel: customer (own) and staff/admin share this URL — role decides ----- */
    m = url.match(/^\/bookings\/(\d+)\/cancel$/);
    if (m) {
      const user = requireAuth(config);
      const b = BOOKINGS.find((x) => x.id === Number(m[1]));
      if (!b) return fail(404, 'Booking not found.');
      const now = Date.now();
      if (user.role === 'staff' || user.role === 'admin') {
        if (user.role === 'staff' && b.staff_id !== user.id) return fail(403, 'You can only update your own appointments.');
        if (now >= b.starts_at) return fail(422, 'This appointment has already started and cannot be cancelled.');
        if (TERMINAL.includes(b.status)) return fail(422, 'This booking is already closed.');
        const from = b.status;
        b.status = 'cancelled';
        b.cancelled_at = now;
        b.cancel_reason = now > freeCancelDeadline(b) ? 'Cancelled by staff (late)' : 'Cancelled by staff';
        b.status_history.push({ from, to: 'cancelled', changed_by: user.role, changed_at: iso(now) });
        return ok({ booking: toBookingResource(b) });
      }
      if (b.customer.email.toLowerCase() !== user.email.toLowerCase()) return fail(404, 'Booking not found.');
      const res = toBookingResource(b);
      if (!res.can_cancel) return fail(422, 'This booking can no longer be cancelled online. Please contact the salon.');
      b.status = 'cancelled';
      b.cancelled_at = now;
      b.cancel_reason = 'Cancelled by customer';
      b.status_history.push({ from: res.status, to: 'cancelled', changed_by: 'customer', changed_at: iso(now) });
      return ok({ booking: toBookingResource(b) });
    }
    m = url.match(/^\/bookings\/(\d+)\/reschedule$/);
    if (m) {
      const user = requireAuth(config);
      const b = BOOKINGS.find((x) => x.id === Number(m[1]));
      if (!b || b.customer.email.toLowerCase() !== user.email.toLowerCase()) return fail(404, 'Booking not found.');
      const res = toBookingResource(b);
      if (!res.can_reschedule) return fail(422, 'This booking can no longer be rescheduled online. Please contact the salon.');
      const staffId = body.staff_id ? Number(body.staff_id) : b.staff_id;
      const slots = slotsFor(b.service_id, staffId, body.date, b.id);
      const slot = slots.find((s) => s.time === body.start_time);
      if (!slot) return fail(422, 'That time is no longer available. Please choose another slot.');
      const svc = SERVICES.find((s) => s.id === b.service_id);
      b.starts_at = msOfYmdHm(body.date, body.start_time);
      b.ends_at = b.starts_at + (svc.duration_minutes + svc.buffer_minutes) * 60000;
      b.staff_id = slot.staff_id;
      b.status_history.push({ from: res.status, to: res.status, changed_by: 'customer', changed_at: iso(Date.now()) });
      return ok({ booking: toBookingResource(b) });
    }

    /* ----- Staff: status transitions ----- */
    m = url.match(/^\/bookings\/(\d+)\/(confirm|complete|no-show)$/);
    if (m) {
      const user = requireAuth(config, ['staff', 'admin']);
      const b = BOOKINGS.find((x) => x.id === Number(m[1]));
      if (!b) return fail(404, 'Booking not found.');
      if (user.role === 'staff' && b.staff_id !== user.id) return fail(403, 'You can only update your own appointments.');
      const action = m[2];
      const now = Date.now();
      const from = b.status;
      if (action === 'confirm') {
        if (b.status !== 'booked') return fail(422, 'Only booked appointments can be confirmed.');
        b.status = 'confirmed';
      } else if (action === 'complete') {
        if (!['booked', 'confirmed'].includes(b.status)) return fail(422, 'Only active appointments can be completed.');
        b.status = 'completed';
      } else if (action === 'no-show') {
        if (now < b.starts_at) return fail(422, 'A booking can only be marked as no-show after its start time.');
        if (TERMINAL.includes(b.status)) return fail(422, 'This booking is already closed.');
        b.status = 'no_show';
      }

      b.status_history.push({ from, to: b.status, changed_by: user.role, changed_at: iso(now) });
      return ok({ booking: toBookingResource(b) });
    }

    /* ----- Staff: walk-in ----- */
    if (url === '/staff/walk-in') {
      const user = requireAuth(config, ['staff', 'admin']);
      const svc = SERVICES.find((s) => s.id === Number(body.service_id) && s.is_active);
      if (!svc) return fail(422, 'Select a valid service.');
      const staffMember = USERS.find((u) => u.id === Number(body.staff_id) && u.role === 'staff');
      if (!staffMember) return fail(422, 'Select a valid staff member.');
      if (!body.customer_name || !body.customer_phone) {
        return fail(422, 'Customer name and phone are required.', { customer_name: ['Required.'] });
      }
      const startsAt = msOfYmdHm(body.date, body.start_time);
      const totalMin = svc.duration_minutes + svc.buffer_minutes;
      if (bookingOverlaps(staffMember.id, startsAt, startsAt + totalMin * 60000)) {
        return fail(422, 'That slot is already taken for this staff member.');
      }
      const email = body.customer_email || '';
      let cust = email && CUSTOMERS.find((c) => c.email.toLowerCase() === email.toLowerCase());
      if (!cust) {
        cust = { id: nextCustomerId++, name: body.customer_name, email, phone: body.customer_phone, notes: '', created_at: iso(Date.now()) };
        CUSTOMERS.push(cust);
      }
      const booking = {
        id: nextBookingId++, reference_code: makeReference(), status: 'booked', source: 'walk_in',
        starts_at: startsAt, ends_at: startsAt + totalMin * 60000,
        service_id: svc.id, staff_id: staffMember.id, customer_id: cust.id,
        customer: { name: body.customer_name, phone: body.customer_phone, email },
        guest_name: null, notes: body.notes || '', price_cents: svc.price_cents,
        cancel_reason: null, cancelled_at: null,
        status_history: [{ from: null, to: 'booked', changed_by: user.role, changed_at: iso(Date.now()) }],
        created_at: Date.now(),
      };
      BOOKINGS.push(booking);
      return ok({ booking: toBookingResource(booking) });
    }

    /* ----- Staff: time-off request ----- */
    if (url === '/staff/time-off') {
      const user = requireAuth(config, ['staff', 'admin']);
      const rec = {
        id: nextTimeOffId++, user_id: user.id, staff_name: user.name,
        type: body.type || 'other',
        starts_at: new Date(body.starts_at).getTime(),
        ends_at: new Date(body.ends_at).getTime(),
        note: body.note || '', status: 'pending',
      };
      TIME_OFF.push(rec);
      return ok({ time_off: toTimeOff(rec) });
    }

    /* ----- Admin: services ----- */
    if (url === '/admin/services') {
      requireAuth(config, ['admin']);
      const svc = {
        id: Math.max(...SERVICES.map((s) => s.id)) + 1,
        name: body.name || 'New service',
        description: body.description || '',
        duration_minutes: Number(body.duration_minutes) || 30,
        buffer_minutes: Number(body.buffer_minutes) || 0,
        price_cents: Number(body.price_cents) || 0,
        category_id: Number(body.category_id) || CATEGORIES[0].id,
        bookable_online: body.bookable_online !== false,
        is_active: body.active !== false,
      };
      SERVICES.push(svc);
      (body.staff_ids || []).forEach((sid) => {
        const u = USERS.find((x) => x.id === Number(sid) && x.role === 'staff');
        if (u && !u.service_ids.includes(svc.id)) u.service_ids.push(svc.id);
      });
      return ok({ service: toAdminService(svc) });
    }
    if (url === '/admin/service-categories') {
      requireAuth(config, ['admin']);
      const cat = {
        id: Math.max(...CATEGORIES.map((c) => c.id)) + 1,
        name: body.name || 'New category',
        sort_order: Number(body.sort_order) || CATEGORIES.length + 1,
        active: body.active !== false,
      };
      CATEGORIES.push(cat);
      return ok({ category: cat });
    }

    /* ----- Admin: staff ----- */
    if (url === '/admin/staff') {
      requireAuth(config, ['admin']);
      if (!body.name || !body.email) return fail(422, 'Name and email are required.');
      const user = {
        id: Math.max(...USERS.map((u) => u.id)) + 1,
        name: body.name, email: body.email, phone: body.phone || '', role: 'staff',
        bio: body.bio || '', photo_url: body.photo_url || '',
        bookable_online: body.bookable_online !== false,
        service_ids: (body.service_ids || []).map(Number),
      };
      USERS.push(user);
      return ok({ staff: toAdminStaff(user) });
    }

    /* ----- Admin: working hours ----- */
    if (url === '/admin/working-hours') {
      requireAuth(config, ['admin']);
      const rec = {
        id: Math.max(0, ...WORKING_HOURS.map((w) => w.id)) + 1,
        user_id: Number(body.user_id),
        day_of_week: Number(body.day_of_week),
        start_time: body.start_time,
        end_time: body.end_time,
      };
      WORKING_HOURS.push(rec);
      return ok({ working_hours: rec });
    }

    /* ----- Admin: time-off approve/decline ----- */
    m = url.match(/^\/admin\/time-off\/(\d+)\/(approve|decline)$/);
    if (m) {
      requireAuth(config, ['admin']);
      const rec = TIME_OFF.find((t) => t.id === Number(m[1]));
      if (!rec) return fail(404, 'Time-off request not found.');
      rec.status = m[2] === 'approve' ? 'approved' : 'declined';
      return ok({ time_off: toTimeOff(rec) });
    }

    /* ----- Admin: blockouts ----- */
    if (url === '/admin/blockouts') {
      requireAuth(config, ['admin']);
      const rec = {
        id: nextBlockoutId++,
        staff_id: body.staff_id ? Number(body.staff_id) : null,
        staff_name: body.staff_id ? USERS.find((u) => u.id === Number(body.staff_id))?.name || null : null,
        starts_at: new Date(body.starts_at).getTime(),
        ends_at: new Date(body.ends_at).getTime(),
        reason: body.reason || '',
        blocks_online_booking: body.blocks_online_booking !== false,
      };
      BLOCKOUTS.push(rec);
      return ok({ blockout: toBlockout(rec) });
    }

    /* ----- Admin: create booking ----- */
    if (url === '/admin/bookings') {
      requireAuth(config, ['admin']);
      const svc = SERVICES.find((s) => s.id === Number(body.service_id) && s.is_active);
      if (!svc) return fail(422, 'Select a valid service.');
      const staffMember = USERS.find((u) => u.id === Number(body.staff_id) && u.role === 'staff');
      if (!staffMember) return fail(422, 'Select a valid staff member.');
      const startsAt = msOfYmdHm(body.date, body.start_time);
      const totalMin = svc.duration_minutes + svc.buffer_minutes;
      let cust = null;
      if (body.customer_id) cust = CUSTOMERS.find((c) => c.id === Number(body.customer_id));
      const name = body.customer_name || cust?.name || 'Guest';
      const booking = {
        id: nextBookingId++, reference_code: makeReference(), status: 'booked',
        source: body.source || 'admin',
        starts_at: startsAt, ends_at: startsAt + totalMin * 60000,
        service_id: svc.id, staff_id: staffMember.id, customer_id: cust?.id || null,
        customer: { name, phone: body.customer_phone || cust?.phone || '', email: body.customer_email || cust?.email || '' },
        guest_name: body.guest_name || null, notes: body.notes || '', price_cents: svc.price_cents,
        cancel_reason: null, cancelled_at: null,
        status_history: [{ from: null, to: 'booked', changed_by: 'admin', changed_at: iso(Date.now()) }],
        created_at: Date.now(),
      };
      BOOKINGS.push(booking);
      return ok({ booking: toBookingResource(booking) });
    }

    return fail(404, `Not found: POST ${url}`);
  }

  async function get(url, config = {}) {
    const params = config.params || {};

    if (url === '/auth/me') {
      const user = authUser(config);
      if (!user) return fail(401, 'Unauthenticated.');
      return ok({ user: userResource(user) });
    }

    /* ----- Public ----- */
    if (url === '/salon') {
      return ok({
        salon: {
          name: SETTINGS.salon_name,
          timezone: SETTINGS.timezone,
          timezone_label: SETTINGS.timezone_label,
          currency: SETTINGS.currency,
          phone: SETTINGS.phone,
          email: SETTINGS.email,
          address: SETTINGS.address,
          opening_hours: SETTINGS.opening_hours,
          cancellation_policy_text: SETTINGS.cancellation_policy_text,
          free_cancellation_hours: SETTINGS.free_cancellation_hours,
          booking_window_days: SETTINGS.booking_window_days,
          lead_time_minutes: SETTINGS.lead_time_minutes,
          slot_step_minutes: SETTINGS.slot_step_minutes,
        },
      });
    }
    if (url === '/services') {
      const categories = CATEGORIES.filter((c) => c.active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => ({
          id: c.id,
          name: c.name,
          sort_order: c.sort_order,
          services: SERVICES.filter((s) => s.category_id === c.id && s.is_active && s.bookable_online)
            .map(toPublicService),
        }));
      return ok({ categories });
    }
    let m = url.match(/^\/services\/(\d+)$/);
    if (m) {
      const svc = SERVICES.find((s) => s.id === Number(m[1]) && s.is_active);
      if (!svc) return fail(404, 'Service not found.');
      const staff = USERS.filter((u) => u.role === 'staff' && u.bookable_online && u.service_ids.includes(svc.id))
        .map((u) => ({ id: u.id, name: u.name, photo_url: u.photo_url, bio: u.bio }));
      return ok({
        service: toPublicService(svc),
        staff,
        policy: { text: SETTINGS.cancellation_policy_text, free_cancellation_hours: SETTINGS.free_cancellation_hours },
      });
    }
    if (url === '/staff') {
      const serviceId = params.service_id ? Number(params.service_id) : null;
      const list = USERS.filter(
        (u) => u.role === 'staff' && u.bookable_online && (!serviceId || u.service_ids.includes(serviceId))
      ).map((u) => staffPublic(u.id, serviceId));
      return ok({ staff: list });
    }
    if (url === '/availability') {
      if (!params.service_id || !params.date) return fail(422, 'service_id and date are required.');
      const slots = slotsFor(Number(params.service_id), params.staff_id ? Number(params.staff_id) : null, params.date);
      return ok({
        date: params.date,
        timezone: SETTINGS.timezone,
        timezone_label: SETTINGS.timezone_label,
        slots,
        fully_booked: slots.length === 0,
      });
    }
    if (url === '/availability/calendar') {
      const { service_id, staff_id, from, to } = params;
      if (!service_id || !from || !to) return fail(422, 'service_id, from and to are required.');
      const days = {};
      const start = localYmdToDate(from);
      const end = localYmdToDate(to);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const slots = slotsFor(Number(service_id), staff_id ? Number(staff_id) : null, ymd);
        days[ymd] = { available: slots.length > 0, slots_count: slots.length };
      }
      return ok({ days });
    }

    /* ----- Customer ----- */
    if (url === '/bookings') {
      const user = requireAuth(config);
      const mine = BOOKINGS.filter((b) => b.customer.email.toLowerCase() === user.email.toLowerCase());
      const now = Date.now();
      const upcoming = mine
        .filter((b) => ACTIVE.includes(b.status) && b.starts_at >= now - 36e5)
        .sort((a, b) => a.starts_at - b.starts_at);
      const past = mine
        .filter((b) => !(ACTIVE.includes(b.status) && b.starts_at >= now - 36e5))
        .sort((a, b) => b.starts_at - a.starts_at);
      return ok({ upcoming: upcoming.map(toBookingResource), past: past.map(toBookingResource) });
    }
    m = url.match(/^\/bookings\/(\d+)$/);
    if (m) {
      const user = requireAuth(config);
      const b = BOOKINGS.find((x) => x.id === Number(m[1]));
      if (!b || b.customer.email.toLowerCase() !== user.email.toLowerCase()) return fail(404, 'Booking not found.');
      return ok({ booking: toBookingResource(b) });
    }

    /* ----- Staff ----- */
    if (url === '/staff/schedule') {
      const user = requireAuth(config, ['staff', 'admin']);
      const view = params.view || 'day';
      const staffId = user.role === 'admin' && params.staff_id ? Number(params.staff_id) : user.role === 'staff' ? user.id : null;
      if (view === 'week') {
        const anchor = params.date || ymdOf(Date.now());
        const anchorDate = localYmdToDate(anchor);
        const mondayOffset = (anchorDate.getDay() + 6) % 7; // Monday-first week
        const weekStart = new Date(anchorDate);
        weekStart.setDate(weekStart.getDate() - mondayOffset);
        const days = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStart);
          d.setDate(d.getDate() + i);
          const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          days.push({ date: ymd, bookings: bookingsOn(ymd, staffId).map(toBookingResource) });
        }
        const ws = days[0].date;
        return ok({ week_start: ws, days });
      }
      const date = params.date || ymdOf(Date.now());
      return ok({ date, bookings: bookingsOn(date, staffId).map(toBookingResource) });
    }
    if (url === '/staff/shifts') {
      const user = requireAuth(config, ['staff', 'admin']);
      const targetId = user.role === 'admin' && params.staff_id ? Number(params.staff_id) : user.id;
      return ok({
        working_hours: WORKING_HOURS.filter((w) => w.user_id === targetId),
        time_off: TIME_OFF.filter((t) => t.user_id === targetId).map(toTimeOff),
        blockouts: BLOCKOUTS.filter((b) => b.staff_id === targetId).map(toBlockout),
      });
    }

    /* ----- Admin ----- */
    if (url === '/admin/dashboard') {
      requireAuth(config, ['admin']);
      return ok(dashboard());
    }
    if (url === '/admin/services') {
      requireAuth(config, ['admin']);
      return ok({ services: SERVICES.map(toAdminService) });
    }
    if (url === '/admin/service-categories') {
      requireAuth(config, ['admin']);
      return ok({ categories: [...CATEGORIES].sort((a, b) => a.sort_order - b.sort_order) });
    }
    if (url === '/admin/staff') {
      requireAuth(config, ['admin']);
      return ok({ staff: USERS.filter((u) => u.role === 'staff').map(toAdminStaff) });
    }
    if (url === '/admin/working-hours') {
      requireAuth(config, ['admin']);
      const list = params.staff_id
        ? WORKING_HOURS.filter((w) => w.user_id === Number(params.staff_id))
        : WORKING_HOURS;
      return ok({ working_hours: [...list].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)) });
    }
    if (url === '/admin/time-off') {
      requireAuth(config, ['admin']);
      const list = params.status ? TIME_OFF.filter((t) => t.status === params.status) : TIME_OFF;
      return ok({ time_off: [...list].reverse().map(toTimeOff) });
    }
    if (url === '/admin/blockouts') {
      requireAuth(config, ['admin']);
      return ok({ blockouts: BLOCKOUTS.map(toBlockout) });
    }
    if (url === '/admin/bookings') {
      requireAuth(config, ['admin']);
      let list = [...BOOKINGS];
      if (params.date) list = list.filter((b) => ymdOf(b.starts_at) === params.date);
      if (params.staff_id) list = list.filter((b) => b.staff_id === Number(params.staff_id));
      if (params.status) list = list.filter((b) => b.status === params.status);
      if (params.search) {
        const q = String(params.search).toLowerCase();
        list = list.filter(
          (b) =>
            b.reference_code.toLowerCase().includes(q) ||
            b.customer.name.toLowerCase().includes(q) ||
            b.customer.email.toLowerCase().includes(q) ||
            b.customer.phone.includes(q)
        );
      }
      list.sort((a, b) => b.starts_at - a.starts_at);
      return ok({ bookings: list.map(toBookingResource) });
    }
    if (url === '/admin/customers') {
      requireAuth(config, ['admin']);
      let list = [...CUSTOMERS];
      if (params.search) {
        const q = String(params.search).toLowerCase();
        list = list.filter(
          (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q)
        );
      }
      return ok({ customers: list.map(toCustomerSummary) });
    }
    m = url.match(/^\/admin\/customers\/(\d+)$/);
    if (m) {
      requireAuth(config, ['admin']);
      const cust = CUSTOMERS.find((c) => c.id === Number(m[1]));
      if (!cust) return fail(404, 'Customer not found.');
      const bookings = BOOKINGS.filter((b) => b.customer_id === cust.id)
        .sort((a, b) => b.starts_at - a.starts_at);
      return ok({
        customer: toCustomerDetail(cust),
        bookings: bookings.map(toBookingResource),
        stats: customerStats(cust),
      });
    }
    if (url === '/admin/settings') {
      requireAuth(config, ['admin']);
      return ok({ settings: { ...SETTINGS } });
    }
    if (url === '/admin/notifications') {
      requireAuth(config, ['admin']);
      let list = [...NOTIFICATIONS].sort((a, b) => b.id - a.id);
      if (params.booking_id) list = list.filter((n) => n.booking_id === Number(params.booking_id));
      if (params.status) list = list.filter((n) => n.status === params.status);
      return ok({ notifications: list });
    }

    return fail(404, `Not found: GET ${url}`);
  }

  async function put(url, body = {}, config = {}) {
    let m = url.match(/^\/admin\/services\/(\d+)$/);
    if (m) {
      requireAuth(config, ['admin']);
      const svc = SERVICES.find((s) => s.id === Number(m[1]));
      if (!svc) return fail(404, 'Service not found.');
      Object.assign(svc, {
        name: body.name ?? svc.name,
        description: body.description ?? svc.description,
        duration_minutes: body.duration_minutes != null ? Number(body.duration_minutes) : svc.duration_minutes,
        buffer_minutes: body.buffer_minutes != null ? Number(body.buffer_minutes) : svc.buffer_minutes,
        price_cents: body.price_cents != null ? Number(body.price_cents) : svc.price_cents,
        category_id: body.category_id != null ? Number(body.category_id) : svc.category_id,
        bookable_online: body.bookable_online ?? svc.bookable_online,
        is_active: body.active ?? svc.is_active,
      });
      if (body.staff_ids) {
        USERS.filter((u) => u.role === 'staff').forEach((u) => {
          u.service_ids = u.service_ids.filter((id) => id !== svc.id);
        });
        body.staff_ids.forEach((sid) => {
          const u = USERS.find((x) => x.id === Number(sid) && x.role === 'staff');
          if (u && !u.service_ids.includes(svc.id)) u.service_ids.push(svc.id);
        });
      }
      return ok({ service: toAdminService(svc) });
    }
    m = url.match(/^\/admin\/service-categories\/(\d+)$/);
    if (m) {
      requireAuth(config, ['admin']);
      const cat = CATEGORIES.find((c) => c.id === Number(m[1]));
      if (!cat) return fail(404, 'Category not found.');
      Object.assign(cat, {
        name: body.name ?? cat.name,
        sort_order: body.sort_order != null ? Number(body.sort_order) : cat.sort_order,
        active: body.active ?? cat.active,
      });
      return ok({ category: cat });
    }
    m = url.match(/^\/admin\/staff\/(\d+)$/);
    if (m) {
      requireAuth(config, ['admin']);
      const u = USERS.find((x) => x.id === Number(m[1]) && x.role === 'staff');
      if (!u) return fail(404, 'Staff member not found.');
      Object.assign(u, {
        name: body.name ?? u.name,
        email: body.email ?? u.email,
        phone: body.phone ?? u.phone,
        bio: body.bio ?? u.bio,
        photo_url: body.photo_url ?? u.photo_url,
        bookable_online: body.bookable_online ?? u.bookable_online,
      });
      if (body.service_ids) u.service_ids = body.service_ids.map(Number);
      return ok({ staff: toAdminStaff(u) });
    }
    m = url.match(/^\/admin\/bookings\/(\d+)$/);
    if (m) {
      requireAuth(config, ['admin']);
      const b = BOOKINGS.find((x) => x.id === Number(m[1]));
      if (!b) return fail(404, 'Booking not found.');
      const from = b.status;
      if (body.service_id) b.service_id = Number(body.service_id);
      if (body.staff_id) b.staff_id = Number(body.staff_id);
      if (body.guest_name !== undefined) b.guest_name = body.guest_name || null;
      if (body.notes !== undefined) b.notes = body.notes;
      const svc = SERVICES.find((s) => s.id === b.service_id);
      if (body.date && body.start_time) {
        b.starts_at = msOfYmdHm(body.date, body.start_time);
        b.ends_at = b.starts_at + (svc.duration_minutes + svc.buffer_minutes) * 60000;
        b.status_history.push({ from, to: b.status, changed_by: 'admin', changed_at: iso(Date.now()) });
      }
      return ok({ booking: toBookingResource(b) });
    }
    m = url.match(/^\/admin\/customers\/(\d+)$/);
    if (m) {
      // NOT in contract v1 — honoured by the demo so the UI can be exercised.
      requireAuth(config, ['admin']);
      const cust = CUSTOMERS.find((c) => c.id === Number(m[1]));
      if (!cust) return fail(404, 'Customer not found.');
      if (body.notes !== undefined) cust.notes = body.notes;
      if (body.name !== undefined) cust.name = body.name;
      if (body.phone !== undefined) cust.phone = body.phone;
      return ok({ customer: toCustomerDetail(cust) });
    }
    if (url === '/admin/settings') {
      requireAuth(config, ['admin']);
      const allowed = ['salon_name', 'timezone', 'currency', 'phone', 'email', 'address', 'booking_window_days', 'lead_time_minutes', 'slot_step_minutes', 'free_cancellation_hours', 'cancellation_policy_text'];
      allowed.forEach((k) => {
        if (body[k] !== undefined) SETTINGS[k] = body[k];
      });
      SETTINGS.timezone_label = `All times shown in ${SETTINGS.timezone}`;
      return ok({ settings: { ...SETTINGS } });
    }
    return fail(404, `Not found: PUT ${url}`);
  }

  async function del(url, config = {}) {
    let m = url.match(/^\/admin\/services\/(\d+)$/);
    if (m) {
      requireAuth(config, ['admin']);
      const svc = SERVICES.find((s) => s.id === Number(m[1]));
      if (!svc) return fail(404, 'Service not found.');
      svc.is_active = false; // soft delete
      return ok({ message: 'Service deactivated.' });
    }
    m = url.match(/^\/admin\/service-categories\/(\d+)$/);
    if (m) {
      requireAuth(config, ['admin']);
      const cat = CATEGORIES.find((c) => c.id === Number(m[1]));
      if (!cat) return fail(404, 'Category not found.');
      cat.active = false;
      return ok({ message: 'Category deactivated.' });
    }
    m = url.match(/^\/admin\/working-hours\/(\d+)$/);
    if (m) {
      requireAuth(config, ['admin']);
      const idx = WORKING_HOURS.findIndex((w) => w.id === Number(m[1]));
      if (idx < 0) return fail(404, 'Working hours entry not found.');
      WORKING_HOURS.splice(idx, 1);
      return ok({ message: 'Deleted.' });
    }
    m = url.match(/^\/admin\/blockouts\/(\d+)$/);
    if (m) {
      requireAuth(config, ['admin']);
      const idx = BLOCKOUTS.findIndex((b) => b.id === Number(m[1]));
      if (idx < 0) return fail(404, 'Blockout not found.');
      BLOCKOUTS.splice(idx, 1);
      return ok({ message: 'Deleted.' });
    }
    return fail(404, `Not found: DELETE ${url}`);
  }

  return { post, get, put, delete: del };
}

/* ------------------------------------------------------------------ */
/* Resource shapers                                                    */
/* ------------------------------------------------------------------ */

function priceDisplay(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function toPublicService(s) {
  return {
    id: s.id, name: s.name, description: s.description,
    duration_minutes: s.duration_minutes, buffer_minutes: s.buffer_minutes,
    price_cents: s.price_cents, price_display: priceDisplay(s.price_cents),
    category_id: s.category_id, bookable_online: s.bookable_online,
  };
}

function toAdminService(s) {
  const cat = CATEGORIES.find((c) => c.id === s.category_id);
  return {
    ...toPublicService(s),
    is_active: s.is_active,
    active: s.is_active,
    category_name: cat?.name || '',
    staff_ids: USERS.filter((u) => u.role === 'staff' && u.service_ids.includes(s.id)).map((u) => u.id),
  };
}

function toAdminStaff(u) {
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone,
    role: u.role, photo_url: u.photo_url, bio: u.bio,
    bookable_online: u.bookable_online,
    service_ids: [...u.service_ids],
    services: u.service_ids.map((id) => SERVICES.find((s) => s.id === id)?.name).filter(Boolean),
  };
}

function toTimeOff(t) {
  return {
    id: t.id, user_id: t.user_id, staff_name: t.staff_name, type: t.type,
    starts_at: iso(t.starts_at), ends_at: iso(t.ends_at), note: t.note, status: t.status,
  };
}

function toBlockout(b) {
  return {
    id: b.id, staff_id: b.staff_id, staff_name: b.staff_name,
    starts_at: iso(b.starts_at), ends_at: iso(b.ends_at),
    reason: b.reason, blocks_online_booking: b.blocks_online_booking,
  };
}

function customerStats(cust) {
  const bookings = BOOKINGS.filter((b) => b.customer_id === cust.id);
  return {
    total_bookings: bookings.length,
    completed: bookings.filter((b) => b.status === 'completed').length,
    no_show_count: bookings.filter((b) => b.status === 'no_show').length,
    cancellation_count: bookings.filter((b) => b.status === 'cancelled').length,
    total_spend_cents: bookings.filter((b) => b.status === 'completed').reduce((s, b) => s + b.price_cents, 0),
    upcoming_count: bookings.filter((b) => ACTIVE.includes(b.status) && b.starts_at > Date.now()).length,
  };
}

function toCustomerSummary(c) {
  const stats = customerStats(c);
  return {
    id: c.id, name: c.name, email: c.email, phone: c.phone,
    total_bookings: stats.total_bookings,
    no_show_count: stats.no_show_count,
    total_spend_cents: stats.total_spend_cents,
    created_at: c.created_at,
  };
}

function toCustomerDetail(c) {
  const stats = customerStats(c);
  return {
    id: c.id, name: c.name, email: c.email, phone: c.phone, notes: c.notes,
    no_show_count: stats.no_show_count,
    cancellation_count: stats.cancellation_count,
    total_spend_cents: stats.total_spend_cents,
    created_at: c.created_at,
  };
}

function bookingsOn(ymd, staffId) {
  return BOOKINGS.filter(
    (b) => ymdOf(b.starts_at) === ymd && (staffId == null || b.staff_id === staffId)
  ).sort((a, b) => a.starts_at - b.starts_at);
}

function dashboard() {
  const now = Date.now();
  const today = ymdOf(now);
  const in7d = now + 7 * 864e5;
  const startOfMonth = msOfYmdHm(`${today.slice(0, 7)}-01`, '00:00');
  const startOfWeek = now - 7 * 864e5;

  const todayBookings = bookingsOn(today, null);
  const upcoming7 = BOOKINGS.filter((b) => b.starts_at >= now && b.starts_at <= in7d && ACTIVE.includes(b.status));
  const rev = (list) => list.filter((b) => b.status === 'completed').reduce((s, b) => s + b.price_cents, 0);

  const completedOrActive30 = BOOKINGS.filter((b) => b.starts_at >= now - 30 * 864e5);
  const newCount = CUSTOMERS.filter((c) => new Date(c.created_at).getTime() >= now - 30 * 864e5).length;
  const returningCount = CUSTOMERS.length - newCount;
  const noShows = completedOrActive30.filter((b) => b.status === 'no_show').length;
  const finished = completedOrActive30.filter((b) => ['completed', 'no_show'].includes(b.status)).length;

  const staffOccupancy = USERS.filter((u) => u.role === 'staff').map((u) => {
    const dow = dowOf(now);
    const windows = staffWindows(u.id, dow);
    const availableMinutes = windows.reduce((s, w) => s + (hmToMin(w.end_time) - hmToMin(w.start_time)), 0);
    const bookedMinutes = todayBookings
      .filter((b) => b.staff_id === u.id && ACTIVE.includes(b.status))
      .reduce((s, b) => s + (b.ends_at - b.starts_at) / 60000, 0);
    return {
      staff_id: u.id,
      name: u.name,
      booked_minutes: Math.round(bookedMinutes),
      available_minutes: availableMinutes,
      occupancy_pct: availableMinutes ? Math.round((bookedMinutes / availableMinutes) * 100) : 0,
    };
  });

  return {
    today: { count: todayBookings.length, bookings: todayBookings.map(toBookingResource) },
    upcoming_7d: {
      count: upcoming7.length,
      expected_revenue_cents: upcoming7.reduce((s, b) => s + b.price_cents, 0),
    },
    revenue: {
      today_cents: rev(todayBookings),
      week_cents: rev(BOOKINGS.filter((b) => b.starts_at >= startOfWeek)),
      month_cents: rev(BOOKINGS.filter((b) => b.starts_at >= startOfMonth)),
    },
    customers: { new_count: newCount, returning_count: returningCount },
    no_show_rate: finished ? Math.round((noShows / finished) * 1000) / 10 : 0,
    staff_occupancy: staffOccupancy,
  };
}

/** True when this build is the public interactive preview. */
export const isDemoMode = () =>
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  import.meta.env.VITE_DEMO_MODE === 'true';
