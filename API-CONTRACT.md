# Salon Booking System — API Contract v1

Base URL: `/api`. Auth: `Authorization: Bearer <sanctum-token>`.
All datetimes: ISO 8601 UTC (`2026-10-20T09:30:00Z`). Money: integer cents.
Salon timezone for display: `Asia/Karachi` (from settings; resources also include `*_local` fields).
Errors: `{"message": "..."}` (401/403/404); 422 → `{"message": "...", "errors": {...}}`.
Booking reference codes: `BK-XXXXXX` (8 uppercase alphanumerics).
Statuses: `booked` → `confirmed` → `completed` | `cancelled` | `no_show`. Terminal: completed, cancelled, no_show.
Roles: `admin`, `staff`, `customer`.

## Public (no auth)

- `GET /api/salon` → `{salon: {name, timezone, timezone_label, currency, phone, email, address, opening_hours: [{day: "Monday", open: "09:00", close: "18:00"} | {day:"Sunday", open:null, close:null}], cancellation_policy_text, free_cancellation_hours, booking_window_days, lead_time_minutes, slot_step_minutes}}`
- `GET /api/services` → `{categories: [{id, name, sort_order, services: [{id, name, description, duration_minutes, buffer_minutes, price_cents, price_display: "$25.00", category_id, bookable_online}]}]}` — active + bookable_online only
- `GET /api/services/{id}` → `{service: {...detail incl. description, duration_minutes, price_cents}, staff: [{id, name, photo_url, bio}], policy: {text, free_cancellation_hours}}`
- `GET /api/staff?service_id=` → `{staff: [{id, name, photo_url, bio, next_available: ISO|null}]}` — bookable staff assigned to the service (or all bookable staff when service_id omitted)
- `GET /api/availability?service_id=&staff_id=(optional)&date=Y-m-d` → `{date: "Y-m-d", timezone, timezone_label: "All times shown in Asia/Karachi", slots: [{time: "HH:MM", starts_at: ISO_UTC, staff_id, staff_name}], fully_booked: bool}`. Omit staff_id = "any available": slots merged across eligible staff, each slot tagged with the staff who would take it.
- `GET /api/availability/calendar?service_id=&staff_id=&from=Y-m-d&to=Y-m-d` → `{days: {"2026-10-20": {available: bool, slots_count: int}}}` — used to grey out fully-booked days
- `POST /api/bookings` (guest OK) body `{service_id, staff_id|null, date: "Y-m-d", start_time: "HH:MM", customer: {first_name, last_name, phone, email, notes?}, guest_name?, policy_accepted: true}` → `201 {booking}` (status `confirmed`, includes `reference_code`, `free_cancel_deadline`). 422 if slot taken / inside lead time / outside window / policy not accepted.
- `POST /api/bookings/manage/lookup` `{reference_code, email}` → `{booking}`
- `POST /api/bookings/manage/{reference}/cancel` `{email}` → `{booking}` (422 when inside cutoff or start passed: message tells caller to contact the salon)
- `POST /api/bookings/manage/{reference}/reschedule` `{email, date, start_time}` → `{booking}`

## Customer (auth:sanctum)

- `GET /api/bookings` → `{upcoming: [booking...], past: [booking...]}` (signed-in customer's own)
- `GET /api/bookings/{id}` → `{booking}` (owner only)
- `POST /api/bookings/{id}/cancel` → `{booking}` (before start AND before free-cancel cutoff)
- `POST /api/bookings/{id}/reschedule` `{date, start_time, staff_id?}` → `{booking}` (same guards + availability re-check)

## Staff (auth + role:staff,admin)

- `GET /api/staff/schedule?date=Y-m-d&view=day` → `{date, bookings: [booking...]}` (own bookings; admin sees all staff's when `staff_id` passed)
- `GET /api/staff/schedule?view=week&date=Y-m-d` → `{week_start: "Y-m-d", days: [{date, bookings: [...]}]}`
- `GET /api/staff/shifts` → `{working_hours: [{id, day_of_week, start_time, end_time}], time_off: [...], blockouts: [...]}`
- `POST /api/staff/time-off` `{type: vacation|sick|other, starts_at: ISO, ends_at: ISO, note?}` → `201 {time_off}` (status `pending`)
- `POST /api/bookings/{id}/confirm|complete|no-show|cancel` → `{booking}` (assigned staff or admin; no-show only after start; cancel only before start)
- `POST /api/staff/walk-in` `{service_id, staff_id, date, start_time, customer_name, customer_phone, customer_email?, notes?}` → `201 {booking}` (status `booked`, source `walk_in`; links to existing customer by email/phone when found)

## Admin (auth + role:admin)

- `GET /api/admin/dashboard` → `{today: {count, bookings: [booking...]}, upcoming_7d: {count, expected_revenue_cents}, revenue: {today_cents, week_cents, month_cents}, customers: {new_count, returning_count}, no_show_rate, staff_occupancy: [{staff_id, name, booked_minutes, available_minutes, occupancy_pct}]}`
- `GET /api/admin/services` (all incl. inactive), `POST /api/admin/services`, `PUT /api/admin/services/{id}`, `DELETE /api/admin/services/{id}` (soft → `is_active=false`). Body: `{name, description, duration_minutes, buffer_minutes, price_cents, category_id, bookable_online, active, staff_ids[]}`
- `GET|POST /api/admin/service-categories`, `PUT|DELETE /api/admin/service-categories/{id}` — `{name, sort_order, active}`
- `GET /api/admin/staff`, `POST /api/admin/staff` `{name,email,phone,password,bio,photo_url,bookable_online,service_ids[]}`, `PUT /api/admin/staff/{id}`
- `GET /api/admin/working-hours?staff_id=`, `POST /api/admin/working-hours` `{user_id, day_of_week 0-6, start_time:"HH:MM", end_time:"HH:MM"}`, `DELETE /api/admin/working-hours/{id}` (multiple windows per day allowed)
- `GET /api/admin/time-off?status=`, `POST /api/admin/time-off/{id}/approve`, `POST /api/admin/time-off/{id}/decline`
- `GET /api/admin/blockouts`, `POST /api/admin/blockouts` `{staff_id? (null = whole salon), starts_at: ISO, ends_at: ISO, reason, blocks_online_booking}`, `DELETE /api/admin/blockouts/{id}`
- `GET /api/admin/bookings?date=&staff_id=&status=&search=`, `POST /api/admin/bookings` `{service_id, staff_id, date, start_time, customer_id?, guest_name?, customer_name?, customer_phone?, customer_email?, notes?, source?}`, `PUT /api/admin/bookings/{id}` `{date?, start_time?, staff_id?, service_id?, notes?, guest_name?}`
- `GET /api/admin/customers?search=`, `GET /api/admin/customers/{id}` → `{customer: {id,name,email,phone,notes,no_show_count,cancellation_count,total_spend_cents,created_at}, bookings: [...], stats: {...}}`
- `GET /api/admin/settings`, `PUT /api/admin/settings` `{salon_name, timezone, currency, phone, email, address, booking_window_days, lead_time_minutes, slot_step_minutes, free_cancellation_hours, cancellation_policy_text}`
- `GET /api/admin/notifications?booking_id=&status=` → `{notifications: [{id, booking_id, type, channel, scheduled_for, sent_at, status}]}`

## Booking resource shape

`{id, reference_code, status, source, starts_at, ends_at, starts_at_local: "Y-m-d H:i", date_label: "Mon, Oct 20", time_label: "9:30 AM", timezone, duration_minutes, service: {id, name, duration_minutes, price_cents}, staff: {id, name}, customer: {id|null, name, phone, email}, guest_name, notes, price_cents, free_cancel_deadline: ISO|null, can_cancel: bool, can_reschedule: bool, late_cancel: bool, cancel_reason, status_history: [{from,to,changed_by,changed_at}], created_at}`

## Auth

- `POST /api/auth/register` `{name, email, phone?, password, password_confirmation}` → `201 {user, token}` (role forced to `customer`)
- `POST /api/auth/login` `{email, password}` → `200 {user, token}` | `401 {"message":"Invalid credentials"}`
- `POST /api/auth/logout`, `GET /api/auth/me` → `{user}`

User resource: `{id, name, email, phone, role, photo_url, bio, bookable_online}`.
