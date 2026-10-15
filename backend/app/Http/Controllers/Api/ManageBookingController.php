<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ManageBookingRequest;
use App\Http\Requests\RescheduleBookingRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\BookingStatusHistory;
use App\Models\SalonSetting;
use App\Models\User;
use App\Services\AvailabilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Guest "manage my booking" flow: no account required, access via the
 * booking reference code plus the email the booking was made with.
 */
class ManageBookingController extends Controller
{
    public function __construct(
        protected AvailabilityService $availability,
        protected BookingController $bookings,
    ) {}

    /**
     * The salon's scheduling policy (singleton).
     */
    protected function settings(): SalonSetting
    {
        return SalonSetting::current();
    }

    /**
     * Look up a booking by reference code + email.
     */
    public function lookup(ManageBookingRequest $request): JsonResponse
    {
        $booking = $this->findBooking($request);

        if (! $booking) {
            return response()->json(['message' => 'No booking found with that reference code and email.'], 404);
        }

        $booking->load(['customer', 'staff', 'service', 'statusHistory']);

        return response()->json(['booking' => new BookingResource($booking)]);
    }

    /**
     * Cancel a booking via reference code + email (same cutoff guards as
     * signed-in customer self-service).
     */
    public function cancel(ManageBookingRequest $request, string $reference): JsonResponse
    {
        $booking = $this->findBooking($request, $reference);

        if (! $booking) {
            return response()->json(['message' => 'No booking found with that reference code and email.'], 404);
        }

        return $this->bookings->cancelBooking($booking, null, BookingStatusHistory::BY_CUSTOMER);
    }

    /**
     * Reschedule a booking via reference code + email.
     */
    public function reschedule(RescheduleBookingRequest $request, string $reference): JsonResponse
    {
        $email = $request->input('email');

        if (! $email) {
            return response()->json(['message' => 'The email field is required.'], 422);
        }

        $booking = Booking::where('reference_code', strtoupper($reference))->first();

        if (! $booking || ! $this->emailMatches($booking, $email)) {
            return response()->json(['message' => 'No booking found with that reference code and email.'], 404);
        }

        // Merge the email into the reschedule request payload so the shared
        // validation path works unchanged.
        $request->merge(['email' => $email]);

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
        app(\App\Services\NotificationService::class)->recordRescheduled($updated);

        return response()->json(['booking' => new BookingResource($updated)]);
    }

    /**
     * Find a booking by reference code + email from the request.
     */
    protected function findBooking(ManageBookingRequest $request, ?string $reference = null): ?Booking
    {
        $reference = $reference ?? $request->validated('reference_code');
        $email = $request->validated('email');

        $booking = Booking::where('reference_code', strtoupper($reference))->first();

        if (! $booking || ! $this->emailMatches($booking, $email)) {
            return null;
        }

        return $booking;
    }

    /**
     * The email must match the booking's account email or guest email.
     */
    protected function emailMatches(Booking $booking, string $email): bool
    {
        $contact = $booking->contactEmail();

        return $contact && strcasecmp($contact, $email) === 0;
    }

    /**
     * Same self-service guard as signed-in customers: before start and
     * before the free-cancellation cutoff.
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
}
