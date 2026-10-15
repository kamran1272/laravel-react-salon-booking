<?php

namespace Database\Seeders;

use App\Models\Blockout;
use App\Models\Booking;
use App\Models\BookingStatusHistory;
use App\Models\Sale;
use App\Models\SalonSetting;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\TimeOff;
use App\Models\User;
use App\Models\WorkingHour;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class SalonSeeder extends Seeder
{
    /**
     * Demo logins (password for all: "password"):
     *   admin@demo.io    — salon owner / admin
     *   maria@demo.io    — staff (senior stylist)
     *   james@demo.io    — staff (barber / nail tech)
     *   customer@demo.io — customer
     *
     * Idempotent: safe to re-run; existing records are left untouched.
     */
    public function run(): void
    {
        $settings = $this->seedSettings();
        $categories = $this->seedCategories();
        [$maria, $james] = $this->seedStaff();
        $services = $this->seedServices($categories, [$maria, $james]);
        $this->seedWorkingHours([$maria, $james]);
        $this->seedTimeOff($james);
        $this->seedBlockouts($settings);
        $customer = $this->seedCustomer();
        $this->seedBookings($settings, $services, [$maria, $james], $customer);
    }

    protected function seedSettings(): SalonSetting
    {
        return SalonSetting::firstOrCreate([], [
            'salon_name' => 'Glow & Grace Salon',
            'timezone' => 'Asia/Karachi',
            'currency' => 'PKR',
            'phone' => '+92 300 1234567',
            'email' => 'hello@glowandgrace.example',
            'address' => '14-B Main Boulevard, Gulberg III, Lahore',
            'booking_window_days' => 42,
            'lead_time_minutes' => 120,
            'slot_step_minutes' => 15,
            'free_cancellation_hours' => 24,
            'cancellation_policy_text' => 'Free cancellation up to 24 hours before your appointment. Cancellations within 24 hours or no-shows may be charged in full.',
            'reminder_schedule' => [
                ['offset_hours' => 24, 'channel' => 'sms'],
                ['offset_hours' => 2, 'channel' => 'sms'],
            ],
        ]);
    }

    /**
     * @return array<string, ServiceCategory>
     */
    protected function seedCategories(): array
    {
        $names = ['Hair', 'Nails', 'Skin', 'Massage'];
        $categories = [];

        foreach ($names as $order => $name) {
            $categories[$name] = ServiceCategory::firstOrCreate(
                ['name' => $name],
                ['sort_order' => $order, 'is_active' => true]
            );
        }

        return $categories;
    }

    /**
     * @return array{User, User}
     */
    protected function seedStaff(): array
    {
        User::firstOrCreate(
            ['email' => 'admin@demo.io'],
            ['name' => 'Salon Owner', 'password' => 'password', 'role' => 'admin']
        );

        $maria = User::firstOrCreate(
            ['email' => 'maria@demo.io'],
            [
                'name' => 'Maria Santos',
                'password' => 'password',
                'role' => 'staff',
                'phone' => '+92 300 1111111',
                'bio' => 'Senior stylist with 8 years of experience in cuts and color.',
                'bookable_online' => true,
            ]
        );

        $james = User::firstOrCreate(
            ['email' => 'james@demo.io'],
            [
                'name' => 'James Carter',
                'password' => 'password',
                'role' => 'staff',
                'phone' => '+92 300 2222222',
                'bio' => 'Master barber and nail technician.',
                'bookable_online' => true,
            ]
        );

        return [$maria, $james];
    }

    /**
     * The service menu, with staff assignments.
     * Format: [name, description, duration, buffer, price_cents, category, staff indexes]
     *
     * @return array<string, Service>
     */
    protected function seedServices(array $categories, array $staff): array
    {
        $menu = [
            ['Classic Haircut', 'Consultation, precision cut, wash and style.', 30, 10, 2500, 'Hair', [0, 1]],
            ['Beard Trim & Shape', 'Hot-towel prep, precision trim, razor finish.', 20, 5, 1500, 'Hair', [1]],
            ['Hair Coloring', 'Full color with premium dye, wash and style included.', 90, 15, 8000, 'Hair', [0]],
            ['Bridal Hair & Makeup', 'Trial session plus wedding-day hair and makeup.', 180, 15, 25000, 'Hair', [0]],
            ['Manicure', 'Nail shaping, cuticle care, polish of your choice.', 45, 10, 3000, 'Nails', [1]],
            ['Spa Pedicure', 'Soak, exfoliation, massage and polish.', 60, 10, 4000, 'Nails', [1]],
            ['Classic Facial', 'Cleanse, exfoliation, mask and moisturizing massage.', 60, 10, 5500, 'Skin', [0]],
            ['Deep Tissue Massage', 'Therapeutic full-body massage for tension relief.', 60, 15, 7000, 'Massage', [0, 1]],
        ];

        $services = [];

        foreach ($menu as [$name, $description, $duration, $buffer, $priceCents, $category, $staffIndexes]) {
            $service = Service::firstOrCreate(
                ['name' => $name],
                [
                    'category_id' => $categories[$category]->id,
                    'description' => $description,
                    'duration_minutes' => $duration,
                    'buffer_minutes' => $buffer,
                    'price_cents' => $priceCents,
                    'bookable_online' => true,
                    'is_active' => true,
                ]
            );

            $service->staff()->syncWithoutDetaching(
                array_map(fn ($i) => $staff[$i]->id, $staffIndexes)
            );

            $services[$name] = $service;
        }

        return $services;
    }

    /**
     * Split shifts with a lunch gap: 09:00–13:00 and 14:00–18:00,
     * Monday–Saturday. Sunday closed.
     */
    protected function seedWorkingHours(array $staff): void
    {
        foreach ($staff as $member) {
            foreach (range(1, 6) as $day) {
                WorkingHour::firstOrCreate(
                    ['user_id' => $member->id, 'day_of_week' => $day, 'start_time' => '09:00:00'],
                    ['end_time' => '13:00:00']
                );
                WorkingHour::firstOrCreate(
                    ['user_id' => $member->id, 'day_of_week' => $day, 'start_time' => '14:00:00'],
                    ['end_time' => '18:00:00']
                );
            }
        }
    }

    /**
     * One approved vacation for James next week (shows up as unavailable).
     */
    protected function seedTimeOff(User $james): void
    {
        $start = Carbon::now('Asia/Karachi')->addDays(8)->startOfDay();

        TimeOff::firstOrCreate(
            [
                'user_id' => $james->id,
                'starts_at' => $start->copy()->setTimezone('UTC'),
                'ends_at' => $start->copy()->addDays(2)->setTimezone('UTC'),
            ],
            ['type' => 'vacation', 'status' => TimeOff::STATUS_APPROVED, 'note' => 'Family wedding.']
        );
    }

    /**
     * A salon-wide holiday blockout three weeks out.
     */
    protected function seedBlockouts(SalonSetting $settings): void
    {
        $day = Carbon::now($settings->timezone)->addDays(21)->startOfDay();

        Blockout::firstOrCreate(
            [
                'staff_id' => null,
                'starts_at' => $day->copy()->setTimezone('UTC'),
                'ends_at' => $day->copy()->addDay()->setTimezone('UTC'),
            ],
            ['reason' => 'Public holiday — salon closed', 'blocks_online_booking' => true]
        );
    }

    protected function seedCustomer(): User
    {
        return User::firstOrCreate(
            ['email' => 'customer@demo.io'],
            [
                'name' => 'Demo Customer',
                'password' => 'password',
                'role' => 'customer',
                'phone' => '+92 300 3333333',
            ]
        );
    }

    /**
     * A realistic spread: past completed bookings (with sales), today's
     * schedule, future confirmed bookings, one no-show, one guest booking.
     */
    protected function seedBookings(SalonSetting $settings, array $services, array $staff, User $customer): void
    {
        $tz = $settings->timezone;
        $notifications = app(NotificationService::class);

        // [days offset, "H:i", service, staff index, status, source]
        $plan = [
            [-4, '10:00', 'Classic Haircut', 0, Booking::STATUS_COMPLETED, Booking::SOURCE_ONLINE],
            [-4, '14:30', 'Manicure', 1, Booking::STATUS_COMPLETED, Booking::SOURCE_ONLINE],
            [-3, '09:30', 'Beard Trim & Shape', 1, Booking::STATUS_COMPLETED, Booking::SOURCE_WALK_IN],
            [-3, '11:00', 'Classic Facial', 0, Booking::STATUS_COMPLETED, Booking::SOURCE_ONLINE],
            [-2, '10:00', 'Spa Pedicure', 1, Booking::STATUS_COMPLETED, Booking::SOURCE_PHONE],
            [-2, '15:00', 'Hair Coloring', 0, Booking::STATUS_NO_SHOW, Booking::SOURCE_ONLINE],
            [-1, '12:00', 'Deep Tissue Massage', 0, Booking::STATUS_COMPLETED, Booking::SOURCE_ONLINE],
            [0, '09:30', 'Classic Haircut', 0, Booking::STATUS_CONFIRMED, Booking::SOURCE_ONLINE],
            [0, '11:00', 'Manicure', 1, Booking::STATUS_CONFIRMED, Booking::SOURCE_ONLINE],
            [0, '15:00', 'Beard Trim & Shape', 1, Booking::STATUS_BOOKED, Booking::SOURCE_WALK_IN],
            [1, '10:00', 'Spa Pedicure', 1, Booking::STATUS_CONFIRMED, Booking::SOURCE_ONLINE],
            [1, '14:00', 'Hair Coloring', 0, Booking::STATUS_CONFIRMED, Booking::SOURCE_ONLINE],
            [2, '09:30', 'Classic Facial', 0, Booking::STATUS_BOOKED, Booking::SOURCE_PHONE],
            [3, '16:00', 'Deep Tissue Massage', 1, Booking::STATUS_CONFIRMED, Booking::SOURCE_ONLINE],
        ];

        foreach ($plan as $i => [$offset, $time, $serviceName, $staffIndex, $status, $source]) {
            $service = $services[$serviceName];
            $member = $staff[$staffIndex];

            $local = Carbon::now($tz)->addDays($offset);
            [$hour, $minute] = explode(':', $time);
            $local->setTime((int) $hour, (int) $minute, 0);

            // Deterministic reference so re-runs don't duplicate bookings.
            $reference = sprintf('BK-DEMO%02d', $i);

            $booking = Booking::firstOrCreate(
                ['reference_code' => $reference],
                [
                    'customer_id' => $customer->id,
                    'staff_id' => $member->id,
                    'service_id' => $service->id,
                    'starts_at' => $local->copy()->setTimezone('UTC'),
                    'ends_at' => $local->copy()->addMinutes($service->duration_minutes + $service->buffer_minutes)->setTimezone('UTC'),
                    'status' => $status,
                    'source' => $source,
                    'service_name' => $service->name,
                    'duration_minutes' => $service->duration_minutes,
                    'price_cents' => $service->price_cents,
                    'notes' => null,
                ]
            );

            if ($booking->wasRecentlyCreated) {
                BookingStatusHistory::create([
                    'booking_id' => $booking->id,
                    'from_status' => null,
                    'to_status' => $status,
                    'changed_by' => null,
                    'changed_by_type' => BookingStatusHistory::BY_SYSTEM,
                    'note' => 'Seeded demo booking.',
                ]);

                if ($status === Booking::STATUS_COMPLETED) {
                    Sale::create([
                        'booking_id' => $booking->id,
                        'staff_id' => $member->id,
                        'total_cents' => $service->price_cents,
                        'payment_method' => 'cash',
                    ]);
                    $customer->increment('total_spend_cents', $service->price_cents);
                }

                if ($status === Booking::STATUS_NO_SHOW) {
                    $customer->increment('no_show_count');
                }

                // Confirmation record for upcoming bookings.
                if (in_array($status, [Booking::STATUS_BOOKED, Booking::STATUS_CONFIRMED], true)
                    && $local->isFuture()
                ) {
                    $notifications->recordConfirmation($booking);
                }
            }
        }

        // One guest booking (no account) for tomorrow.
        $guestLocal = Carbon::now($tz)->addDay()->setTime(11, 30, 0);
        $guestService = $services['Manicure'];

        $guest = Booking::firstOrCreate(
            ['reference_code' => 'BK-GUEST01'],
            [
                'customer_id' => null,
                'staff_id' => $staff[1]->id,
                'service_id' => $guestService->id,
                'starts_at' => $guestLocal->copy()->setTimezone('UTC'),
                'ends_at' => $guestLocal->copy()->addMinutes($guestService->duration_minutes + $guestService->buffer_minutes)->setTimezone('UTC'),
                'status' => Booking::STATUS_CONFIRMED,
                'source' => Booking::SOURCE_ONLINE,
                'service_name' => $guestService->name,
                'duration_minutes' => $guestService->duration_minutes,
                'price_cents' => $guestService->price_cents,
                'guest_name' => 'Ayesha Khan',
                'guest_phone' => '+92 300 4444444',
            ]
        );

        if ($guest->wasRecentlyCreated) {
            BookingStatusHistory::create([
                'booking_id' => $guest->id,
                'from_status' => null,
                'to_status' => Booking::STATUS_CONFIRMED,
                'changed_by' => null,
                'changed_by_type' => BookingStatusHistory::BY_SYSTEM,
                'note' => 'Seeded guest booking.',
            ]);
            $notifications->recordConfirmation($guest);
        }
    }
}
