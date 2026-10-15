<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\BookingStatusHistory;
use App\Models\Sale;
use App\Models\SalonSetting;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BookingStatusController extends Controller
{
    public function __construct(protected NotificationService $notifications) {}

    /**
     * Confirm a booked appointment (assigned staff or admin).
     */
    public function confirm(Booking $booking): JsonResponse
    {
        $this->authorizeStaff($booking);

        return $this->transition($booking, Booking::STATUS_CONFIRMED);
    }

    /**
     * Complete an appointment via checkout (assigned staff or admin).
     * Creates the linked sale record — a completed booking always has one.
     */
    public function complete(Request $request, Booking $booking): JsonResponse
    {
        $this->authorizeStaff($booking);

        $validated = $request->validate([
            'payment_method' => ['sometimes', 'string', 'in:cash,card,other'],
        ]);

        if (! $booking->canTransitionTo(Booking::STATUS_COMPLETED)) {
            return response()->json([
                'message' => "Cannot move booking from {$booking->status} to completed.",
            ], 422);
        }

        DB::transaction(function () use ($request, $booking, $validated) {
            $from = $booking->status;

            $booking->update(['status' => Booking::STATUS_COMPLETED]);

            Sale::create([
                'booking_id' => $booking->id,
                'staff_id' => $booking->staff_id,
                'total_cents' => $booking->price_cents,
                'payment_method' => $validated['payment_method'] ?? 'cash',
            ]);

            $this->writeHistory($booking, $from, Booking::STATUS_COMPLETED, 'Checked out.');

            if ($booking->customer_id) {
                $booking->customer()->increment('total_spend_cents', $booking->price_cents);
            }
        });

        $booking->load(['customer', 'staff', 'service', 'statusHistory']);
        $this->notifications->recordThankYou($booking);

        return response()->json(['booking' => new BookingResource($booking)]);
    }

    /**
     * Mark a booking as no-show (assigned staff or admin). Only after the
     * appointment start time has passed.
     */
    public function noShow(Booking $booking): JsonResponse
    {
        $this->authorizeStaff($booking);

        if ($booking->starts_at->isFuture()) {
            return response()->json([
                'message' => 'A booking can only be marked as no-show after its start time.',
            ], 422);
        }

        $response = $this->transition($booking, Booking::STATUS_NO_SHOW, 'Marked as no-show.');

        if ($response->getStatusCode() === 200 && $booking->customer_id) {
            $booking->customer()->increment('no_show_count');
        }

        if ($response->getStatusCode() === 200) {
            $booking->load(['customer', 'staff', 'service', 'statusHistory']);
            $this->notifications->recordNoShow($booking);
        }

        return $response;
    }

    /**
     * Cancel a booking (assigned staff or admin). Only before the start.
     * Customers cancelling their own booking use the customer endpoints
     * with the cutoff guard instead.
     */
    public function cancel(Request $request, Booking $booking): JsonResponse
    {
        $this->authorizeStaff($booking);

        if ($booking->starts_at->isPast()) {
            return response()->json([
                'message' => 'This appointment has already started and can no longer be cancelled.',
            ], 422);
        }

        $validated = $request->validate([
            'cancel_reason' => ['nullable', 'string', 'max:500'],
        ]);

        $from = $booking->status;
        $late = $booking->starts_at->lt(now()->addHours(SalonSetting::current()->free_cancellation_hours));

        DB::transaction(function () use ($booking, $validated, $from, $late) {
            $booking->update([
                'status' => Booking::STATUS_CANCELLED,
                'cancelled_at' => now(),
                'cancel_reason' => $validated['cancel_reason'] ?? null,
                'late_cancel' => $late,
            ]);

            $this->writeHistory($booking, $from, Booking::STATUS_CANCELLED, $validated['cancel_reason'] ?? null);

            if ($booking->customer_id) {
                $booking->customer()->increment('cancellation_count');
            }
        });

        $booking->load(['customer', 'staff', 'service', 'statusHistory']);
        $this->notifications->recordCancelled($booking);

        return response()->json(['booking' => new BookingResource($booking)]);
    }

    /**
     * Apply a guarded status transition, writing the audit history entry.
     */
    protected function transition(Booking $booking, string $status, ?string $note = null): JsonResponse
    {
        if (! $booking->canTransitionTo($status)) {
            return response()->json([
                'message' => "Cannot move booking from {$booking->status} to {$status}.",
            ], 422);
        }

        $from = $booking->status;

        DB::transaction(function () use ($booking, $status, $note, $from) {
            $booking->update(['status' => $status]);
            $this->writeHistory($booking, $from, $status, $note);
        });

        $booking->load(['customer', 'staff', 'service', 'statusHistory']);

        return response()->json(['booking' => new BookingResource($booking)]);
    }

    /**
     * Write the audit history entry for a transition.
     */
    protected function writeHistory(Booking $booking, ?string $from, string $to, ?string $note): void
    {
        $user = request()->user();

        BookingStatusHistory::create([
            'booking_id' => $booking->id,
            'from_status' => $from,
            'to_status' => $to,
            'changed_by' => $user?->id,
            'changed_by_type' => BookingStatusHistory::BY_USER,
            'note' => $note,
        ]);
    }

    /**
     * Only the assigned staff member or an admin may change a booking's
     * status from the staff/admin surface.
     */
    protected function authorizeStaff(Booking $booking): void
    {
        $user = request()->user();

        if (! $user->isAdmin() && $booking->staff_id !== $user->id) {
            abort(403, 'Forbidden');
        }
    }
}
