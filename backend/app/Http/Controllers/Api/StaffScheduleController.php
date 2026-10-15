<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTimeOffRequest;
use App\Http\Requests\WalkInBookingRequest;
use App\Http\Resources\BookingResource;
use App\Http\Resources\TimeOffResource;
use App\Http\Resources\WorkingHourResource;
use App\Models\Booking;
use App\Models\BookingStatusHistory;
use App\Models\SalonSetting;
use App\Models\Service;
use App\Models\TimeOff;
use App\Models\User;
use App\Services\AvailabilityService;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StaffScheduleController extends Controller
{
    public function __construct(
        protected AvailabilityService $availability,
        protected NotificationService $notifications,
    ) {}

    /**
     * Staff schedule: day agenda (default) or week grid.
     * Staff see their own bookings; admins may pass staff_id for anyone's.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
            'view' => ['nullable', 'string', 'in:day,week'],
            'staff_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $user = $request->user();
        $settings = SalonSetting::current();
        $tz = $settings->timezone;

        $staffId = $validated['staff_id'] ?? null;

        if ($staffId && ! $user->isAdmin()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $staffId ??= $user->id;
        $view = $validated['view'] ?? 'day';
        $date = isset($validated['date'])
            ? Carbon::createFromFormat('Y-m-d', $validated['date'], $tz)->startOfDay()
            : $settings->now()->startOfDay();

        if ($view === 'week') {
            $weekStart = $date->copy()->startOfWeek(Carbon::MONDAY);
            $days = [];

            for ($i = 0; $i < 7; $i++) {
                $day = $weekStart->copy()->addDays($i);
                $days[] = [
                    'date' => $day->toDateString(),
                    'day_name' => $day->format('l'),
                    'bookings' => BookingResource::collection($this->bookingsForDay($staffId, $day, $tz)),
                ];
            }

            return response()->json([
                'view' => 'week',
                'week_start' => $weekStart->toDateString(),
                'days' => $days,
            ]);
        }

        return response()->json([
            'view' => 'day',
            'date' => $date->toDateString(),
            'day_name' => $date->format('l'),
            'bookings' => BookingResource::collection($this->bookingsForDay($staffId, $date, $tz)),
        ]);
    }

    /**
     * The staff member's own working hours, time off, and blockouts.
     */
    public function shifts(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'working_hours' => WorkingHourResource::collection(
                $user->workingHours()->orderBy('day_of_week')->orderBy('start_time')->get()
            ),
            'time_off' => TimeOffResource::collection(
                $user->timeOffs()->orderBy('starts_at', 'desc')->limit(20)->get()
            ),
            'blockouts' => $user->blockouts()
                ->where('ends_at', '>=', now())
                ->orderBy('starts_at')
                ->limit(20)
                ->get(['id', 'starts_at', 'ends_at', 'reason']),
        ]);
    }

    /**
     * Request time off (staff for themselves; admin for any staff member).
     */
    public function requestTimeOff(StoreTimeOffRequest $request): JsonResponse
    {
        $user = $request->user();
        $userId = $request->validated('user_id') ?? $user->id;

        if ($userId !== $user->id && ! $user->isAdmin()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $timeOff = TimeOff::create([
            'user_id' => $userId,
            'type' => $request->validated('type'),
            'starts_at' => $request->validated('starts_at'),
            'ends_at' => $request->validated('ends_at'),
            'status' => TimeOff::STATUS_PENDING,
            'note' => $request->validated('note'),
        ]);

        $timeOff->load('user');

        return response()->json(['time_off' => new TimeOffResource($timeOff)], 201);
    }

    /**
     * Create a walk-in / phone booking on a free slot. Goes into the same
     * calendar with the same overlap protection as online bookings.
     */
    public function walkIn(WalkInBookingRequest $request): JsonResponse
    {
        $service = Service::findOrFail($request->validated('service_id'));
        $staff = User::where('role', 'staff')->findOrFail($request->validated('staff_id'));
        $settings = SalonSetting::current();

        $startsAtUtc = $settings->localToUtc(
            $request->validated('date').' '.$request->validated('start_time')
        );
        $occupiedMinutes = $service->duration_minutes + $service->buffer_minutes;
        $endsAtUtc = $startsAtUtc->copy()->addMinutes($occupiedMinutes);

        $booking = DB::transaction(function () use ($request, $service, $staff, $startsAtUtc, $endsAtUtc) {
            if (! $this->availability->intervalIsFree($staff, $startsAtUtc, $endsAtUtc)) {
                abort(422, 'This time slot is no longer available.');
            }

            $customerId = $request->validated('customer_id')
                ?? $this->findCustomer($request->validated('customer_email'), $request->validated('customer_phone'));

            $booking = Booking::create([
                'reference_code' => $this->uniqueReferenceCode(),
                'customer_id' => $customerId,
                'staff_id' => $staff->id,
                'service_id' => $service->id,
                'starts_at' => $startsAtUtc,
                'ends_at' => $endsAtUtc,
                'status' => Booking::STATUS_BOOKED,
                'source' => $request->validated('source', Booking::SOURCE_WALK_IN),
                'service_name' => $service->name,
                'duration_minutes' => $service->duration_minutes,
                'price_cents' => $service->price_cents,
                'guest_name' => $customerId ? $request->validated('guest_name') : $request->validated('customer_name'),
                'guest_phone' => $customerId ? null : $request->validated('customer_phone'),
                'guest_email' => $customerId ? null : $request->validated('customer_email'),
                'notes' => $request->validated('notes'),
            ]);

            BookingStatusHistory::create([
                'booking_id' => $booking->id,
                'from_status' => null,
                'to_status' => Booking::STATUS_BOOKED,
                'changed_by' => $request->user()->id,
                'changed_by_type' => BookingStatusHistory::BY_USER,
                'note' => 'Created by staff ('.$booking->source.').',
            ]);

            return $booking;
        });

        $booking->load(['customer', 'staff', 'service', 'statusHistory']);
        $this->notifications->recordConfirmation($booking);

        return response()->json(['booking' => new BookingResource($booking)], 201);
    }

    /**
     * Bookings for one staff member on one salon-local day.
     */
    protected function bookingsForDay(int $staffId, Carbon $day, string $tz)
    {
        $dayStartUtc = $day->copy()->setTimezone('UTC');
        $dayEndUtc = $day->copy()->addDay()->setTimezone('UTC');

        return Booking::where('staff_id', $staffId)
            ->where('starts_at', '>=', $dayStartUtc)
            ->where('starts_at', '<', $dayEndUtc)
            ->whereNotIn('status', [Booking::STATUS_CANCELLED])
            ->with(['customer', 'staff', 'service', 'statusHistory'])
            ->orderBy('starts_at')
            ->get();
    }

    /**
     * Find an existing customer by email or phone for walk-in linking.
     */
    protected function findCustomer(?string $email, ?string $phone): ?int
    {
        $query = User::where('role', 'customer');

        if ($email) {
            $id = (clone $query)->where('email', $email)->value('id');
            if ($id) {
                return $id;
            }
        }

        if ($phone) {
            return (clone $query)->where('phone', $phone)->value('id');
        }

        return null;
    }

    /**
     * Generate a unique customer-facing reference code (BK-XXXXXX).
     */
    protected function uniqueReferenceCode(): string
    {
        do {
            $code = 'BK-'.strtoupper(Str::random(6));
        } while (Booking::where('reference_code', $code)->exists());

        return $code;
    }
}
