<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingStatusHistoryResource extends JsonResource
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
            'from_status' => $this->from_status,
            'to_status' => $this->to_status,
            'changed_by' => $this->changed_by,
            'changed_by_type' => $this->changed_by_type,
            'changed_by_name' => $this->whenLoaded('changer', fn () => $this->changer?->name),
            'note' => $this->note,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
