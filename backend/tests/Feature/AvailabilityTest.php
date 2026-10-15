<?php

namespace Tests\Feature;

use App\Models\Blockout;
use App\Models\TimeOff;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsSalonFixtures;
use Tests\TestCase;

class AvailabilityTest extends TestCase
{
    use RefreshDatabase, BuildsSalonFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedSalon();
    }

    public function test_slots_come_in_15_minute_steps_within_shifts(): void
    {
        $date = $this->salonNow()->copy()->addDays(3)->toDateString();

        $response = $this->getJson(
            "/api/availability?service_id={$this->service->id}&date={$date}&staff_id={$this->staff->id}"
        );

        $response->assertStatus(200);
        $slots = $response->json('slots');

        $this->assertNotEmpty($slots);
        $this->assertEquals('09:00', $slots[0]);
        $this->assertEquals('09:15', $slots[1]);

        // Last slot must end (service + buffer) exactly at shift end.
        $last = end($slots);
        $occupied = $this->service->duration_minutes + $this->service->buffer_minutes;
        $end = Carbon::createFromFormat('H:i', $last, $this->settings->timezone)->addMinutes($occupied);
        $this->assertEquals('18:00', $end->format('H:i'));
    }

    public function test_taken_slots_are_excluded_from_availability(): void
    {
        $date = $this->salonNow()->copy()->addDays(3)->toDateString();

        // Booking at 10:00 occupies 10:00–10:40 (30 + 10 buffer).
        $this->postJson('/api/bookings', $this->bookingPayload([
            'date' => $date,
            'start_time' => '10:00',
            'staff_id' => $this->staff->id,
        ]))->assertStatus(201);

        $slots = $this->getJson(
            "/api/availability?service_id={$this->service->id}&date={$date}&staff_id={$this->staff->id}"
        )->json('slots');

        $this->assertContains('09:00', $slots);
        $this->assertContains('09:30', $slots);
        $this->assertNotContains('10:00', $slots);
        $this->assertNotContains('10:15', $slots);
        $this->assertNotContains('10:30', $slots);
        $this->assertContains('10:40', $slots);
    }

    public function test_fully_booked_day_is_flagged_and_greyed_in_calendar(): void
    {
        $date = $this->salonNow()->copy()->addDays(3);

        // Occupy every 15-minute start candidate in the 09:00–18:00 day.
        $occupied = $this->service->duration_minutes + $this->service->buffer_minutes;
        $cursor = $date->copy()->setTime(9, 0, 0);
        $dayEnd = $date->copy()->setTime(18, 0, 0);

        while ($cursor->copy()->addMinutes($occupied)->lte($dayEnd)) {
            $this->makeBooking(['starts_at' => $cursor->copy()]);
            $cursor->addMinutes(15);
        }

        $dateStr = $date->toDateString();

        $day = $this->getJson(
            "/api/availability?service_id={$this->service->id}&date={$dateStr}&staff_id={$this->staff->id}"
        );

        $day->assertStatus(200)
            ->assertJsonPath('slots', [])
            ->assertJsonPath('fully_booked', true);

        // The calendar flags the same day as unavailable (greyed out).
        $calendar = $this->getJson(
            "/api/availability/calendar?service_id={$this->service->id}&staff_id={$this->staff->id}&from={$dateStr}&to={$dateStr}"
        );

        $calendar->assertStatus(200)
            ->assertJsonPath("days.{$dateStr}.available", false)
            ->assertJsonPath("days.{$dateStr}.slots_count", 0);
    }

    public function test_approved_time_off_removes_staff_availability(): void
    {
        $day = $this->salonNow()->copy()->addDays(3);
        $dateStr = $day->toDateString();

        TimeOff::create([
            'user_id' => $this->staff->id,
            'type' => 'vacation',
            'starts_at' => $day->copy()->startOfDay()->setTimezone('UTC'),
            'ends_at' => $day->copy()->endOfDay()->setTimezone('UTC'),
            'status' => TimeOff::STATUS_APPROVED,
        ]);

        $this->getJson(
            "/api/availability?service_id={$this->service->id}&date={$dateStr}&staff_id={$this->staff->id}"
        )
            ->assertStatus(200)
            ->assertJsonPath('slots', [])
            ->assertJsonPath('fully_booked', true);
    }

    public function test_pending_time_off_does_not_block_availability(): void
    {
        $day = $this->salonNow()->copy()->addDays(3);
        $dateStr = $day->toDateString();

        TimeOff::create([
            'user_id' => $this->staff->id,
            'type' => 'vacation',
            'starts_at' => $day->copy()->startOfDay()->setTimezone('UTC'),
            'ends_at' => $day->copy()->endOfDay()->setTimezone('UTC'),
            'status' => TimeOff::STATUS_PENDING,
        ]);

        $this->getJson(
            "/api/availability?service_id={$this->service->id}&date={$dateStr}&staff_id={$this->staff->id}"
        )
            ->assertStatus(200)
            ->assertJsonPath('fully_booked', false);
    }

    public function test_salon_wide_blockout_closes_booking_for_the_day(): void
    {
        $day = $this->salonNow()->copy()->addDays(3);
        $dateStr = $day->toDateString();

        Blockout::create([
            'staff_id' => null, // whole salon
            'starts_at' => $day->copy()->startOfDay()->setTimezone('UTC'),
            'ends_at' => $day->copy()->endOfDay()->setTimezone('UTC'),
            'reason' => 'Public holiday',
            'blocks_online_booking' => true,
        ]);

        $this->getJson(
            "/api/availability?service_id={$this->service->id}&date={$dateStr}"
        )
            ->assertStatus(200)
            ->assertJsonPath('fully_booked', true);
    }

    public function test_booking_beyond_the_booking_window_is_rejected(): void
    {
        $far = $this->salonNow()->copy()->addDays(60);

        $slots = $this->getJson(
            "/api/availability?service_id={$this->service->id}&date={$far->toDateString()}&staff_id={$this->staff->id}"
        )->json('slots');

        $this->assertSame([], $slots);
    }
}
