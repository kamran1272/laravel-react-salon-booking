<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreServiceCategoryRequest;
use App\Http\Requests\UpdateServiceCategoryRequest;
use App\Http\Resources\ServiceCategoryResource;
use App\Models\ServiceCategory;
use Illuminate\Http\JsonResponse;

class ServiceCategoryController extends Controller
{
    /**
     * List categories (admin only).
     */
    public function index(): JsonResponse
    {
        $categories = ServiceCategory::orderBy('sort_order')
            ->withCount('services')
            ->get();

        return response()->json(['data' => ServiceCategoryResource::collection($categories)]);
    }

    /**
     * Create a category (admin only).
     */
    public function store(StoreServiceCategoryRequest $request): JsonResponse
    {
        $category = ServiceCategory::create($request->validated());

        return response()->json(['category' => new ServiceCategoryResource($category)], 201);
    }

    /**
     * Update a category (admin only).
     */
    public function update(UpdateServiceCategoryRequest $request, ServiceCategory $serviceCategory): JsonResponse
    {
        $serviceCategory->update($request->validated());

        return response()->json(['category' => new ServiceCategoryResource($serviceCategory)]);
    }

    /**
     * Delete a category (admin only). Services keep their data — the
     * category link is nulled and they appear under "Other".
     */
    public function destroy(ServiceCategory $serviceCategory): JsonResponse
    {
        $serviceCategory->delete();

        return response()->json(null, 204);
    }
}
