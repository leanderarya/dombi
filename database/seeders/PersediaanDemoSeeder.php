<?php

namespace Database\Seeders;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\ProductVariant;
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
        $variants = ProductVariant::where('is_active', true)->get();

        if ($outlets->isEmpty() || $variants->isEmpty()) {
            $this->command->warn('PersediaanDemoSeeder: No outlets or variants — run OutletSeeder + ProductCatalogSeeder first.');

            return;
        }

        // ── 1. Varied outlet stock levels ──
        $this->randomizeStock($outlets, $variants);

        // ── 2. Restock requests per outlet ──
        foreach ($outlets as $outlet) {
            $outletUser = User::where('outlet_id', $outlet->id)->where('role', 'outlet')->first();

            $requesterId = $outletUser?->id ?? $owner->id;
            $pickVariants = $variants->random(min(4, $variants->count()));

            // A. Requested (butuh approve)
            $this->createRestock($outlet->id, $requesterId, 'requested', $pickVariants);

            // B. Preparing + distribution linked
            $restock2 = $this->createRestock($outlet->id, $requesterId, 'preparing', $pickVariants, $owner->id);
            $this->createDistribution($restock2->id, $outlet->id, 'preparing', $pickVariants);

            // C. Shipped
            $restock3 = $this->createRestock($outlet->id, $requesterId, 'shipped', $pickVariants, $owner->id);
            $this->createDistribution($restock3->id, $outlet->id, 'shipped', $pickVariants);

            // D. Completed
            $restock4 = $this->createRestock($outlet->id, $requesterId, 'completed', $pickVariants, $owner->id);
            $this->createDistribution($restock4->id, $outlet->id, 'completed', $pickVariants);
        }

        // ── 3. One rejected restock ──
        $firstOutlet = $outlets->first();
        $outletUser = User::where('outlet_id', $firstOutlet->id)->where('role', 'outlet')->first();
        $requesterId = $outletUser?->id ?? $owner->id;
        $pickVariants = $variants->random(min(3, $variants->count()));

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

    private function randomizeStock($outlets, $variants): void
    {
        foreach ($outlets as $outlet) {
            foreach ($variants as $i => $variant) {
                $inventory = OutletInventory::where('outlet_id', $outlet->id)
                    ->where('product_variant_id', $variant->id)
                    ->first();

                if (! $inventory) {
                    continue;
                }

                // Mix: some critical (0-2), some low (3-5), mostly healthy (8-30)
                $roll = ($i + $outlet->id) % 5;

                $stock = match ($roll) {
                    0 => rand(0, 2),       // critical
                    1 => rand(3, 5),       // low
                    default => rand(8, 30), // healthy
                };

                $inventory->update([
                    'current_stock' => $stock,
                    'minimum_stock' => 5,
                ]);

                // Also vary center stock for central tab
                $variant->update([
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
        $variants,
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

        foreach ($variants as $variant) {
            RestockRequestItem::create([
                'restock_request_id' => $restock->id,
                'product_id' => null,
                'product_variant_id' => $variant->id,
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
        $variants,
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

        foreach ($variants as $variant) {
            StockDistributionItem::create([
                'stock_distribution_id' => $dist->id,
                'product_id' => null,
                'product_variant_id' => $variant->id,
                'quantity' => rand(5, 15),
            ]);
        }

        return $dist;
    }
}
