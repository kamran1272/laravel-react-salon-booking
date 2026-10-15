<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreStaffRequest;
use App\Http\Requests\UpdateStaffRequest;
use App\Http\Resources\UserResource;
use App\Models\Service;
use App\Models\User;
use App\Services\AvailabilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class StaffController extends Controller
{
    public function __construct(protected AvailabilityService $availability) {}

    /**
     * Public staff list for the "choose your specialist" step.
     * Optionally filtered to staff qualified for a service. Only id, name,
     * photo, bio and the next available time are exposed.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'service_id' => ['nullable', 'integer', 'exists:services,id'],
        ]);

        $query = User::where('role', 'staff')->where('bookable_online', true);

        if (! empty($validated['service_id'])) {
            $service = Service::findOrFail($validated['service_id']);
            $query->whereHas('services', fn ($q) => $q->where('services.id', $service->id));
        }

        $staff = $query->orderBy('name')->get();

        $data = $staff->map(function (User $member) use ($validated) {
            $next = null;

            if (! empty($validated['service_id'])) {
                $service = Service::find($validated['service_id']);
                $next = $this->availability->nextAvailable($service, $member)?->toIso8601String();
            }

            return [
                'id' => $member->id,
                'name' => $member->name,
                'photo_url' => $member->photo_url,
                'bio' => $member->bio,
                'next_available' => $next,
            ];
        });

        return response()->json(['data' => $data]);
    }

    /**
     * Full staff list with details (admin only).
     */
    public function adminIndex(): AnonymousResourceCollection
    {
        $staff = User::where('role', 'staff')
            ->with('services')
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return UserResource::collection($staff);
    }

    /**
     * Create a staff member (admin only).
     */
    public function store(StoreStaffRequest $request): JsonResponse
    {
        $staff = User::create([
            ...$request->safe()->except(['service_ids', 'password']),
            'password' => $request->validated('password'),
            'role' => 'staff',
        ]);

        if ($request->validated('service_ids') !== null) {
            $staff->services()->sync($request->validated('service_ids'));
        }

        $staff->load('services');

        return response()->json(['staff' => new UserResource($staff)], 201);
    }

    /**
     * Update a staff member (admin only).
     */
    public function update(UpdateStaffRequest $request, User $staff): JsonResponse
    {
        if ($staff->role !== 'staff') {
            return response()->json(['message' => 'Not a staff member.'], 422);
        }

        $data = $request->safe()->except(['service_ids', 'password']);

        if ($request->validated('password')) {
            $data['password'] = $request->validated('password');
        }

        $staff->update($data);

        if ($request->validated('service_ids') !== null) {
            $staff->services()->sync($request->validated('service_ids'));
        }

        $staff->load('services');

        return response()->json(['staff' => new UserResource($staff)]);
    }
}
