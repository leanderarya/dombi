<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CartController extends Controller
{
    /**
     * Add an item to the session cart (merge with existing).
     * Returns JSON for client-side toast/badge updates.
     */
    public function addItem(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_variant_id' => ['required', 'integer', Rule::exists('product_variants', 'id')->where('is_active', true)],
            'quantity' => ['required', 'integer', 'min:1'],
        ]);

        $variantId = (int) $validated['product_variant_id'];
        $quantity = (int) $validated['quantity'];

        $cart = collect($request->session()->get('checkout.cart', []));

        // Check if variant already in cart
        $existingIndex = $cart->search(fn ($item) => ((int) ($item['product_variant_id'] ?? 0)) === $variantId);

        if ($existingIndex !== false) {
            // Update quantity
            $items = $cart->toArray();
            $items[$existingIndex]['quantity'] = ((int) $items[$existingIndex]['quantity']) + $quantity;
        } else {
            // Add new item
            $items = $cart->push([
                'product_variant_id' => $variantId,
                'quantity' => $quantity,
            ])->toArray();
        }

        $request->session()->put('checkout.cart', $items);

        // Load variant info for response
        $variant = ProductVariant::query()
            ->with('family')
            ->find($variantId);

        return response()->json([
            'success' => true,
            'item' => [
                'product_variant_id' => $variantId,
                'quantity' => $quantity,
                'name' => $variant?->family?->name ?? $variant?->name ?? 'Produk',
                'variant_name' => $variant?->name ?? '',
            ],
            'cart_count' => collect($items)->sum('quantity'),
        ]);
    }
}
