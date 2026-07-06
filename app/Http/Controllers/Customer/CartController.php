<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\OutletInventory;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;


class CartController extends Controller
{
    /**
     * Add an item to the session cart (merge with existing).
     * Returns JSON for client-side toast/badge updates.
     */
    public function addItem(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_variant_id' => ['required', 'integer', 'exists:product_variants,id,is_active,1'],
            'quantity' => ['required', 'integer', 'min:1', 'max:999'],
        ]);

        $variant = ProductVariant::findOrFail($validated['product_variant_id']);
        $quantity = $validated['quantity'];

        // Get outlet from session
        $outletId = session('checkout.fulfillment.selected_outlet_id');

        // Get available stock from outlet inventory
        $inventory = OutletInventory::where('product_variant_id', $variant->id)
            ->where('is_active', true)
            ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId))
            ->first();

        $availableStock = $inventory
            ? max(0, (int) $inventory->current_stock - (int) $inventory->reserved_stock)
            : 0;

        $maxQuantity = $availableStock;

        // Check if out of stock
        if ($availableStock <= 0) {
            return response()->json([
                'success' => false,
                'error' => 'Stok produk ini sudah habis',
                'item' => [
                    'product_variant_id' => $variant->id,
                    'quantity' => 0,
                    'available_stock' => 0,
                    'max_quantity' => 0,
                ],
            ]);
        }

        // Auto-adjust if exceeds available stock
        $originalQuantity = $quantity;
        if ($quantity > $availableStock) {
            $quantity = $availableStock;
        }

        // Store in session cart
        $cart = $request->session()->get('checkout.cart', []);
        $existingKey = collect($cart)->search(fn ($item) => ((int) ($item['product_variant_id'] ?? 0)) === $variant->id);

        if ($existingKey !== false) {
            $newQuantity = $cart[$existingKey]['quantity'] + $quantity;
            $cart[$existingKey]['quantity'] = min($newQuantity, $maxQuantity);
        } else {
            $cart[] = [
                'product_variant_id' => $variant->id,
                'quantity' => $quantity,
            ];
        }

        $request->session()->put('checkout.cart', $cart);

        $warning = null;
        if ($originalQuantity > $availableStock) {
            $warning = "Jumlah dikurangi dari {$originalQuantity} ke {$availableStock} (stok tersisa {$availableStock})";
        }

        return response()->json([
            'success' => true,
            'item' => [
                'product_variant_id' => $variant->id,
                'quantity' => $quantity,
                'available_stock' => $availableStock,
                'max_quantity' => $maxQuantity,
            ],
            'warning' => $warning,
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

}
