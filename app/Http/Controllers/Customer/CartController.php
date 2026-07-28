<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\OutletInventory;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function addItem(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id,is_active,1'],
            'quantity' => ['required', 'integer', 'min:1', 'max:999'],
        ]);

        $product = Product::findOrFail($validated['product_id']);
        $quantity = $validated['quantity'];

        $outletId = session('checkout.fulfillment.selected_outlet_id');

        $inventory = OutletInventory::where('product_id', $product->id)
            ->where('is_active', true)
            ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId))
            ->first();

        $availableStock = $inventory
            ? max(0, (int) $inventory->current_stock - (int) $inventory->reserved_stock)
            : 0;

        $maxQuantity = $availableStock;

        if ($availableStock <= 0) {
            return response()->json([
                'success' => false,
                'error' => 'Stok produk ini sudah habis',
                'item' => [
                    'product_id' => $product->id,
                    'quantity' => 0,
                    'available_stock' => 0,
                    'max_quantity' => 0,
                ],
            ]);
        }

        $originalQuantity = $quantity;
        if ($quantity > $availableStock) {
            $quantity = $availableStock;
        }

        $cart = $request->session()->get('checkout.cart', []);
        $existingKey = collect($cart)->search(fn ($item) => ((int) ($item['product_id'] ?? 0)) === $product->id);

        if ($existingKey !== false) {
            $newQuantity = $cart[$existingKey]['quantity'] + $quantity;
            $cart[$existingKey]['quantity'] = min($newQuantity, $maxQuantity);
        } else {
            $cart[] = [
                'product_id' => $product->id,
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
                'product_id' => $product->id,
                'quantity' => $quantity,
                'available_stock' => $availableStock,
                'max_quantity' => $maxQuantity,
            ],
            'warning' => $warning,
        ]);
    }

    public function removeItem(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer'],
        ]);

        $productId = (int) $validated['product_id'];
        $cart = collect($request->session()->get('checkout.cart', []));
        $items = $cart->filter(fn ($item) => ((int) ($item['product_id'] ?? 0)) !== $productId)->values()->toArray();

        $request->session()->put('checkout.cart', $items);

        return response()->json([
            'success' => true,
            'cart_count' => collect($items)->sum('quantity'),
        ]);
    }

    public function setQuantity(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer'],
            'quantity' => ['required', 'integer', 'min:0', 'max:999'],
        ]);

        $productId = (int) $validated['product_id'];
        $quantity = (int) $validated['quantity'];

        if ($quantity <= 0) {
            return $this->removeItem($request);
        }

        $outletId = $request->integer('outlet_id')
            ?: session('checkout.fulfillment.selected_outlet_id');

        if ($outletId) {
            $inventory = OutletInventory::query()
                ->where('outlet_id', $outletId)
                ->where('product_id', $productId)
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
            if (((int) ($item['product_id'] ?? 0)) === $productId) {
                $item['quantity'] = $quantity;
                $found = true;
                break;
            }
        }

        if (! $found) {
            $items[] = ['product_id' => $productId, 'quantity' => $quantity];
        }

        $request->session()->put('checkout.cart', $items);

        return response()->json([
            'success' => true,
            'cart_count' => collect($items)->sum('quantity'),
        ]);
    }

    public function selectOutlet(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'outlet_id' => 'required|integer|exists:outlets,id',
        ]);

        session(['checkout.fulfillment.selected_outlet_id' => $validated['outlet_id']]);

        return response()->json(['success' => true]);
    }
}
