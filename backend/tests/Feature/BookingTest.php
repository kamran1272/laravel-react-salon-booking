<?php

namespace Tests\Feature;

use App\Models\Booking;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsSalonFixtures;
use Tests\TestCase;

class BookingTest extends TestCase
{
    use RefreshDatabase, BuildsSalonFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedSalon();
    }

    public function test_guest_can_book_with_policy_accepted_and_gets_reference_code(): void
    {
        $response = $this->postJson('/api/bookings', $this->bookingPayload());

        $response->assertStatus(201)
            ->assertJsonStructure([
                'booking' => ['id', 'reference_code', 'status', 'starts_at', 'ends_at', 'price_cents', 'free_cancel_deadline'],
            ])
            ->assertJsonPath('booking.status', Booking::STATUS_CONFIRMED);

        // Reference code format: BK-XXXXXX.
        $this->assertMatchesRegularExpression('/^BK-[A-Z0-9]{6}$/', $response->json('booking.reference_code'));

        // Policy accepted online => confirmed immediately.
        $this->assertDatabaseHas('bookings', [
            'reference_code' => $response->json('booking.reference_code'),
            'status' => Booking::STATUS_CONFIRMED,
        ]);
    }

    public function test_guest_booking_requires_policy_acceptance(): void
    {
        $payload = $this->bookingPayload();
        unset($payload['policy_accepted']);

        $this->postJson('/api/bookings', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('policy_accepted');

        $this->assertEquals(0, Booking::count());
    }

    public function test_authenticated_customer_can_book_for_themselves(): void
    {
        $response = $this->actingAs($this->customer)
            ->postJson('/api/bookings', $this->bookingPayload());

        $response->assertStatus(201);

        $this->assertDatabaseHas('bookings', [
            'reference_code' => $response->json('booking.reference_code'),
            'customer_id' => $this->customer->id,
            'status' => Booking::STATUS_CONFIRMED,
        ]);
    }

    public function test_double_booking_same_slot_is_rejected(): void
    {
        $payload = $this->bookingPayload();

        $this->postJson('/api/bookings', $payload)->assertStatus(201);
        $this->postJson('/api/bookings', $payload)->assertStatus(422);

        $this->assertEquals(1, Booking::count());
    }

    public function test_booking_respects_buffer_and_fails_on_overlap(): void
    {
        // First booking: 10:00–10:40 (30 min service + 10 min buffer).
        $this->postJson('/api/bookings', $this->bookingPayload())->assertStatus(201);

        // 10:15 overlaps the first booking's interval -> rejected.
        $this->postJson('/api/bookings', $this->bookingPayload(['start_time' => '10:15']))
            ->assertStatus(422);

        // 10:40 starts exactly when the occupied interval ends -> allowed.
        $this->postJson('/api/bookings', $this->bookingPayload(['start_time' => '10:40']))
            ->assertStatus(201);

        $this->assertEquals(2, Booking::count());
    }

    public function test_any_available_assigns_a_staff_member(): void
    {
        // staff_id omitted ("any available").
        $payload = $this->bookingPayload();
        unset($payload['staff_id']);

        $response = $this->postJson('/api/bookings', $payload);

        $response->assertStatus(201);
        $this->assertEquals($this->staff->id, $response->json('booking.staff.id'));
    }

    public function test_booking_within_lead_time_is_rejected(): void
    {
        $soon = $this->salonNow()->copy()->addMinutes(30);
        $payload = $this->bookingPayload([
            'date' => $soon->toDateString(),
            'start_time' => $soon->format('H:i'),
        ]);

        $this->postJson('/api/bookings', $payload)->assertStatus(422);
    }

    public function test_customer_can_cancel_own_booking_before_cutoff(): void
    {
        $booking = $this->makeBooking(['customer_id' => $this->customer->id]);

        $this->actingAs($this->customer)
            ->postJson("/api/bookings/{$booking->id}/cancel")
            ->assertStatus(200)
            ->assertJsonPath('booking.status', Booking::STATUS_CANCELLED);

        $this->assertEquals(1, $this->customer->fresh()->cancellation_count);
    }

    public function test_customer_cannot_cancel_inside_free_cancellation_cutoff(): void
    {
        // Starts in 12 hours — inside the 24h cutoff.
        $booking = $this->makeBooking([
            'customer_id' => $this->customer->id,
            'starts_at' => $this->salonNow()->copy()->addHours(12)->startOfHour(),
        ]);

        $this->actingAs($this->customer)
            ->postJson("/api/bookings/{$booking->id}/cancel")
            ->assertStatus(422)
            ->assertJsonPath('contact_salon', true);

        $this->assertEquals(Booking::STATUS_CONFIRMED, $booking->fresh()->status);
    }

    public function test_customer_cannot_cancel_booking_that_already_started(): void
    {
        $booking = $this->makeBooking([
            'customer_id' => $this->customer->id,
            'starts_at' => $this->salonNow()->copy()->subHour(),
        ]);

        $this->actingAs($this->customer)
            ->postJson("/api/bookings/{$booking->id}/cancel")
            ->assertStatus(422);

        $this->assertEquals(Booking::STATUS_CONFIRMED, $booking->fresh()->status);
    }

    public function test_customer_cannot_cancel_others_booking(): void
    {
        $booking = $this->makeBooking();

        $other = \App\Models\User::factory()->create(['role' => 'customer']);

        $this->actingAs($other)
            ->postJson("/api/bookings/{$booking->id}/cancel")
            ->assertStatus(404);
    }

    public function test_guest_can_lookup_and_cancel_with_reference_and_email(): void
    {
        $create = $this->postJson('/api/bookings', $this->bookingPayload());
        $create->assertStatus(201);
        $reference = $create->json('booking.reference_code');

        $this->postJson('/api/bookings/manage/lookup', [
            'reference_code' => $reference,
            'email' => 'guest-booking@example.com',
        ])
            ->assertStatus(200)
            ->assertJsonPath('booking.reference_code', $reference);

        $this->postJson("/api/bookings/manage/{$reference}/cancel", [
            'reference_code' => $reference,
            'email' => 'guest-booking@example.com',
        ])
            ->assertStatus(200)
            ->assertJsonPath('booking.status', Booking::STATUS_CANCELLED);

        // Wrong email must not match.
        $this->postJson('/api/bookings/manage/lookup', [
            'reference_code' => $reference,
            'email' => 'someone-else@example.com',
        ])->assertStatus(404);
    }

    public function test_customer_can_reschedule_own_booking_before_cutoff(): void
    {
        $booking = $this->makeBooking(['customer_id' => $this->customer->id]);
        $newDate = $this->salonNow()->copy()->addDays(4)->toDateString();

        $this->actingAs($this->customer)
            ->postJson("/api/bookings/{$booking->id}/reschedule", [
                'date' => $newDate,
                'start_time' => '11:00',
            ])
            ->assertStatus(200)
            ->assertJsonPath('booking.starts_at_local', $newDate.' 11:00');
    }
}
