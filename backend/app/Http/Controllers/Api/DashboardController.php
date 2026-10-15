<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\SalonSetting;
use App\Models\User;
use App\Models\WorkingHour;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    /**
     * Admin dashboard metrics, computed from the database.
     */
    public function stats(): JsonResponse
    {
        $settings = SalonSetting::current();
        $tz = $settings->timezone;
        $now = $settings->now();

        $todayStartUtc = $now->copy()->startOfDay()->setTimezone('UTC');
        $todayEndUtc = $now->copy()->addDay()->startOfDay()->setTimezone('UTC');
        $weekStartUtc = $now->copy()->subDays(7)->setTimezone('UTC');
        $monthStartUtc = $now->copy()->subDays(30)->setTimezone('UTC');

        $todayBookings = Booking::where('starts_at', '>=', $todayStartUtc)
            ->where('starts_at', '<', $todayEndUtc)
            ->whereNotIn('status', [Booking::STATUS_CANCELLED])
            ->with(['customer', 'staff', 'service'])
            ->orderBy('starts_at')
            ->get();

        $upcoming7d = Booking::active()
            ->where('starts_at', '>=', $todayEndUtc)
            ->where('starts_at', '<', $todayEndUtc->copy()->addDays(7));

        $revenue = fn (Carbon $from) => (int) Booking::where('status', Booking::STATUS_COMPLETED)
            ->where('starts_at', '>=', $from)
            ->sum('price_cents');

        // New vs returning: a customer is "new" when their first
        // non-cancelled booking starts inside the window.
        $newCustomerIds = Booking::whereNotIn('status', [Booking::STATUS_CANCELLED])
            ->whereNotNull('customer_id')
            ->selectRaw('customer_id, MIN(starts_at) as first_start')
            ->groupBy('customer_id')
            ->having('first_start', '>=', $monthStartUtc)
            ->pluck('customer_id');

        $returningCount = Booking::whereNotIn('status', [Booking::STATUS_CANCELLED])
            ->whereNotNull('customer_id')
            ->where('starts_at', '>=', $monthStartUtc)
            ->distinct('customer_id')
            ->count('customer_id') - $newCustomerIds->count();

        $periodTotal = Booking::whereIn('status', [Booking::STATUS_COMPLETED, Booking::STATUS_NO_SHOW])
            ->where('starts_at', '>=', $monthStartUtc)
            ->count();
        $periodNoShows = Booking::where('status', Booking::STATUS_NO_SHOW)
            ->where('starts_at', '>=', $monthStartUtc)
            ->count();

        return response()->json([
            'today' => [
                'count' => $todayBookings->count(),
                'bookings' => BookingResource::collection($todayBookings),
            ],
            'upcoming_7d' => [
                'count' => (clone $upcoming7d)->count(),
                'expected_revenue_cents' => (int) (clone $upcoming7d)->sum('price_cents'),
            ],
            'revenue' => [
                'today_cents' => $revenue($todayStartUtc),
                'week_cents' => $revenue($weekStartUtc),
                'month_cents' => $revenue($monthStartUtc),
            ],
            'customers' => [
                'new_count' => $newCustomerIds->count(),
                'returning_count' => max(0, $returningCount),
                'total' => User::where('role', 'customer')->count(),
            ],
            'no_show_rate' => $periodTotal > 0 ? round($periodNoShows / $periodTotal, 4) : 0,
            'no_shows_30d' => $periodNoShows,
            'staff_occupancy' => $this->staffOccupancy($todayStartUtc, $todayEndUtc),
            'timezone' => $tz,
        ]);
    }

    /**
     * Per-staff occupancy for a UTC day window: booked minutes vs minutes
     * the staff was scheduled to work.
     *
     * @return list<array{staff_id: int, name: string, booked_minutes: int, available_minutes: int, occupancy_pct: float}>
     */
    protected function staffOccupancy(Carbon $dayStartUtc, Carbon $dayEndUtc): array
    {
        $settings = SalonSetting::current();
        $dayLocal = $dayStartUtc->copy()->setTimezone($settings->timezone);

        return User::where('role', 'staff')
            ->orderBy('name')
            ->get()
            ->map(function (User $staff) use ($dayStartUtc, $dayEndUtc, $dayLocal) {
                $availableMinutes = WorkingHour::where('user_id', $staff->id)
                    ->where('day_of_week', $dayLocal->dayOfWeek)
                    ->get()
                    ->sum(fn ($h) => $this->minutesBetween($h->start_time, $h->end_time));

                $bookedMinutes = Booking::where('staff_id', $staff->id)
                    ->whereIn('status', Booking::ACTIVE_STATUSES)
                    ->where('starts_at', '>=', $dayStartUtc)
                    ->where('starts_at', '<', $dayEndUtc)
                    ->sum('duration_minutes');

                return [
                    'staff_id' => $staff->id,
                    'name' => $staff->name,
                    'booked_minutes' => (int) $bookedMinutes,
                    'available_minutes' => (int) $availableMinutes,
                    'occupancy_pct' => $availableMinutes > 0
                        ? round($bookedMinutes / $availableMinutes, 4)
                        : 0,
                ];
            })
            ->all();
    }

    /**
     * Minutes between two "H:i:s" time strings.
     */
    protected function minutesBetween(string $start, string $end): int
    {
        $s = Carbon::createFromFormat('H:i:s', $start);
        $e = Carbon::createFromFormat('H:i:s', $end);

        return max(0, (int) $s->diffInMinutes($e));
    }
}
