<?php

namespace Database\Seeders;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\RestockRequest;
use App\Models\RestockRequestItem;
use App\Models\StockDistribution;
use App\Models\StockDistributionItem;
use App\Models\User;
use Illuminate\Database\Seeder;

class PersediaanDemoSeeder extends Seeder
{
    public function run(): void
    {
        $owner = User::where('role', 'owner')->first();
        if (! $owner) {
            $this->command->warn('PersediaanDemoSeeder: No owner found — skipping.');

            return;
        }

        $outlets = Outlet::where('status', 'active')->get();
        $products = Product::where('is_active', true)->get();

        if ($outlets->isEmpty() || $products->isEmpty()) {
            $this->command->warn('PersediaanDemoSeeder: No outlets or products — run OutletSeeder + ProductCatalogSeeder first.');

            return;
        }

        $this->randomizeStock($outlets, $products);

        foreach ($outlets as $outlet) {
            $outletUser = User::where('outlet_id', $outlet->id)->where('role', 'outlet')->first();

            $requesterId = $outletUser?->id ?? $owner->id;
            $pickProducts = $products->random(min(4, $products->count()));

            $this->createRestock($outlet->id, $requesterId, 'requested', $pickProducts);

            $restock2 = $this->createRestock($outlet->id, $requesterId, 'preparing', $pickProducts, $owner->id);
            $this->createDistribution($restock2->id, $outlet->id, 'preparing', $pickProducts);

            $restock3 = $this->createRestock($outlet->id, $requesterId, 'shipped', $pickProducts, $owner->id);
            $this->createDistribution($restock3->id, $outlet->id, 'shipped', $pickProducts);

            $restock4 = $this->createRestock($outlet->id, $requesterId, 'completed', $pickProducts, $owner->id);
            $this->createDistribution($restock4->id, $outlet->id, 'completed', $pickProducts);
        }

        $firstOutlet = $outlets->first();
        $outletUser = User::where('outlet_id', $firstOutlet->id)->where('role', 'outlet')->first();
        $requesterId = $outletUser?->id ?? $owner->id;
        $pickProducts = $products->random(min(3, $products->count()));

        RestockRequest::create([
            'outlet_id' => $firstOutlet->id,
            'requested_by' => $requesterId,
            'status' => 'rejected',
            'notes' => 'Stok menipis, butuh segera',
            'rejected_by' => $owner->id,
            'rejected_at' => now()->subDay(),
            'rejected_reason' => 'Stok pusat juga kosong. Akan dikirim minggu depan.',
        ]);

        $total = RestockRequest::count();
        $this->command->info("PersediaanDemoSeeder: Created {$total} restock requests with varied statuses.");
    }

    private function randomizeStock($outlets, $products): void
    {
        foreach ($outlets as $outlet) {
            foreach ($products as $i => $product) {
                $inventory = OutletInventory::where('outlet_id', $outlet->id)
                    ->where('product_id', $product->id)
                    ->first();

                if (! $inventory) {
                    continue;
                }

                $roll = ($i + $outlet->id) % 5;

                $stock = match ($roll) {
                    0 => rand(0, 2),
                    1 => rand(3, 5),
                    default => rand(8, 30),
                };

                $inventory->update([
                    'current_stock' => $stock,
                    'minimum_stock' => 5,
                ]);

                $product->update([
                    'center_stock' => match (($i + $outlet->id) % 4) {
                        0 => rand(0, 3),
                        1 => rand(4, 10),
                        default => rand(15, 60),
                    },
                ]);
            }
        }
    }

    private function createRestock(
        int $outletId,
        int $requesterId,
        string $status,
        $products,
        ?int $approverId = null
    ): RestockRequest {
        $restock = RestockRequest::create([
            'outlet_id' => $outletId,
            'requested_by' => $requesterId,
            'status' => $status,
            'notes' => $status === 'requested' ? 'Beberapa produk hampir habis' : null,
            'owner_notes' => in_array($status, ['preparing', 'shipped', 'completed']) ? 'Disetujui, segera kirim' : null,
            'approved_by' => $approverId,
            'approved_at' => $approverId ? now()->subHours(rand(1, 48)) : null,
        ]);

        foreach ($products as $product) {
            RestockRequestItem::create([
                'restock_request_id' => $restock->id,
                'product_id' => $product->id,
                'requested_quantity' => rand(5, 20),
                'approved_quantity' => $approverId ? rand(5, 15) : null,
            ]);
        }

        return $restock;
    }

    private function createDistribution(
        int $restockId,
        int $outletId,
        string $status,
        $products,
    ): StockDistribution {
        $sentAt = in_array($status, ['shipped', 'completed']) ? now()->subHours(rand(2, 24)) : null;
        $receivedAt = $status === 'completed' ? now()->subHours(rand(1, 3)) : null;

        $dist = StockDistribution::create([
            'restock_request_id' => $restockId,
            'outlet_id' => $outletId,
            'status' => $status,
            'sent_at' => $sentAt,
            'received_at' => $receivedAt,
            'notes' => $status === 'shipped' ? 'Dalam perjalanan' : ($status === 'completed' ? 'Diterima lengkap' : null),
        ]);

        foreach ($products as $product) {
            StockDistributionItem::create([
                'stock_distribution_id' => $dist->id,
                'product_id' => $product->id,
                'quantity' => rand(5, 15),
            ]);
        }

        return $dist;
    }
}
