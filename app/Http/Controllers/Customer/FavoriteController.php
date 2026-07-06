<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Favorite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FavoriteController extends Controller
{
    /**
     * List favorite variant IDs for the current customer.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['variant_ids' => []]);
        }

        $customerId = $user->getCustomerOrCreate()->id;

        $variantIds = Favorite::where('customer_id', $customerId)
            ->pluck('product_variant_id')
            ->toArray();

        return response()->json(['variant_ids' => $variantIds]);
    }

    /**
     * Toggle a favorite: add if missing, remove if present (idempotent).
     */
    public function toggle(Request $request): JsonResponse
    {
        $request->validate([
            'product_variant_id' => 'required|integer|exists:product_variants,id',
        ]);

        $user = $request->user();

        if (! $user) {
            return response()->json(['error' => 'Tidak dapat menyimpan favorit.'], 422);
        }

        $customerId = $user->getCustomerOrCreate()->id;
        $variantId = $request->input('product_variant_id');

        $existing = Favorite::where('customer_id', $customerId)
            ->where('product_variant_id', $variantId)
            ->first();

        if ($existing) {
            $existing->delete();

            return response()->json(['favorited' => false, 'product_variant_id' => $variantId]);
        }

        Favorite::create([
            'customer_id' => $customerId,
            'product_variant_id' => $variantId,
        ]);

        return response()->json(['favorited' => true, 'product_variant_id' => $variantId]);
    }

    /**
     * Merge guest favorites into the authenticated user's account (union).
     * Called after login. Requires auth.
     */
    public function merge(Request $request): JsonResponse
    {
        $request->validate([
            'variant_ids' => 'array|max:200',
            'variant_ids.*' => 'integer|exists:product_variants,id',
        ]);

        $user = $request->user();

        if (! $user || ! $user->customer) {
            return response()->json(['error' => 'Tidak dapat menggabungkan favorit.'], 422);
        }

        $customerId = $user->customer->id;
        $variantIds = $request->input('variant_ids', []);

        // Union merge: insert missing, ignore duplicates
        foreach ($variantIds as $variantId) {
            Favorite::firstOrCreate([
                'customer_id' => $customerId,
                'product_variant_id' => $variantId,
            ]);
        }

        // Return full merged list
        $allVariantIds = Favorite::where('customer_id', $customerId)
            ->pluck('product_variant_id')
            ->toArray();

        return response()->json(['variant_ids' => $allVariantIds, 'merged' => true]);
    }
}
