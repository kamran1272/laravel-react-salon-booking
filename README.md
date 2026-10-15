# Salon Booking System

A complete, production-quality salon booking platform: Laravel 11 API backend + React frontend, with Sanctum authentication and role-based access (admin / staff / customer). Modelled on the booking flows of Fresha, Booksy, Vagaro, and GlossGenius.

**Status:** v1 feature-complete (see [PRODUCT-BRIEF.md](PRODUCT-BRIEF.md) for the build log and roadmap).

## What's inside

- **Customer booking flow** — grouped service catalog → service detail with cancellation policy → staff picker ("Any available" first) → 15-minute slot picker with fully-booked days greyed out → details form with policy checkbox → confirmation with a unique `BK-XXXXXX` reference code and the computed free-cancel deadline → "My bookings" with self-service reschedule/cancel.
- **Staff view** — day agenda and week grid, appointment drawer, guarded status actions (confirm/complete/cancel/no-show), walk-in booking creation, own shifts + time-off requests.
- **Admin view** — dashboard (today's bookings, 7-day outlook, revenue from completed services, new vs returning customers, no-show rate, staff occupancy), services/catalog management, staff & shifts, bookings with full control, customer profiles with no-show counters.
- **Real slot engine** — shift windows minus breaks, approved time-off, and salon/staff blockouts; 2-hour lead time; 6-week booking window; per-service buffer; transactional overlap re-check at booking time; configurable cancellation cutoff (default 24h).
- **Notifications (v1)** — confirmation, 24h + 2h reminders, reschedule/cancel confirmations are *recorded* in the database and logged to the application log. No real SMS/email provider is wired up — v1 is deliberately honest about this (see Roadmap).

## Quick start

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed   # seeds demo salon: Glow & Grace Salon
php artisan notifications:dispatch   # send due reminders (run via cron/scheduler)
php artisan serve
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_DEMO_MODE=true` to run the full UI against a built-in mock API (no backend needed) — every endpoint in [API-CONTRACT.md](API-CONTRACT.md) has a mock implementation.

### Demo logins (password for all: `password`)

| Email             | Role     |
|-------------------|----------|
| admin@demo.io     | Admin    |
| maria@demo.io     | Staff    |
| james@demo.io     | Staff    |
| customer@demo.io  | Customer |

Guests can book without an account — they manage bookings via reference code + email.

### Running tests

```bash
cd backend
php artisan test
```

Feature suites: `BookingTest` (public flow + customer self-service), `AvailabilityTest` (slot rules, time-off, blockouts, fully-booked days), `BookingLifecycleTest` (guarded transitions, sales, counters), `AdminTest` (dashboard, services, bookings, customers, settings, time-off), `AuthTest` (registration, login, role gates).

## Key design decisions

- **Money is integer cents** (`price_cents`) — no float rounding anywhere.
- **Datetimes stored UTC, displayed salon-local.** Default timezone `Asia/Karachi`; the API returns both (`starts_at` UTC + `starts_at_local` salon time + labels).
- **Customers are users with role `customer`** — no separate customers table. Guest bookings have `customer_id = null` plus `guest_name/phone/email`.
- **Lifecycle is strict:** `booked → confirmed → completed | cancelled | no_show`, server-side guarded on every transition. Online booking with policy acceptance lands directly at `confirmed`; staff walk-ins start at `booked`.
- **Cancel rules:** before start only; self-service only before the free-cancellation cutoff (24h default). Inside the cutoff the API returns `contact_salon: true` instead of cancelling.
- **Services are never hard-deleted** — admin "delete" sets `is_active=false`; bookings keep name/price/duration snapshots, so history stays accurate.
- **Status history audit log** on every transition (`booking_status_histories`).
- **Slot validity** = `[start, start+duration+buffer]` fits inside one shift window, not past, outside the lead time, inside the booking window, and not overlapping any non-cancelled booking. Re-checked inside a DB transaction with row locks at creation.
- **Never constructor-inject the `SalonSetting` model** — the container creates an empty instance. Use `SalonSetting::current()` via a `settings()` helper.

## Project layout

```
backend/
  app/Http/Controllers/Api/   # thin controllers (Customer, Staff, Admin)
  app/Http/Requests/          # FormRequests for every write endpoint
  app/Http/Resources/        # API resources (response shapes)
  app/Services/              # AvailabilityService, NotificationService
  database/migrations/       # 12 migrations (settings, catalog, staff, bookings, sales, notifications)
  database/seeders/          # SalonSeeder — full demo dataset
  routes/api.php             # route map
  tests/Feature/             # feature suites
frontend/
  src/                       # React app (API client + demoMock seam)
API-CONTRACT.md              # frozen API contract (backend <-> frontend)
PRODUCT-BRIEF.md             # build log, spec coverage, roadmap
```

## Deployment notes

- Schedule `php artisan notifications:dispatch` every 5–10 minutes (reminders are computed from `reminder_schedule` in settings).
- The reminder/confirmation "sends" go to `storage/logs/laravel.log` — wire a real SMS/email provider into `NotificationService::deliver()` when you're ready (the records are already there; swap one method).

## Roadmap (deliberately NOT in v1)

Payments/deposits/card-on-file · waitlist · recurring appointments · group bookings · staff timesheets/commissions · external calendar sync (Google/Apple). Each is a natural v2 module on top of this codebase.
