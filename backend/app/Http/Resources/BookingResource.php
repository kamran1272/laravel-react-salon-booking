<?php

namespace App\Http\Resources;

use App\Models\Booking;
use App\Models\SalonSetting;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $settings = SalonSetting::current();
        $tz = $settings->timezone;
        $localStart = $this->starts_at->copy()->setTimezone($tz);

        $cutoffHours = $settings->free_cancellation_hours;
        $freeCancelDeadline = $this->starts_at->copy()->subHours($cutoffHours);

        return [
            'id' => $this->id,
            'reference_code' => $this->reference_code,
            'status' => $this->status,
            'source' => $this->source,
            'starts_at' => $this->starts_at->toIso8601String(),
            'ends_at' => $this->ends_at->toIso8601String(),
            'starts_at_local' => $localStart->format('Y-m-d H:i'),
            'date_label' => $localStart->format('D, M j'),
            'time_label' => $localStart->format('g:i A'),
            'timezone' => $tz,
            'duration_minutes' => $this->duration_minutes,
            'service' => [
                'id' => $this->service_id,
                'name' => $this->service_name,
                'duration_minutes' => $this->duration_minutes,
                'price_cents' => $this->price_cents,
            ],
            'staff' => $this->whenLoaded('staff', fn () => [
                'id' => $this->staff->id,
                'name' => $this->staff->name,
            ]),
            'customer' => [
                'id' => $this->customer_id,
                'name' => $this->customerDisplayName(),
                'phone' => $this->contactPhone(),
                'email' => $this->contactEmail(),
            ],
            'guest_name' => $this->guest_name,
            'notes' => $this->notes,
            'price_cents' => $this->price_cents,
            'free_cancel_deadline' => $freeCancelDeadline->toIso8601String(),
            'free_cancel_deadline_label' => $freeCancelDeadline->copy()->setTimezone($tz)->format('D, M j g:i A'),
            'can_cancel' => $this->canCancel(),
            'can_reschedule' => $this->canReschedule($cutoffHours),
            'late_cancel' => (bool) $this->late_cancel,
            'cancel_reason' => $this->cancel_reason,
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'status_history' => BookingStatusHistoryResource::collection($this->whenLoaded('statusHistory')),
            'created_at' => $this->created_at->toIso8601String(),
            'updated_at' => $this->updated_at->toIso8601String(),
        ];
    }

    /**
     * Cancellation is possible only before the appointment starts and only
     * from a non-terminal state.
     */
    protected function canCancel(): bool
    {
        return $this->starts_at->isFuture()
            && ! in_array($this->status, Booking::TERMINAL_STATUSES, true)
            && $this->resource->canTransitionTo(Booking::STATUS_CANCELLED);
    }

    /**
     * Rescheduling additionally requires the free-cancellation cutoff.
     */
    protected function canReschedule(int $cutoffHours): bool
    {
        return $this->canCancel()
            && $this->starts_at->gt(now()->addHours($cutoffHours));
    }
}
