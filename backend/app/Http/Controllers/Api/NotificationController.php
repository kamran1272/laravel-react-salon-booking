<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class NotificationController extends Controller
{
    /**
     * Notification log (admin only): what the product recorded/sent.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'booking_id' => ['sometimes', 'integer', 'exists:bookings,id'],
            'status' => ['sometimes', 'string', 'in:scheduled,sent,failed'],
            'type' => ['sometimes', 'string', 'max:32'],
        ]);

        $notifications = Notification::query()
            ->with('booking')
            ->when(isset($validated['booking_id']), fn ($q) => $q->where('booking_id', $validated['booking_id']))
            ->when(isset($validated['status']), fn ($q) => $q->where('status', $validated['status']))
            ->when(isset($validated['type']), fn ($q) => $q->where('type', $validated['type']))
            ->orderBy('scheduled_for', 'desc')
            ->paginate(20)
            ->withQueryString();

        return NotificationResource::collection($notifications);
    }

    /**
     * Single notification record (admin only).
     */
    public function show(Notification $notification): JsonResponse
    {
        $notification->load('booking');

        return response()->json(['notification' => new NotificationResource($notification)]);
    }
}
