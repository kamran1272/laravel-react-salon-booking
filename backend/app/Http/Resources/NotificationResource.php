<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'booking_id' => $this->booking_id,
            'booking_reference' => $this->whenLoaded('booking', fn () => $this->booking->reference_code),
            'type' => $this->type,
            'channel' => $this->channel,
            'scheduled_for' => $this->scheduled_for->toIso8601String(),
            'sent_at' => $this->sent_at?->toIso8601String(),
            'status' => $this->status,
            'payload' => $this->payload,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
