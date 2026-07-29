<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Favorite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FavoriteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['product_ids' => []]);
        }

        $customerId = $user->getCustomerOrCreate()->id;

        $productIds = Favorite::where('customer_id', $customerId)
            ->pluck('product_id')
            ->toArray();

        return response()->json(['product_ids' => $productIds]);
    }

    public function toggle(Request $request): JsonResponse
    {
        $request->validate([
            'product_id' => 'sometimes|integer|exists:products,id',
            'variant_id' => 'sometimes|integer|exists:products,id',
        ]);

        $user = $request->user();

        if (! $user) {
            return response()->json(['error' => 'Tidak dapat menyimpan favorit.'], 422);
        }

        $customerId = $user->getCustomerOrCreate()->id;
        $productId = $request->input('product_id') ?? $request->input('variant_id');

        $existing = Favorite::where('customer_id', $customerId)
            ->where('product_id', $productId)
            ->first();

        if ($existing) {
            $existing->delete();

            return response()->json(['favorited' => false, 'product_id' => $productId]);
        }

        Favorite::create([
            'customer_id' => $customerId,
            'product_id' => $productId,
        ]);

        return response()->json(['favorited' => true, 'product_id' => $productId]);
    }

    public function merge(Request $request): JsonResponse
    {
        $request->validate([
            'product_ids' => 'array|max:200',
            'product_ids.*' => 'integer|exists:products,id',
            'variant_ids' => 'array|max:200',
            'variant_ids.*' => 'integer|exists:products,id',
        ]);

        $user = $request->user();

        if (! $user || ! $user->customer) {
            return response()->json(['error' => 'Tidak dapat menggabungkan favorit.'], 422);
        }

        $customerId = $user->customer->id;
        $productIds = $request->input('product_ids') ?? $request->input('variant_ids') ?? [];

        foreach ($productIds as $productId) {
            Favorite::firstOrCreate([
                'customer_id' => $customerId,
                'product_id' => $productId,
            ]);
        }

        $allProductIds = Favorite::where('customer_id', $customerId)
            ->pluck('product_id')
            ->toArray();

        return response()->json(['product_ids' => $allProductIds, 'merged' => true]);
    }
}
