<?php

namespace Tests\Feature\Concerns;

use App\Models\Booking;
use App\Models\SalonSetting;
use App\Models\Service;
use App\Models\User;
use App\Models\WorkingHour;
use Carbon\Carbon;
use Illuminate\Support\Str;

/**
 * Shared fixtures for salon feature tests: settings, users, a service
 * with a staff assignment, and full-day working hours for the staff.
 */
trait BuildsSalonFixtures
{
    protected SalonSetting $settings;
    protected User $admin;
    protected User $staff;
    protected User $customer;
    protected Service $service;

    protected function seedSalon(): void
    {
        $this->settings = SalonSetting::create([
            'salon_name' => 'Test Salon',
            'timezone' => 'Asia/Karachi',
            'currency' => 'PKR',
            'phone' => '+92 300 1234567',
            'email' => 'test@example.com',
            'booking_window_days' => 42,
            'lead_time_minutes' => 120,
            'slot_step_minutes' => 15,
            'free_cancellation_hours' => 24,
            'cancellation_policy_text' => 'Test policy: free cancellation up to 24 hours before.',
            'reminder_schedule' => [
                ['offset_hours' => 24, 'channel' => 'sms'],
                ['offset_hours' => 2, 'channel' => 'sms'],
            ],
        ]);

        $this->admin = User::factory()->create(['role' => 'admin']);
        $this->staff = User::factory()->create(['role' => 'staff']);
        $this->customer = User::factory()->create(['role' => 'customer']);

        $this->service = Service::factory()->create([
            'duration_minutes' => 30,
            'buffer_minutes' => 10,
            'price_cents' => 2500,
        ]);
        $this->service->staff()->attach($this->staff->id);

        // Staff works every day, 09:00–18:00 (salon-local).
        foreach (range(0, 6) as $day) {
            WorkingHour::create([
                'user_id' => $this->staff->id,
                'day_of_week' => $day,
                'start_time' => '09:00:00',
                'end_time' => '18:00:00',
            ]);
        }
    }

    /**
     * Now, in the salon's timezone.
     */
    protected function salonNow(): Carbon
    {
        return Carbon::now($this->settings->timezone);
    }

    /**
     * Direct booking insert (bypasses the API), stored in UTC.
     * Pass starts_at in salon-local time.
     */
    protected function makeBooking(array $overrides = []): Booking
    {
        $service = $overrides['service'] ?? $this->service;
        $startsAt = $overrides['starts_at'] ?? $this->salonNow()->copy()->addDays(2)->setTime(10, 0, 0);
        $endsAt = $startsAt->copy()->addMinutes($service->duration_minutes + $service->buffer_minutes);

        unset($overrides['service'], $overrides['starts_at']);

        return Booking::create(array_merge([
            'reference_code' => 'BK-'.strtoupper(Str::random(6)),
            'customer_id' => $this->customer->id,
            'staff_id' => $this->staff->id,
            'service_id' => $service->id,
            'starts_at' => $startsAt->copy()->setTimezone('UTC'),
            'ends_at' => $endsAt->copy()->setTimezone('UTC'),
            'status' => Booking::STATUS_CONFIRMED,
            'source' => Booking::SOURCE_ONLINE,
            'service_name' => $service->name,
            'duration_minutes' => $service->duration_minutes,
            'price_cents' => $service->price_cents,
        ], $overrides));
    }

    /**
     * Payload for POST /api/bookings.
     */
    protected function bookingPayload(array $overrides = []): array
    {
        $date = $overrides['date'] ?? $this->salonNow()->copy()->addDays(2)->toDateString();

        return array_merge([
            'service_id' => $this->service->id,
            'date' => $date,
            'start_time' => '10:00',
            'policy_accepted' => true,
            'customer' => [
                'first_name' => 'Guest',
                'last_name' => 'User',
                'phone' => '+92 300 9999999',
                'email' => 'guest-booking@example.com',
            ],
        ], $overrides);
    }
}
