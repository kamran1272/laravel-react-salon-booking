<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SalonSettingResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'salon_name' => $this->salon_name,
            'timezone' => $this->timezone,
            'timezone_label' => 'All times shown in '.$this->timezone,
            'currency' => $this->currency,
            'phone' => $this->phone,
            'email' => $this->email,
            'address' => $this->address,
            'opening_hours' => $this->openingHours(),
            'booking_window_days' => $this->booking_window_days,
            'lead_time_minutes' => $this->lead_time_minutes,
            'slot_step_minutes' => $this->slot_step_minutes,
            'free_cancellation_hours' => $this->free_cancellation_hours,
            'cancellation_policy_text' => $this->cancellation_policy_text,
            'reminder_schedule' => $this->reminder_schedule,
        ];
    }
}
