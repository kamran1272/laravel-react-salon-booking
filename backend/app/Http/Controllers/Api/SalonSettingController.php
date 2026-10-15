<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateSalonSettingRequest;
use App\Http\Resources\SalonSettingResource;
use App\Models\SalonSetting;
use Illuminate\Http\JsonResponse;

class SalonSettingController extends Controller
{
    /**
     * Public salon profile + booking policy (powers the booking flow).
     */
    public function public(): JsonResponse
    {
        return response()->json(['salon' => new SalonSettingResource(SalonSetting::current())]);
    }

    /**
     * Full settings (admin only).
     */
    public function show(): JsonResponse
    {
        return response()->json(['settings' => new SalonSettingResource(SalonSetting::current())]);
    }

    /**
     * Update settings (admin only).
     */
    public function update(UpdateSalonSettingRequest $request): JsonResponse
    {
        $settings = SalonSetting::current();
        $settings->update($request->validated());

        return response()->json(['settings' => new SalonSettingResource($settings->fresh())]);
    }
}
