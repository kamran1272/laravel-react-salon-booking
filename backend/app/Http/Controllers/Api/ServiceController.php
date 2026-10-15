<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreServiceRequest;
use App\Http\Requests\UpdateServiceRequest;
use App\Http\Resources\ServiceCategoryResource;
use App\Http\Resources\ServiceResource;
use App\Http\Resources\UserResource;
use App\Models\SalonSetting;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Services\AvailabilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ServiceController extends Controller
{
    public function __construct(protected AvailabilityService $availability) {}

    /**
     * Public service catalog, grouped by category.
     */
    public function index(): JsonResponse
    {
        $settings = SalonSetting::current();

        $categories = ServiceCategory::where('is_active', true)
            ->orderBy('sort_order')
            ->with(['services' => fn ($q) => $q
                ->where('is_active', true)
                ->where('bookable_online', true)
                ->orderBy('name')])
            ->get();

        // Services without a category go under "Other".
        $uncategorized = Service::where('is_active', true)
            ->where('bookable_online', true)
            ->whereNull('category_id')
            ->orderBy('name')
            ->get();

        return response()->json([
            'categories' => ServiceCategoryResource::collection($categories),
            'uncategorized' => ServiceResource::collection($uncategorized),
            'currency' => $settings->currency,
        ]);
    }

    /**
     * Public service detail: description, staff who perform it, and the
     * cancellation policy the customer will agree to.
     */
    public function show(Service $service): JsonResponse
    {
        if (! $service->is_active) {
            return response()->json(['message' => 'This service is not currently available.'], 404);
        }

        $settings = SalonSetting::current();
        $service->load(['category', 'staff' => fn ($q) => $q
            ->where('role', 'staff')
            ->where('bookable_online', true)
            ->orderBy('name')]);

        $staff = $service->staff->map(fn ($member) => [
            'id' => $member->id,
            'name' => $member->name,
            'photo_url' => $member->photo_url,
            'bio' => $member->bio,
            'next_available' => $this->availability->nextAvailable($service, $member)?->toIso8601String(),
        ]);

        return response()->json([
            'service' => new ServiceResource($service),
            'staff' => $staff,
            'policy' => [
                'text' => $settings->cancellation_policy_text,
                'free_cancellation_hours' => $settings->free_cancellation_hours,
            ],
        ]);
    }

    /**
     * Create a new service (admin only).
     */
    public function store(StoreServiceRequest $request): JsonResponse
    {
        $service = Service::create($request->safe()->except('staff_ids'));

        if ($request->validated('staff_ids') !== null) {
            $service->staff()->sync($request->validated('staff_ids'));
        }

        $service->load(['category', 'staff']);

        return response()->json(['service' => new ServiceResource($service)], 201);
    }

    /**
     * Update a service (admin only).
     */
    public function update(UpdateServiceRequest $request, Service $service): JsonResponse
    {
        $service->update($request->safe()->except('staff_ids'));

        if ($request->validated('staff_ids') !== null) {
            $service->staff()->sync($request->validated('staff_ids'));
        }

        $service->load(['category', 'staff']);

        return response()->json(['service' => new ServiceResource($service)]);
    }

    /**
     * Deactivate a service (admin only). Services are never hard-deleted —
     * past bookings keep their snapshots regardless.
     */
    public function destroy(Service $service): JsonResponse
    {
        $service->update(['is_active' => false, 'bookable_online' => false]);

        return response()->json(null, 204);
    }

    /**
     * List all services including inactive ones (admin only).
     */
    public function adminIndex(Request $request): AnonymousResourceCollection
    {
        $services = Service::query()
            ->with(['category', 'staff'])
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return ServiceResource::collection($services);
    }
}
