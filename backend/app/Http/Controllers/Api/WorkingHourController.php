<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreWorkingHourRequest;
use App\Http\Resources\WorkingHourResource;
use App\Models\User;
use App\Models\WorkingHour;
use Illuminate\Http\JsonResponse;

class WorkingHourController extends Controller
{
    /**
     * All staff working hours (admin only).
     */
    public function index(): JsonResponse
    {
        $hours = WorkingHour::with('user')
            ->orderBy('user_id')
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->get();

        return response()->json(['data' => WorkingHourResource::collection($hours)]);
    }

    /**
     * Add a working-hours window for a staff member (admin only).
     * Multiple windows per weekday are allowed (e.g. split shifts around
     * a lunch break) — each window is its own row.
     */
    public function store(StoreWorkingHourRequest $request): JsonResponse
    {
        $hours = WorkingHour::create($request->validated());
        $hours->load('user');

        return response()->json(['working_hour' => new WorkingHourResource($hours)], 201);
    }

    /**
     * Remove one working-hours window (admin only).
     */
    public function destroy(WorkingHour $workingHour): JsonResponse
    {
        $workingHour->delete();

        return response()->json(null, 204);
    }

    /**
     * One staff member's weekly hours (admin only).
     */
    public function forStaff(User $user): JsonResponse
    {
        $hours = WorkingHour::where('user_id', $user->id)
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->get();

        return response()->json(['data' => WorkingHourResource::collection($hours)]);
    }
}
