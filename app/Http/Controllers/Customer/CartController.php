<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\OutletInventory;
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
            'quantity' => ['required', 'integer', 'min:1', 'max:999'],
        ]);

        $variantId = (int) $validated['product_variant_id'];
        $quantity = (int) $validated['quantity'];

        // Resolve outlet from session or request
        $outletId = $request->integer('outlet_id')
            ?: session('checkout.fulfillment.selected_outlet_id');

        // Validate stock availability if outlet is known
        if ($outletId) {
            $inventory = OutletInventory::query()
                ->where('outlet_id', $outletId)
                ->where('product_variant_id', $variantId)
                ->where('is_active', true)
                ->first();

            if ($inventory) {
                $availableStock = max(0, $inventory->current_stock - $inventory->reserved_stock);
                $existingQty = $this->getExistingCartQuantity($request, $variantId);
                $requestedTotal = $existingQty + $quantity;

                if ($availableStock <= 0) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Stok produk ini sudah habis.',
                        'error_code' => 'out_of_stock',
                        'available_stock' => 0,
                    ], 422);
                }

                if ($requestedTotal > $availableStock) {
                    $maxAddable = max(0, $availableStock - $existingQty);

                    if ($maxAddable <= 0) {
                        return response()->json([
                            'success' => false,
                            'message' => "Stok tidak cukup. Maksimal {$availableStock} item di keranjang.",
                            'error_code' => 'insufficient_stock',
                            'available_stock' => $availableStock,
                            'max_addable' => 0,
                        ], 422);
                    }

                    // Auto-clamp to available stock
                    $quantity = $maxAddable;
                }
            }
        }

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

        $response = [
            'success' => true,
            'item' => [
                'product_variant_id' => $variantId,
                'quantity' => $quantity,
                'name' => $variant?->family?->name ?? $variant?->name ?? 'Produk',
                'variant_name' => $variant?->name ?? '',
            ],
            'cart_count' => collect($items)->sum('quantity'),
        ];

        // Warn if quantity was clamped
        if ($quantity < (int) $validated['quantity']) {
            $response['warning'] = "Jumlah disesuaikan ke {$quantity} (stok terbatas).";
        }

        return response()->json($response);
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
            'quantity' => ['required', 'integer', 'min:0', 'max:999'],
        ]);

        $variantId = (int) $validated['product_variant_id'];
        $quantity = (int) $validated['quantity'];

        if ($quantity <= 0) {
            return $this->removeItem($request);
        }

        // Clamp to available stock if outlet is known
        $outletId = $request->integer('outlet_id')
            ?: session('checkout.fulfillment.selected_outlet_id');

        if ($outletId) {
            $inventory = OutletInventory::query()
                ->where('outlet_id', $outletId)
                ->where('product_variant_id', $variantId)
                ->where('is_active', true)
                ->first();

            if ($inventory) {
                $availableStock = max(0, $inventory->current_stock - $inventory->reserved_stock);

                if ($availableStock <= 0) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Stok produk ini sudah habis.',
                        'error_code' => 'out_of_stock',
                        'available_stock' => 0,
                    ], 422);
                }

                if ($quantity > $availableStock) {
                    $quantity = $availableStock;
                }
            }
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

    private function getExistingCartQuantity(Request $request, int $variantId): int
    {
        $cart = collect($request->session()->get('checkout.cart', []));
        $existing = $cart->first(fn ($item) => ((int) ($item['product_variant_id'] ?? 0)) === $variantId);

        return $existing ? (int) $existing['quantity'] : 0;
    }
}
