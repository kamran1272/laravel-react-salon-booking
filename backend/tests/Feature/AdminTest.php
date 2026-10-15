<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\TimeOff;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsSalonFixtures;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase, BuildsSalonFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedSalon();
    }

    public function test_dashboard_requires_admin(): void
    {
        $this->actingAs($this->customer)->getJson('/api/admin/dashboard')->assertStatus(403);
        $this->actingAs($this->staff)->getJson('/api/admin/dashboard')->assertStatus(403);
        $this->actingAs($this->admin)->getJson('/api/admin/dashboard')->assertStatus(200);
    }

    public function test_dashboard_returns_the_spec_metrics(): void
    {
        // A completed booking today contributes revenue.
        $this->makeBooking([
            'status' => Booking::STATUS_COMPLETED,
            'starts_at' => $this->salonNow()->copy()->setTime(9, 30, 0),
        ]);

        $this->actingAs($this->admin)
            ->getJson('/api/admin/dashboard')
            ->assertStatus(200)
            ->assertJsonStructure([
                'today' => ['count', 'bookings'],
                'upcoming_7d' => ['count', 'expected_revenue_cents'],
                'revenue' => ['today_cents', 'week_cents', 'month_cents'],
                'customers' => ['new_count', 'returning_count', 'total'],
                'no_show_rate',
                'staff_occupancy',
                'timezone',
            ])
            ->assertJsonPath('revenue.today_cents', $this->service->price_cents);
    }

    public function test_admin_can_create_service_with_staff_assignment(): void
    {
        $category = \App\Models\ServiceCategory::factory()->create();

        $this->actingAs($this->admin)->postJson('/api/admin/services', [
            'name' => 'Hot Towel Shave',
            'category_id' => $category->id,
            'duration_minutes' => 25,
            'buffer_minutes' => 5,
            'price_cents' => 1800,
            'bookable_online' => true,
            'staff_ids' => [$this->staff->id],
        ])
            ->assertStatus(201)
            ->assertJsonPath('service.name', 'Hot Towel Shave');

        $this->assertDatabaseHas('services', ['name' => 'Hot Towel Shave', 'price_cents' => 1800]);
        $this->assertDatabaseHas('staff_service', [
            'user_id' => $this->staff->id,
        ]);
    }

    public function test_deleting_a_service_keeps_bookings_via_snapshot(): void
    {
        $booking = $this->makeBooking();

        $this->actingAs($this->admin)
            ->deleteJson("/api/admin/services/{$this->service->id}")
            ->assertStatus(200);

        // Service deactivated, not hard-deleted...
        $this->assertFalse($this->service->fresh()->is_active);
        // ...and the booking keeps its name/price/duration snapshot.
        $this->assertEquals(
            $this->service->name,
            $booking->fresh()->service_name
        );
    }

    public function test_admin_can_create_booking_with_full_control(): void
    {
        $date = $this->salonNow()->copy()->addDays(2)->toDateString();

        $this->actingAs($this->admin)->postJson('/api/admin/bookings', [
            'service_id' => $this->service->id,
            'staff_id' => $this->staff->id,
            'date' => $date,
            'start_time' => '14:00',
            'customer_id' => $this->customer->id,
            'source' => 'phone',
        ])
            ->assertStatus(201)
            ->assertJsonPath('booking.status', Booking::STATUS_BOOKED);

        $this->assertDatabaseHas('bookings', [
            'customer_id' => $this->customer->id,
            'source' => 'phone',
        ]);
    }

    public function test_admin_can_move_a_booking_to_another_time(): void
    {
        $booking = $this->makeBooking();
        $newDate = $this->salonNow()->copy()->addDays(5)->toDateString();

        $this->actingAs($this->admin)
            ->putJson("/api/admin/bookings/{$booking->id}", [
                'date' => $newDate,
                'start_time' => '15:00',
            ])
            ->assertStatus(200)
            ->assertJsonPath('booking.starts_at_local', $newDate.' 15:00');
    }

    public function test_admin_cannot_edit_terminal_booking(): void
    {
        $booking = $this->makeBooking(['status' => Booking::STATUS_COMPLETED]);

        $this->actingAs($this->admin)
            ->putJson("/api/admin/bookings/{$booking->id}", ['notes' => 'changed'])
            ->assertStatus(422);
    }

    public function test_customers_endpoints(): void
    {
        $this->makeBooking(['status' => Booking::STATUS_COMPLETED]);

        $this->actingAs($this->admin)
            ->getJson('/api/admin/customers')
            ->assertStatus(200);

        $this->actingAs($this->admin)
            ->getJson("/api/admin/customers/{$this->customer->id}")
            ->assertStatus(200)
            ->assertJsonPath('stats.visits', 1);
    }

    public function test_settings_update(): void
    {
        $this->actingAs($this->admin)
            ->putJson('/api/admin/settings', ['free_cancellation_hours' => 48])
            ->assertStatus(200)
            ->assertJsonPath('settings.free_cancellation_hours', 48);

        $this->assertEquals(48, $this->settings->fresh()->free_cancellation_hours);
    }

    public function test_time_off_approve_and_decline(): void
    {
        $timeOff = TimeOff::create([
            'user_id' => $this->staff->id,
            'type' => 'sick',
            'starts_at' => $this->salonNow()->copy()->addDays(4)->startOfDay()->setTimezone('UTC'),
            'ends_at' => $this->salonNow()->copy()->addDays(4)->endOfDay()->setTimezone('UTC'),
            'status' => TimeOff::STATUS_PENDING,
        ]);

        $this->actingAs($this->admin)
            ->postJson("/api/admin/time-off/{$timeOff->id}/approve")
            ->assertStatus(200)
            ->assertJsonPath('time_off.status', TimeOff::STATUS_APPROVED);

        $timeOff2 = TimeOff::create([
            'user_id' => $this->staff->id,
            'type' => 'vacation',
            'starts_at' => $this->salonNow()->copy()->addDays(5)->startOfDay()->setTimezone('UTC'),
            'ends_at' => $this->salonNow()->copy()->addDays(5)->endOfDay()->setTimezone('UTC'),
            'status' => TimeOff::STATUS_PENDING,
        ]);

        $this->actingAs($this->admin)
            ->postJson("/api/admin/time-off/{$timeOff2->id}/decline")
            ->assertStatus(200)
            ->assertJsonPath('time_off.status', TimeOff::STATUS_DECLINED);
    }
}
