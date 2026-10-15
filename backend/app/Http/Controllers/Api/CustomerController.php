<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Http\Resources\UserResource;
use App\Models\Booking;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CustomerController extends Controller
{
    /**
     * Customer list with search (admin only).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'search' => ['sometimes', 'string', 'max:255'],
        ]);

        $customers = User::where('role', 'customer')
            ->when(isset($validated['search']), function ($q) use ($validated) {
                $search = $validated['search'];
                $q->where(fn ($qq) => $qq
                    ->where('name', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%')
                    ->orWhere('phone', 'like', '%'.$search.'%'));
            })
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return UserResource::collection($customers);
    }

    /**
     * Customer profile: details, booking history, and attendance stats
     * (admin only).
     */
    public function show(User $customer): JsonResponse
    {
        if ($customer->role !== 'customer') {
            return response()->json(['message' => 'Not a customer.'], 422);
        }

        $bookings = Booking::where('customer_id', $customer->id)
            ->with(['staff', 'service', 'statusHistory'])
            ->orderBy('starts_at', 'desc')
            ->get();

        return response()->json([
            'customer' => new UserResource($customer),
            'bookings' => BookingResource::collection($bookings),
            'stats' => [
                'visits' => $bookings->where('status', Booking::STATUS_COMPLETED)->count(),
                'upcoming' => $bookings->whereIn('status', Booking::ACTIVE_STATUSES)->count(),
                'no_show_count' => $customer->no_show_count,
                'cancellation_count' => $customer->cancellation_count,
                'total_spend_cents' => $customer->total_spend_cents,
            ],
        ]);
    }

    /**
     * Update customer notes (admin only).
     */
    public function updateNotes(Request $request, User $customer): JsonResponse
    {
        if ($customer->role !== 'customer') {
            return response()->json(['message' => 'Not a customer.'], 422);
        }

        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $customer->update(['notes' => $validated['notes'] ?? null]);

        return response()->json(['customer' => new UserResource($customer)]);
    }
}
