<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBlockoutRequest;
use App\Http\Resources\BlockoutResource;
use App\Models\Blockout;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BlockoutController extends Controller
{
    /**
     * Blockouts (admin only), upcoming first.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'staff_id' => ['sometimes', 'integer', 'exists:users,id'],
            'upcoming_only' => ['sometimes', 'boolean'],
        ]);

        $blockouts = Blockout::query()
            ->with('staff')
            ->when(isset($validated['staff_id']), fn ($q) => $q->where('staff_id', $validated['staff_id']))
            ->when($validated['upcoming_only'] ?? true, fn ($q) => $q->where('ends_at', '>=', now()))
            ->orderBy('starts_at')
            ->paginate(15)
            ->withQueryString();

        return BlockoutResource::collection($blockouts);
    }

    /**
     * Create a blockout (admin only).
     */
    public function store(StoreBlockoutRequest $request): JsonResponse
    {
        $blockout = Blockout::create($request->validated());
        $blockout->load('staff');

        return response()->json(['blockout' => new BlockoutResource($blockout)], 201);
    }

    /**
     * Delete a blockout (admin only).
     */
    public function destroy(Blockout $blockout): JsonResponse
    {
        $blockout->delete();

        return response()->json(null, 204);
    }
}
