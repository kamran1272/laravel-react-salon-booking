<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RescheduleBookingRequest;
use App\Http\Requests\StoreBookingRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\BookingStatusHistory;
use App\Models\SalonSetting;
use App\Models\Service;
use App\Models\User;
use App\Services\AvailabilityService;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BookingController extends Controller
{
    public function __construct(
        protected AvailabilityService $availability,
        protected NotificationService $notifications,
    ) {}

    /**
     * The salon's scheduling policy (singleton).
     */
    protected function settings(): SalonSetting
    {
        return SalonSetting::current();
    }

    /**
     * List the authenticated customer's own bookings, split upcoming/past.
     */
    public function index(): JsonResponse
    {
        $user = request()->user();

        $base = Booking::query()
            ->where('customer_id', $user->id)
            ->with(['customer', 'staff', 'service', 'statusHistory']);

        $upcoming = (clone $base)
            ->where('starts_at', '>=', now())
            ->whereNotIn('status', Booking::TERMINAL_STATUSES)
            ->orderBy('starts_at')
            ->get();

        $past = (clone $base)
            ->where(fn ($q) => $q->where('starts_at', '<', now())
                ->orWhereIn('status', Booking::TERMINAL_STATUSES))
            ->orderBy('starts_at', 'desc')
            ->get();

        return response()->json([
            'upcoming' => BookingResource::collection($upcoming),
            'past' => BookingResource::collection($past),
        ]);
    }

    /**
     * Create a booking. Guests may book without an account; signed-in
     * customers book against their account. Online bookings with an
     * accepted cancellation policy are confirmed immediately.
     */
    public function store(StoreBookingRequest $request): JsonResponse
    {
        $service = Service::findOrFail($request->validated('service_id'));

        if (! $service->is_active || ! $service->bookable_online) {
            return response()->json(['message' => 'This service is not currently bookable online.'], 422);
        }

        $startsAtUtc = $this->settings()->localToUtc(
            $request->validated('date').' '.$request->validated('start_time')
        );

        $booking = DB::transaction(function () use ($request, $service, $startsAtUtc) {
            $staff = $this->resolveStaff($request, $service, $startsAtUtc);

            if (! $staff) {
                abort(422, 'This time slot is no longer available.');
            }

            $occupiedMinutes = $service->duration_minutes + $service->buffer_minutes;
            $endsAtUtc = $startsAtUtc->copy()->addMinutes($occupiedMinutes);

            // Transactional overlap re-check: two customers racing for the
            // same slot must not both succeed.
            if (! $this->availability->intervalIsFree($staff, $startsAtUtc, $endsAtUtc)) {
                abort(422, 'This time slot was just taken. Please choose another time.');
            }

            $booking = Booking::create([
                'reference_code' => $this->uniqueReferenceCode(),
                'customer_id' => $this->resolveCustomerId($request),
                'staff_id' => $staff->id,
                'service_id' => $service->id,
                'starts_at' => $startsAtUtc,
                'ends_at' => $endsAtUtc,
                'status' => Booking::STATUS_CONFIRMED,
                'source' => Booking::SOURCE_ONLINE,
                'service_name' => $service->name,
                'duration_minutes' => $service->duration_minutes,
                'price_cents' => $service->price_cents,
                'guest_name' => $request->validated('guest_name'),
                'guest_phone' => $request->validated('customer.phone'),
                'guest_email' => $request->validated('customer.email'),
                'notes' => $request->validated('notes') ?? $request->validated('customer.notes'),
            ]);

            BookingStatusHistory::create([
                'booking_id' => $booking->id,
                'from_status' => null,
                'to_status' => Booking::STATUS_CONFIRMED,
                'changed_by' => $request->user()?->id,
                'changed_by_type' => $request->user()
                    ? BookingStatusHistory::BY_CUSTOMER
                    : BookingStatusHistory::BY_SYSTEM,
                'note' => 'Booked online with cancellation policy accepted.',
            ]);

            return $booking;
        });

        $booking->load(['customer', 'staff', 'service', 'statusHistory']);
        $this->notifications->recordConfirmation($booking);

        return response()->json(['booking' => new BookingResource($booking)], 201);
    }

    /**
     * Show a single booking (owner, assigned staff, or admin).
     */
    public function show(Booking $booking): JsonResponse
    {
        $this->authorizeView($booking);

        $booking->load(['customer', 'staff', 'service', 'statusHistory']);

        return response()->json(['booking' => new BookingResource($booking)]);
    }

    /**
     * Cancel the authenticated customer's own booking. Allowed only before
     * the appointment starts and before the free-cancellation cutoff.
     */
    public function cancel(Booking $booking): JsonResponse
    {
        $user = request()->user();

        if ($booking->customer_id !== $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return $this->cancelBooking($booking, $user, BookingStatusHistory::BY_CUSTOMER);
    }

    /**
     * Reschedule the authenticated customer's own booking. Same guards as
     * cancel, plus the new slot must be free (excluding this booking).
     */
    public function reschedule(RescheduleBookingRequest $request, Booking $booking): JsonResponse
    {
        $user = request()->user();

        if ($booking->customer_id !== $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $guard = $this->selfServiceGuard($booking);

        if ($guard) {
            return $guard;
        }

        $service = $booking->service;
        $startsAtUtc = $this->settings()->localToUtc(
            $request->validated('date').' '.$request->validated('start_time')
        );

        $staff = $booking->staff;

        if ($request->validated('staff_id')) {
            $staff = User::where('role', 'staff')->findOrFail($request->validated('staff_id'));

            if (! $this->availability->eligibleStaff($service)->contains('id', $staff->id)) {
                return response()->json(['message' => 'This staff member does not perform the booked service.'], 422);
            }
        }

        $occupiedMinutes = $service->duration_minutes + $service->buffer_minutes;
        $endsAtUtc = $startsAtUtc->copy()->addMinutes($occupiedMinutes);

        $updated = DB::transaction(function () use ($booking, $staff, $startsAtUtc, $endsAtUtc) {
            if (! $this->availability->intervalIsFree($staff, $startsAtUtc, $endsAtUtc, $booking->id)) {
                abort(422, 'This time slot is no longer available.');
            }

            $booking->update([
                'staff_id' => $staff->id,
                'starts_at' => $startsAtUtc,
                'ends_at' => $endsAtUtc,
            ]);

            return $booking;
        });

        $updated->load(['customer', 'staff', 'service', 'statusHistory']);
        $this->notifications->recordRescheduled($updated);

        return response()->json(['booking' => new BookingResource($updated)]);
    }

    /**
     * Shared cancel implementation (also used by the guest manage flow).
     */
    public function cancelBooking(Booking $booking, ?User $actor, string $byType, ?string $reason = null): JsonResponse
    {
        $guard = $byType === BookingStatusHistory::BY_CUSTOMER
            ? $this->selfServiceGuard($booking)
            : $this->staffGuard($booking);

        if ($guard) {
            return $guard;
        }

        if (! $booking->canTransitionTo(Booking::STATUS_CANCELLED)) {
            return response()->json(['message' => 'This booking can no longer be cancelled.'], 422);
        }

        $late = $booking->starts_at->lt(now()->addHours($this->settings()->free_cancellation_hours));

        DB::transaction(function () use ($booking, $actor, $byType, $reason, $late) {
            $booking->update([
                'status' => Booking::STATUS_CANCELLED,
                'cancelled_at' => now(),
                'cancel_reason' => $reason,
                'late_cancel' => $late,
            ]);

            BookingStatusHistory::create([
                'booking_id' => $booking->id,
                'from_status' => $booking->getOriginal('status'),
                'to_status' => Booking::STATUS_CANCELLED,
                'changed_by' => $actor?->id,
                'changed_by_type' => $byType,
                'note' => $reason,
            ]);

            if ($booking->customer_id) {
                $booking->customer()->increment('cancellation_count');
            }
        });

        $booking->load(['customer', 'staff', 'service', 'statusHistory']);
        $this->notifications->recordCancelled($booking);

        return response()->json(['booking' => new BookingResource($booking)]);
    }

    /**
     * Guard for customer self-service: before start AND before the
     * free-cancellation cutoff. Inside the cutoff the customer is told to
     * contact the salon instead of cancelling online.
     */
    protected function selfServiceGuard(Booking $booking): ?JsonResponse
    {
        if ($booking->starts_at->isPast()) {
            return response()->json([
                'message' => 'This appointment has already started and can no longer be changed online.',
            ], 422);
        }

        $cutoff = $this->settings()->free_cancellation_hours;

        if ($booking->starts_at->lt(now()->addHours($cutoff))) {
            return response()->json([
                'message' => "Online changes are only possible more than {$cutoff} hours before the appointment. Please contact the salon.",
            ], 422);
        }

        return null;
    }

    /**
     * Guard for staff/admin changes: only the timing rule (before start).
     */
    protected function staffGuard(Booking $booking): ?JsonResponse
    {
        if ($booking->starts_at->isPast()) {
            return response()->json([
                'message' => 'This appointment has already started and can no longer be cancelled.',
            ], 422);
        }

        return null;
    }

    /**
     * Resolve which staff member takes the booking: explicit choice (must be
     * eligible for the service) or "any available" (earliest free staff).
     */
    protected function resolveStaff(StoreBookingRequest $request, Service $service, Carbon $startsAtUtc): ?User
    {
        if ($request->validated('staff_id')) {
            $staff = User::where('role', 'staff')
                ->where('bookable_online', true)
                ->find($request->validated('staff_id'));

            if (! $staff || ! $this->availability->eligibleStaff($service)->contains('id', $staff->id)) {
                return null;
            }

            return $this->availability->slotIsFree($service, $staff, $startsAtUtc) ? $staff : null;
        }

        return $this->availability->findStaffForSlot($service, $startsAtUtc);
    }

    /**
     * Link the booking to a customer account when possible: the signed-in
     * user, an explicit customer_id (staff flows), or a matching email.
     * Otherwise the booking stays a guest booking with contact snapshots.
     */
    protected function resolveCustomerId(StoreBookingRequest $request): ?int
    {
        if ($request->user()) {
            return $request->user()->id;
        }

        if ($request->validated('customer_id')) {
            return $request->validated('customer_id');
        }

        $email = $request->validated('customer.email');

        return User::where('role', 'customer')->where('email', $email)->value('id');
    }

    /**
     * Ensure the viewer owns the booking, is assigned to it, or is an admin.
     */
    protected function authorizeView(Booking $booking): void
    {
        $user = request()->user();

        $allowed = $user->isAdmin()
            || $booking->customer_id === $user->id
            || $booking->staff_id === $user->id;

        if (! $allowed) {
            abort(403, 'Forbidden');
        }
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
