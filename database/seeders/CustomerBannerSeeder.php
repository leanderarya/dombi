<?php

namespace Database\Seeders;

use App\Models\CustomerBanner;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Installs the three starter banner designs used in the Owner banner page.
 *
 * This seeder is intentionally NOT registered in DatabaseSeeder: it exists so a
 * fresh environment can be given a starting point on demand. Run it explicitly:
 *
 *     php artisan db:seed --class=CustomerBannerSeeder
 *
 * It is idempotent on `name` (its natural key). A banner that already has a
 * usable image on disk is left completely untouched, so re-running it never
 * overwrites artwork an Owner uploaded. Every seeded banner starts inactive:
 * activating one is an explicit Owner decision made in the UI.
 */
class CustomerBannerSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->definitions() as $index => $definition) {
            $banner = CustomerBanner::firstOrNew(['name' => $definition['name']]);

            if ($banner->exists && $banner->image_path && Storage::disk('public')->exists($banner->image_path)) {
                continue;
            }

            $banner->alt_text = $definition['alt_text'];
            $banner->target_path = $definition['target_path'];
            $banner->sort_order = $index;
            $banner->image_path = $this->copyAsset($definition['asset']);
            $banner->save();
        }
    }

    /**
     * @return list<array{name: string, alt_text: string, target_path: string, asset: string}>
     */
    private function definitions(): array
    {
        return [
            [
                'name' => 'Pilihan Dombi untuk harimu',
                'alt_text' => 'Banner Dombi. Pilihan Dombi untuk harimu. Lihat produk.',
                'target_path' => '/customer/products',
                'asset' => '01-pilihan-dombi.webp',
            ],
            [
                'name' => 'Susu kambing segar dari pusat',
                'alt_text' => 'Banner Dombi. Susu kambing segar, langsung dari peternakan.',
                'target_path' => '/customer/products',
                'asset' => '02-segar-dari-pusat.webp',
            ],
            [
                'name' => 'Ambil sendiri atau kami antar',
                'alt_text' => 'Banner Dombi. Ambil sendiri di outlet atau kirim ke alamatmu.',
                'target_path' => '/customer/products',
                'asset' => '03-ambil-atau-dikirim.webp',
            ],
        ];
    }

    private function copyAsset(string $file): string
    {
        $source = public_path('images/banners/'.$file);

        if (! is_file($source)) {
            throw new RuntimeException("Banner asset missing: {$source}");
        }

        $path = 'banners/'.Str::uuid().'.webp';

        if (! Storage::disk('public')->put($path, (string) file_get_contents($source))) {
            throw new RuntimeException("Failed to copy banner asset to {$path}");
        }

        return $path;
    }
}
