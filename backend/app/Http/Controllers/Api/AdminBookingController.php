<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateBookingRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\BookingStatusHistory;
use App\Models\SalonSetting;
use App\Models\Service;
use App\Models\User;
use App\Services\AvailabilityService;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdminBookingController extends Controller
{
    public function __construct(
        protected AvailabilityService $availability,
        protected NotificationService $notifications,
    ) {}

    /**
     * List all bookings with optional filters (admin only).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'status' => ['sometimes', 'string', 'in:booked,confirmed,completed,cancelled,no_show'],
            'date' => ['sometimes', 'date_format:Y-m-d'],
            'staff_id' => ['sometimes', 'integer', 'exists:users,id'],
            'search' => ['sometimes', 'string', 'max:255'],
        ]);

        $bookings = Booking::query()
            ->with(['customer', 'staff', 'service', 'statusHistory'])
            ->when(isset($validated['status']), fn ($q) => $q->where('status', $validated['status']))
            ->when(isset($validated['date']), function ($q) use ($validated) {
                $settings = SalonSetting::current();
                $day = \Carbon\Carbon::createFromFormat('Y-m-d', $validated['date'], $settings->timezone);
                $q->where('starts_at', '>=', $day->copy()->setTimezone('UTC'))
                    ->where('starts_at', '<', $day->copy()->addDay()->setTimezone('UTC'));
            })
            ->when(isset($validated['staff_id']), fn ($q) => $q->where('staff_id', $validated['staff_id']))
            ->when(isset($validated['search']), function ($q) use ($validated) {
                $search = $validated['search'];
                $q->where(fn ($qq) => $qq
                    ->where('reference_code', 'like', '%'.$search.'%')
                    ->orWhere('guest_name', 'like', '%'.$search.'%')
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', '%'.$search.'%')));
            })
            ->orderBy('starts_at', 'desc')
            ->paginate(15)
            ->withQueryString();

        return BookingResource::collection($bookings);
    }

    /**
     * Create a booking with full control (admin only): any customer
     * (account or guest details), any staff, any service, any status.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'service_id' => ['required', 'integer', 'exists:services,id'],
            'staff_id' => ['required', 'integer', 'exists:users,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'start_time' => ['required', 'date_format:H:i'],
            'customer_id' => ['nullable', 'integer', 'exists:users,id'],
            'guest_name' => ['nullable', 'string', 'max:255'],
            'guest_phone' => ['nullable', 'string', 'max:32'],
            'guest_email' => ['nullable', 'email', 'max:255'],
            // Contract aliases for the admin "book for someone" form.
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:32'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'source' => ['sometimes', 'string', 'in:online,walk_in,phone'],
            'status' => ['sometimes', 'string', 'in:booked,confirmed'],
        ]);

        $service = Service::findOrFail($validated['service_id']);
        $staff = User::where('role', 'staff')->findOrFail($validated['staff_id']);
        $settings = SalonSetting::current();

        $startsAtUtc = $settings->localToUtc($validated['date'].' '.$validated['start_time']);
        $occupiedMinutes = $service->duration_minutes + $service->buffer_minutes;
        $endsAtUtc = $startsAtUtc->copy()->addMinutes($occupiedMinutes);

        $booking = DB::transaction(function () use ($validated, $service, $staff, $startsAtUtc, $endsAtUtc, $request) {
            if (! $this->availability->intervalIsFree($staff, $startsAtUtc, $endsAtUtc)) {
                abort(422, 'This time slot is not available for the selected staff member.');
            }

            $booking = Booking::create([
                'reference_code' => $this->uniqueReferenceCode(),
                'customer_id' => $validated['customer_id'] ?? null,
                'staff_id' => $staff->id,
                'service_id' => $service->id,
                'starts_at' => $startsAtUtc,
                'ends_at' => $endsAtUtc,
                'status' => $validated['status'] ?? Booking::STATUS_BOOKED,
                'source' => $validated['source'] ?? Booking::SOURCE_PHONE,
                'service_name' => $service->name,
                'duration_minutes' => $service->duration_minutes,
                'price_cents' => $service->price_cents,
                'guest_name' => $validated['guest_name'] ?? $validated['customer_name'] ?? null,
                'guest_phone' => $validated['guest_phone'] ?? $validated['customer_phone'] ?? null,
                'guest_email' => $validated['guest_email'] ?? $validated['customer_email'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ]);

            BookingStatusHistory::create([
                'booking_id' => $booking->id,
                'from_status' => null,
                'to_status' => $booking->status,
                'changed_by' => $request->user()->id,
                'changed_by_type' => BookingStatusHistory::BY_USER,
                'note' => 'Created by admin.',
            ]);

            return $booking;
        });

        $booking->load(['customer', 'staff', 'service', 'statusHistory']);
        $this->notifications->recordConfirmation($booking);

        return response()->json(['booking' => new BookingResource($booking)], 201);
    }

    /**
     * Edit a booking: reassign staff/service, move to a new time, update
     * guest details or notes (admin only). Status changes use the
     * dedicated transition endpoints.
     */
    public function update(UpdateBookingRequest $request, Booking $booking): JsonResponse
    {
        $validated = $request->validated();

        if (in_array($booking->status, Booking::TERMINAL_STATUSES, true)) {
            return response()->json(['message' => 'Terminal bookings cannot be edited.'], 422);
        }

        $service = isset($validated['service_id'])
            ? Service::findOrFail($validated['service_id'])
            : $booking->service;

        $staff = isset($validated['staff_id'])
            ? User::where('role', 'staff')->findOrFail($validated['staff_id'])
            : $booking->staff;

        $settings = SalonSetting::current();
        $moveTime = isset($validated['date']) || isset($validated['start_time']);

        $updated = DB::transaction(function () use ($request, $booking, $validated, $service, $staff, $settings, $moveTime) {
            $data = [
                'guest_name' => $validated['guest_name'] ?? $booking->guest_name,
                'guest_phone' => $validated['guest_phone'] ?? $booking->guest_phone,
                'guest_email' => $validated['guest_email'] ?? $booking->guest_email,
                'notes' => $validated['notes'] ?? $booking->notes,
            ];

            if (array_key_exists('customer_id', $validated)) {
                $data['customer_id'] = $validated['customer_id'];
            }

            if ($service->id !== $booking->service_id || $staff->id !== $booking->staff_id || $moveTime) {
                $date = $validated['date'] ?? $booking->starts_at->copy()->setTimezone($settings->timezone)->format('Y-m-d');
                $time = $validated['start_time'] ?? $booking->starts_at->copy()->setTimezone($settings->timezone)->format('H:i');

                $startsAtUtc = $settings->localToUtc($date.' '.$time);
                $occupiedMinutes = $service->duration_minutes + $service->buffer_minutes;
                $endsAtUtc = $startsAtUtc->copy()->addMinutes($occupiedMinutes);

                if (! $this->availability->intervalIsFree($staff, $startsAtUtc, $endsAtUtc, $booking->id)) {
                    abort(422, 'The new time slot is not available for the selected staff member.');
                }

                $data['service_id'] = $service->id;
                $data['staff_id'] = $staff->id;
                $data['starts_at'] = $startsAtUtc;
                $data['ends_at'] = $endsAtUtc;
                // Snapshots follow the (possibly new) service.
                $data['service_name'] = $service->name;
                $data['duration_minutes'] = $service->duration_minutes;
                $data['price_cents'] = $service->price_cents;
            }

            $booking->update($data);

            return $booking;
        });

        $updated->load(['customer', 'staff', 'service', 'statusHistory']);
        $this->notifications->recordRescheduled($updated);

        return response()->json(['booking' => new BookingResource($updated)]);
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
