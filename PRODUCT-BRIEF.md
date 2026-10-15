# Salon Booking System — Product Brief

**Target buyer:** independent salons / multi-chair shops that want online booking without Fresha-style commissions.

## What v1 does (shipped)

### Customer
- Browse services grouped by category (duration + price shown).
- Service detail shows the cancellation policy, which must be accepted at booking.
- Staff picker lists only staff assigned to the service, with **"Any available" first**.
- Slot picker: 15-minute steps, fully-booked days greyed out, all times salon-local.
- Details form: name, phone, email, notes, "booking for someone else" guest-name toggle, policy checkbox.
- Confirmation screen: unique reference code (`BK-XXXXXX`), the policy restated, the computed free-cancel deadline, and manage-booking links.
- "My bookings": self-service reschedule/cancel. Cancel only before start **and** before the cutoff; inside the cutoff the UI tells them to contact the salon (server enforces this — no client-side bypass).

### Slot engine
- Availability = staff shift windows − breaks − approved time-off − blockouts − existing bookings.
- 15-min steps; valid iff: not past, outside the 2h lead time, within the 6-week window, and `[start, start+duration+buffer]` fits inside one window without overlapping any non-cancelled booking.
- Transactional overlap re-check (row locks) at creation — two customers racing for one slot can't both win.
- Cancellation cutoff: 24h default, configurable per salon.

### Booking lifecycle (server-guarded)
`booked → confirmed → completed | cancelled | no_show` · `completed/cancelled/no_show` terminal.
- Online booking with policy acceptance → `confirmed` immediately.
- Staff walk-in/phone booking → `booked`, staff confirms later.
- Cancel: before start only. No-show: manual, after start only.
- Every transition validated server-side + written to the `booking_status_histories` audit log.

### Staff
- Day agenda + week grid with status colours; appointment drawer (client, services, notes); guarded status actions.
- Walk-in booking creation; own shifts view; time-off requests.

### Admin
- Dashboard: today's bookings, upcoming 7 days, revenue from completed services (today/week/month), new vs returning customers, no-show rate, per-staff occupancy.
- Services: name/duration/price/category/buffer/staff assignment/online toggle (deactivation keeps booking snapshots intact).
- Staff: profiles, shifts (multiple windows per day supported), time-off approval, blockouts.
- Bookings: create with full control, edit/reassign/reschedule, cancel with guards.
- Customers: profiles, booking history, no-show & cancellation counters, notes.

### Notifications (honest v1)
- Confirmation, 24h + 2h reminders, reschedule/cancel confirmations are **recorded** (`notifications` table) and **logged** (`storage/logs/laravel.log`). No real SMS/email integration — this is deliberate for v1; `NotificationService::deliver()` is the single swap point.

## Data model (§5 coverage)
- `salon_settings` (singleton: timezone, lead time, slot step, cancellation hours, policy text, reminder schedule)
- `service_categories`, `services` (duration, buffer, price_cents, bookable_online, is_active), `staff_service` pivot
- `working_hours` (multiple windows per weekday), `time_offs`, `blockouts`
- `bookings` (service name/duration/price snapshots, guest fields, cancel metadata, reference code)
- `booking_status_histories` (audit log), `notifications`, `sales`
- `users` (role: admin/staff/customer; staff profile fields; customer counters: no_show_count, cancellation_count, total_spend_cents)
- Money in integer cents; datetimes stored UTC, rendered salon-local.

## Endpoints (see API-CONTRACT.md for the frozen contract)
Public: `GET /salon`, `GET /services`, `GET /staff`, `GET /availability`(+`/calendar`), `POST /bookings`, `POST /bookings/manage/*` · Auth: `/auth/*` · Customer (auth): `GET/POST /bookings/*` · Staff+admin: `/staff/*`, `POST /bookings/{id}/{confirm,complete,no-show,cancel}` · Admin: `/admin/{dashboard,services,service-categories,staff,working-hours,time-off,blockouts,bookings,customers,settings,notifications}`.

## Tests
`BookingTest` · `AvailabilityTest` · `BookingLifecycleTest` · `AdminTest` · `AuthTest` — run `php artisan test` in `backend/`.

## Roadmap — explicitly NOT v1 (do not build yet)
1. Payments/deposits/card-on-file (Stripe) — needs PCI/compliance story.
2. Waitlist — needs real-time notification infra.
3. Recurring appointments.
4. Group bookings (multiple services/staff in one visit).
5. Staff timesheets/commissions — payroll touches money; needs audit-grade accuracy.
6. External calendar sync (Google/Apple) — OAuth + conflict resolution.

Each of these is a natural v2 module: the lifecycle, snapshots, and notification records are already the foundation.
