<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Sale;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsSalonFixtures;
use Tests\TestCase;

class BookingLifecycleTest extends TestCase
{
    use RefreshDatabase, BuildsSalonFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedSalon();
    }

    public function test_staff_can_confirm_a_booked_booking(): void
    {
        $booking = $this->makeBooking(['status' => Booking::STATUS_BOOKED]);

        $this->actingAs($this->staff)
            ->postJson("/api/bookings/{$booking->id}/confirm")
            ->assertStatus(200)
            ->assertJsonPath('booking.status', Booking::STATUS_CONFIRMED);

        $this->assertEquals(Booking::STATUS_CONFIRMED, $booking->fresh()->status);
    }

    public function test_staff_cannot_act_on_other_staff_booking(): void
    {
        $otherStaff = \App\Models\User::factory()->create(['role' => 'staff']);
        $booking = $this->makeBooking(['status' => Booking::STATUS_BOOKED]);

        $this->actingAs($otherStaff)
            ->postJson("/api/bookings/{$booking->id}/confirm")
            ->assertStatus(403);
    }

    public function test_booked_cannot_jump_straight_to_completed(): void
    {
        $booking = $this->makeBooking(['status' => Booking::STATUS_BOOKED]);

        $this->actingAs($this->staff)
            ->postJson("/api/bookings/{$booking->id}/complete")
            ->assertStatus(422);

        $this->assertEquals(Booking::STATUS_BOOKED, $booking->fresh()->status);
    }

    public function test_terminal_states_reject_every_transition(): void
    {
        foreach (Booking::TERMINAL_STATUSES as $terminal) {
            $booking = $this->makeBooking(['status' => $terminal]);

            $this->actingAs($this->admin)
                ->postJson("/api/bookings/{$booking->id}/confirm")
                ->assertStatus(422);

            $this->assertEquals($terminal, $booking->fresh()->status);
        }
    }

    public function test_complete_creates_sale_and_increments_spend(): void
    {
        $booking = $this->makeBooking(['status' => Booking::STATUS_CONFIRMED]);

        $this->actingAs($this->staff)
            ->postJson("/api/bookings/{$booking->id}/complete")
            ->assertStatus(200)
            ->assertJsonPath('booking.status', Booking::STATUS_COMPLETED);

        $this->assertDatabaseHas('sales', [
            'booking_id' => $booking->id,
            'staff_id' => $this->staff->id,
            'total_cents' => $this->service->price_cents,
        ]);

        $this->assertEquals(
            $this->service->price_cents,
            $this->customer->fresh()->total_spend_cents
        );
    }

    public function test_no_show_allowed_only_after_start_and_counts(): void
    {
        // Past booking: no-show allowed.
        $past = $this->makeBooking([
            'status' => Booking::STATUS_CONFIRMED,
            'starts_at' => $this->salonNow()->copy()->subHours(2),
        ]);

        $this->actingAs($this->staff)
            ->postJson("/api/bookings/{$past->id}/no-show")
            ->assertStatus(200)
            ->assertJsonPath('booking.status', Booking::STATUS_NO_SHOW);

        $this->assertEquals(1, $this->customer->fresh()->no_show_count);

        // Future booking: no-show rejected.
        $future = $this->makeBooking(['status' => Booking::STATUS_CONFIRMED]);

        $this->actingAs($this->staff)
            ->postJson("/api/bookings/{$future->id}/no-show")
            ->assertStatus(422);

        $this->assertEquals(Booking::STATUS_CONFIRMED, $future->fresh()->status);
    }

    public function test_staff_cancel_allowed_only_before_start(): void
    {
        $future = $this->makeBooking(['status' => Booking::STATUS_CONFIRMED]);

        $this->actingAs($this->staff)
            ->postJson("/api/bookings/{$future->id}/cancel", ['reason' => 'Client asked by phone.'])
            ->assertStatus(200)
            ->assertJsonPath('booking.status', Booking::STATUS_CANCELLED);

        $past = $this->makeBooking([
            'status' => Booking::STATUS_CONFIRMED,
            'starts_at' => $this->salonNow()->copy()->subHours(2),
        ]);

        $this->actingAs($this->staff)
            ->postJson("/api/bookings/{$past->id}/cancel")
            ->assertStatus(422);
    }

    public function test_every_transition_writes_status_history(): void
    {
        $booking = $this->makeBooking(['status' => Booking::STATUS_BOOKED]);

        $this->actingAs($this->staff)
            ->postJson("/api/bookings/{$booking->id}/confirm")
            ->assertStatus(200);

        $history = $booking->fresh()->statusHistory;
        $this->assertNotEmpty($history);
        $last = $history->last();
        $this->assertEquals(Booking::STATUS_BOOKED, $last->from_status);
        $this->assertEquals(Booking::STATUS_CONFIRMED, $last->to_status);
    }

    public function test_complete_requires_staff_or_admin_role(): void
    {
        $booking = $this->makeBooking(['status' => Booking::STATUS_CONFIRMED]);

        $this->actingAs($this->customer)
            ->postJson("/api/bookings/{$booking->id}/complete")
            ->assertStatus(403);
    }
}
