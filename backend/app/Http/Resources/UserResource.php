<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
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
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'role' => $this->role,
            'photo_url' => $this->photo_url,
            'bio' => $this->bio,
            'bookable_online' => $this->bookable_online,
            // Customer profile counters.
            'notes' => $this->when($this->role === 'customer', $this->notes),
            'no_show_count' => $this->when($this->role === 'customer', $this->no_show_count),
            'cancellation_count' => $this->when($this->role === 'customer', $this->cancellation_count),
            'total_spend_cents' => $this->when($this->role === 'customer', $this->total_spend_cents),
            'services' => ServiceResource::collection($this->whenLoaded('services')),
            'created_at' => $this->created_at->toIso8601String(),
            'updated_at' => $this->updated_at->toIso8601String(),
        ];
    }
}
