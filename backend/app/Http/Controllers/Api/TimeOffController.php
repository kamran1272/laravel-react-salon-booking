<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\TimeOffResource;
use App\Models\TimeOff;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TimeOffController extends Controller
{
    /**
     * Time-off requests (admin only), optionally filtered by status.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'status' => ['sometimes', 'string', 'in:pending,approved,declined'],
        ]);

        $timeOff = TimeOff::query()
            ->with('user')
            ->when(isset($validated['status']), fn ($q) => $q->where('status', $validated['status']))
            ->orderBy('starts_at')
            ->paginate(15)
            ->withQueryString();

        return TimeOffResource::collection($timeOff);
    }

    /**
     * Approve a time-off request (admin only).
     */
    public function approve(TimeOff $timeOff): JsonResponse
    {
        $timeOff->update([
            'status' => TimeOff::STATUS_APPROVED,
            'decided_by' => request()->user()->id,
        ]);

        $timeOff->load('user');

        return response()->json(['time_off' => new TimeOffResource($timeOff)]);
    }

    /**
     * Decline a time-off request (admin only).
     */
    public function decline(TimeOff $timeOff): JsonResponse
    {
        $timeOff->update([
            'status' => TimeOff::STATUS_DECLINED,
            'decided_by' => request()->user()->id,
        ]);

        $timeOff->load('user');

        return response()->json(['time_off' => new TimeOffResource($timeOff)]);
    }
}
