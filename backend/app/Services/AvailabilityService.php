<?php

namespace App\Services;

use App\Models\Blockout;
use App\Models\Booking;
use App\Models\SalonSetting;
use App\Models\Service;
use App\Models\TimeOff;
use App\Models\User;
use App\Models\WorkingHour;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Computes bookable time slots from staff shift windows minus breaks,
 * approved time off, and salon/staff blockouts, minus existing bookings.
 *
 * All slot computation happens in the salon's local timezone; datetimes are
 * converted to UTC at the boundary (storage, API output).
 */
class AvailabilityService
{
    /**
     * The salon's scheduling policy (singleton, resolved lazily so
     * admin updates take effect without rebuilding the service).
     */
    protected function settings(): SalonSetting
    {
        return SalonSetting::current();
    }

    /**
     * Availability windows for a staff member on a salon-local date, as
     * [start, end] Carbon pairs in the salon timezone.
     *
     * Windows come from the staff's working hours; approved time off and
     * blockouts (staff-specific + whole-salon) are subtracted.
     *
     * @return list<array{Carbon, Carbon}>
     */
    public function windowsFor(User $staff, Carbon $date): array
    {
        $tz = $this->settings()->timezone;
        $day = $date->copy()->setTimezone($tz)->startOfDay();

        $windows = WorkingHour::where('user_id', $staff->id)
            ->where('day_of_week', $day->dayOfWeek)
            ->orderBy('start_time')
            ->get()
            ->map(fn (WorkingHour $h) => [
                $day->copy()->setTimeFromTimeString($h->start_time),
                $day->copy()->setTimeFromTimeString($h->end_time),
            ])
            ->all();

        if (empty($windows)) {
            return [];
        }

        $dayStartUtc = $day->copy()->setTimezone('UTC');
        $dayEndUtc = $day->copy()->addDay()->setTimezone('UTC');

        // Subtract approved time off overlapping this day.
        $timeOff = TimeOff::where('user_id', $staff->id)
            ->where('status', TimeOff::STATUS_APPROVED)
            ->where('starts_at', '<', $dayEndUtc)
            ->where('ends_at', '>', $dayStartUtc)
            ->get();

        foreach ($timeOff as $off) {
            $windows = $this->subtractInterval(
                $windows,
                $off->starts_at->copy()->setTimezone($tz),
                $off->ends_at->copy()->setTimezone($tz)
            );
        }

        // Subtract blockouts: staff-specific + whole-salon.
        $blockouts = Blockout::where(function ($query) use ($staff) {
            $query->where('staff_id', $staff->id)->orWhereNull('staff_id');
        })
            ->where('blocks_online_booking', true)
            ->where('starts_at', '<', $dayEndUtc)
            ->where('ends_at', '>', $dayStartUtc)
            ->get();

        foreach ($blockouts as $blockout) {
            $windows = $this->subtractInterval(
                $windows,
                $blockout->starts_at->copy()->setTimezone($tz),
                $blockout->ends_at->copy()->setTimezone($tz)
            );
        }

        return array_values(array_filter(
            $windows,
            fn ($w) => $w[1]->gt($w[0])
        ));
    }

    /**
     * Subtract one interval from a list of windows.
     *
     * @param list<array{Carbon, Carbon}> $windows
     * @return list<array{Carbon, Carbon}>
     */
    protected function subtractInterval(array $windows, Carbon $cutStart, Carbon $cutEnd): array
    {
        $result = [];

        foreach ($windows as [$start, $end]) {
            // No overlap.
            if ($cutEnd->lte($start) || $cutStart->gte($end)) {
                $result[] = [$start, $end];
                continue;
            }

            // Keep the part before the cut.
            if ($cutStart->gt($start)) {
                $result[] = [$start, $cutStart->copy()];
            }

            // Keep the part after the cut.
            if ($cutEnd->lt($end)) {
                $result[] = [$cutEnd->copy(), $end];
            }
        }

        return $result;
    }

    /**
     * Bookable start-time slots for a service, staff member and salon-local
     * date. Returned as "H:i" strings in salon-local time.
     *
     * A candidate start t is valid iff:
     *  - t is not in the past and t - now >= lead time;
     *  - the date is within the booking window;
     *  - [t, t + duration + buffer] fits inside a single availability window;
     *  - [t, t + duration + buffer] overlaps no active booking for the staff.
     *
     * @return list<string>
     */
    public function slotsFor(Service $service, User $staff, Carbon $date, ?int $excludeBookingId = null): array
    {
        $tz = $this->settings()->timezone;
        $day = $date->copy()->setTimezone($tz)->startOfDay();
        $now = $this->settings()->now();

        // Outside the booking window (or in the past): no slots.
        $windowEnd = $now->copy()->startOfDay()->addDays($this->settings()->booking_window_days);
        if ($day->lt($now->copy()->startOfDay()) || $day->gt($windowEnd)) {
            return [];
        }

        $windows = $this->windowsFor($staff, $day);

        if (empty($windows)) {
            return [];
        }

        $step = $this->settings()->slot_step_minutes;
        $leadTime = $this->settings()->lead_time_minutes;
        $occupiedMinutes = $service->duration_minutes + $service->buffer_minutes;

        // Existing bookings occupying this staff's time on this day.
        $dayStartUtc = $day->copy()->setTimezone('UTC');
        $dayEndUtc = $day->copy()->addDay()->setTimezone('UTC');

        $taken = Booking::active()
            ->where('staff_id', $staff->id)
            ->where('starts_at', '<', $dayEndUtc)
            ->where('ends_at', '>', $dayStartUtc)
            ->when($excludeBookingId, fn ($q) => $q->where('id', '!=', $excludeBookingId))
            ->get(['starts_at', 'ends_at'])
            ->map(fn ($b) => [
                $b->starts_at->copy()->setTimezone($tz),
                $b->ends_at->copy()->setTimezone($tz),
            ]);

        $slots = [];
        $earliestAllowed = $now->copy()->addMinutes($leadTime);

        foreach ($windows as [$winStart, $winEnd]) {
            // Align the cursor to the slot step grid from the window start.
            $cursor = $winStart->copy();
            $remainder = $cursor->minute % $step;
            if ($remainder !== 0) {
                $cursor->addMinutes($step - $remainder)->second(0);
            }

            while ($cursor->copy()->addMinutes($occupiedMinutes)->lte($winEnd)) {
                $slotEnd = $cursor->copy()->addMinutes($occupiedMinutes);

                $valid = $cursor->gte($earliestAllowed)
                    && ! $this->overlapsAny($cursor, $slotEnd, $taken);

                if ($valid) {
                    $slots[] = $cursor->format('H:i');
                }

                $cursor->addMinutes($step);
            }
        }

        return array_values(array_unique($slots));
    }

    /**
     * Check whether [start, end) overlaps any interval in the list.
     *
     * @param \Illuminate\Support\Collection<int, array{Carbon, Carbon}>|array $intervals
     */
    protected function overlapsAny(Carbon $start, Carbon $end, $intervals): bool
    {
        foreach ($intervals as [$iStart, $iEnd]) {
            if ($start->lt($iEnd) && $end->gt($iStart)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Staff eligible to perform a service and bookable online.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, User>
     */
    public function eligibleStaff(Service $service)
    {
        return User::where('role', 'staff')
            ->where('bookable_online', true)
            ->whereHas('services', fn ($q) => $q->where('services.id', $service->id))
            ->orderBy('name')
            ->get();
    }

    /**
     * Per-staff availability for a service on a date.
     *
     * @return Collection<int, array{staff: User, slots: list<string>}>
     */
    public function availabilityForDate(Service $service, Carbon $date, ?int $excludeBookingId = null): Collection
    {
        return $this->eligibleStaff($service)
            ->map(fn (User $staff) => [
                'staff' => $staff,
                'slots' => $this->slotsFor($service, $staff, $date, $excludeBookingId),
            ])
            ->filter(fn ($row) => ! empty($row['slots']))
            ->values();
    }

    /**
     * Merged "any available" slots: for each start time, the earliest free
     * staff member. Each slot is tagged with the staff who would take it.
     *
     * @return list<array{time: string, starts_at: string, staff_id: int, staff_name: string}>
     */
    public function mergedSlots(Service $service, Carbon $date, ?int $excludeBookingId = null): array
    {
        $tz = $this->settings()->timezone;
        $day = $date->copy()->setTimezone($tz)->startOfDay();
        $merged = [];

        foreach ($this->eligibleStaff($service) as $staff) {
            foreach ($this->slotsFor($service, $staff, $date, $excludeBookingId) as $time) {
                // First staff (ordered by name) wins each time slot.
                $merged[$time] ??= [
                    'time' => $time,
                    'starts_at' => $day->copy()->setTimeFromTimeString($time)->setTimezone('UTC')->toIso8601String(),
                    'staff_id' => $staff->id,
                    'staff_name' => $staff->name,
                ];
            }
        }

        ksort($merged);

        return array_values($merged);
    }

    /**
     * Day-level availability for a date range (used to grey out fully-booked
     * days in the slot picker).
     *
     * @return array<string, array{available: bool, slots_count: int}>
     */
    public function calendarFor(Service $service, Carbon $from, Carbon $to, ?int $staffId = null): array
    {
        $days = [];
        $cursor = $from->copy()->startOfDay();

        while ($cursor->lte($to->copy()->startOfDay())) {
            $count = 0;

            if ($staffId) {
                $staff = User::where('role', 'staff')->find($staffId);
                if ($staff) {
                    $count = count($this->slotsFor($service, $staff, $cursor));
                }
            } else {
                $count = count($this->mergedSlots($service, $cursor));
            }

            $days[$cursor->toDateString()] = [
                'available' => $count > 0,
                'slots_count' => $count,
            ];

            $cursor->addDay();
        }

        return $days;
    }

    /**
     * Whether a specific slot is still free. Call inside a DB transaction
     * with a row lock to guard against two customers racing for the same
     * slot — the loser's transaction sees the winner's booking.
     */
    public function slotIsFree(Service $service, User $staff, Carbon $startsAtUtc, ?int $excludeBookingId = null): bool
    {
        $tz = $this->settings()->timezone;
        $local = $startsAtUtc->copy()->setTimezone($tz);
        $time = $local->format('H:i');

        return in_array(
            $time,
            $this->slotsFor($service, $staff, $local->copy()->startOfDay(), $excludeBookingId),
            true
        );
    }

    /**
     * Find the earliest eligible staff member free at the given UTC start
     * time ("any available" assignment at booking time).
     */
    public function findStaffForSlot(Service $service, Carbon $startsAtUtc): ?User
    {
        $tz = $this->settings()->timezone;
        $local = $startsAtUtc->copy()->setTimezone($tz);

        foreach ($this->eligibleStaff($service) as $staff) {
            if ($this->slotIsFree($service, $staff, $startsAtUtc)) {
                return $staff;
            }
        }

        return null;
    }

    /**
     * Re-check overlap inside a transaction, locking the staff's bookings
     * rows so concurrent requests serialize. Returns true when the interval
     * is free for the given staff.
     */
    public function intervalIsFree(User $staff, Carbon $startsAtUtc, Carbon $endsAtUtc, ?int $excludeBookingId = null): bool
    {
        $conflict = Booking::active()
            ->where('staff_id', $staff->id)
            ->where('starts_at', '<', $endsAtUtc)
            ->where('ends_at', '>', $startsAtUtc)
            ->when($excludeBookingId, fn ($q) => $q->where('id', '!=', $excludeBookingId))
            ->lockForUpdate()
            ->exists();

        return ! $conflict;
    }

    /**
     * Next available slot across eligible staff (for staff cards showing
     * "next available").
     */
    public function nextAvailable(Service $service, User $staff): ?Carbon
    {
        $tz = $this->settings()->timezone;
        $day = $this->settings()->now()->startOfDay();
        $windowEnd = $day->copy()->addDays($this->settings()->booking_window_days);

        while ($day->lte($windowEnd)) {
            $slots = $this->slotsFor($service, $staff, $day);

            if (! empty($slots)) {
                return $day->copy()->setTimeFromTimeString($slots[0])->setTimezone('UTC');
            }

            $day->addDay();
        }

        return null;
    }
}
