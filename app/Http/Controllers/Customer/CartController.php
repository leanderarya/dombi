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

    /**
     * Remove an item from the session cart.
     */
    public function removeItem(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_variant_id' => ['required', 'integer'],
        ]);

        $variantId = (int) $validated['product_variant_id'];
        $cart = collect($request->session()->get('checkout.cart', []));
        $items = $cart->filter(fn ($item) => ((int) ($item['product_variant_id'] ?? 0)) !== $variantId)->values()->toArray();

        $request->session()->put('checkout.cart', $items);

        return response()->json([
            'success' => true,
            'cart_count' => collect($items)->sum('quantity'),
        ]);
    }

    /**
     * Update quantity for an item in the session cart.
     */
    public function setQuantity(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_variant_id' => ['required', 'integer'],
            'quantity' => ['required', 'integer', 'min:0'],
        ]);

        $variantId = (int) $validated['product_variant_id'];
        $quantity = (int) $validated['quantity'];

        if ($quantity <= 0) {
            return $this->removeItem($request);
        }

        $cart = collect($request->session()->get('checkout.cart', []));
        $items = $cart->toArray();
        $found = false;

        foreach ($items as &$item) {
            if (((int) ($item['product_variant_id'] ?? 0)) === $variantId) {
                $item['quantity'] = $quantity;
                $found = true;
                break;
            }
        }

        if (! $found) {
            $items[] = ['product_variant_id' => $variantId, 'quantity' => $quantity];
        }

        $request->session()->put('checkout.cart', $items);

        return response()->json([
            'success' => true,
            'cart_count' => collect($items)->sum('quantity'),
        ]);
    }
}
