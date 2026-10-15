<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BlockoutResource extends JsonResource
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
            'staff_id' => $this->staff_id,
            'staff' => new UserResource($this->whenLoaded('staff')),
            'applies_to' => $this->staff_id ? 'staff' : 'whole_salon',
            'starts_at' => $this->starts_at->toIso8601String(),
            'ends_at' => $this->ends_at->toIso8601String(),
            'reason' => $this->reason,
            'blocks_online_booking' => $this->blocks_online_booking,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
