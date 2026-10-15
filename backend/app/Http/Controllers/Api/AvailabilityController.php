<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ServiceResource;
use App\Models\SalonSetting;
use App\Models\Service;
use App\Models\User;
use App\Services\AvailabilityService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AvailabilityController extends Controller
{
    public function __construct(protected AvailabilityService $availability) {}

    /**
     * Available time slots for a service on a date, in salon-local time.
     *
     * Query: service_id (required), date=Y-m-d (required), staff_id (optional).
     * Without staff_id ("any available"), slots are merged across eligible
     * staff and each slot is tagged with the staff member who would take it.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'service_id' => ['required', 'integer', 'exists:services,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'staff_id' => ['nullable', 'integer', 'exists:users,id'],
            'exclude_booking_id' => ['nullable', 'integer', 'exists:bookings,id'],
        ]);

        $service = Service::findOrFail($validated['service_id']);

        if (! $service->is_active) {
            return response()->json(['message' => 'This service is not currently bookable.'], 422);
        }

        $settings = SalonSetting::current();
        $date = Carbon::createFromFormat('Y-m-d', $validated['date'], $settings->timezone)->startOfDay();
        $exclude = $validated['exclude_booking_id'] ?? null;

        $slots = [];

        if (! empty($validated['staff_id'])) {
            $staff = User::where('role', 'staff')->findOrFail($validated['staff_id']);

            foreach ($this->availability->slotsFor($service, $staff, $date, $exclude) as $time) {
                $slots[] = [
                    'time' => $time,
                    'starts_at' => $date->copy()->setTimeFromTimeString($time)->setTimezone('UTC')->toIso8601String(),
                    'staff_id' => $staff->id,
                    'staff_name' => $staff->name,
                ];
            }
        } else {
            $slots = $this->availability->mergedSlots($service, $date, $exclude);
        }

        return response()->json([
            'date' => $date->toDateString(),
            'timezone' => $settings->timezone,
            'timezone_label' => 'All times shown in '.$settings->timezone,
            'service' => new ServiceResource($service),
            'slots' => $slots,
            'fully_booked' => empty($slots),
        ]);
    }

    /**
     * Day-level availability for a date range — used to grey out
     * fully-booked days in the slot picker.
     *
     * Query: service_id (required), staff_id (optional), from=Y-m-d,
     * to=Y-m-d (defaults: today → today + booking window).
     */
    public function calendar(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'service_id' => ['required', 'integer', 'exists:services,id'],
            'staff_id' => ['nullable', 'integer', 'exists:users,id'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $service = Service::findOrFail($validated['service_id']);
        $settings = SalonSetting::current();
        $tz = $settings->timezone;

        $from = isset($validated['from'])
            ? Carbon::createFromFormat('Y-m-d', $validated['from'], $tz)->startOfDay()
            : $settings->now()->startOfDay();
        $to = isset($validated['to'])
            ? Carbon::createFromFormat('Y-m-d', $validated['to'], $tz)->startOfDay()
            : $from->copy()->addDays($settings->booking_window_days);

        // Cap the range to keep the computation bounded.
        if ($from->diffInDays($to) > 62) {
            $to = $from->copy()->addDays(62);
        }

        $days = $this->availability->calendarFor(
            $service,
            $from,
            $to,
            $validated['staff_id'] ?? null
        );

        return response()->json([
            'timezone' => $tz,
            'days' => $days,
        ]);
    }
}
