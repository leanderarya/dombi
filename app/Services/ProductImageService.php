<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductFlavorGroup;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Format;
use Intervention\Image\ImageManager;

class ProductImageService
{
    public function store(?UploadedFile $file, ?string $oldPath = null): ?string
    {
        if (! $file) {
            return $oldPath;
        }

        if ($oldPath && Storage::disk('public')->exists($oldPath)) {
            Storage::disk('public')->delete($oldPath);
        }

        $manager = new ImageManager(new Driver);

        $image = method_exists($manager, 'read')
            ? $manager->read($file->getPathname())
            : $manager->decodePath($file->getPathname());

        $image->cover(800, 800);

        $filename = 'products/'.uniqid().'.webp';

        $encoded = method_exists($image, 'toWebp')
            ? $image->toWebp(80)
            : $image->encodeUsingFormat(Format::WEBP, quality: 80);

        Storage::disk('public')->put($filename, $encoded->toString());

        return $filename;
    }

    public function delete(?string $path): void
    {
        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }

    public function storeForFlavorGroup(?UploadedFile $file, ?string $oldPath = null, ?int $groupId = null): ?string
    {
        if (! $file) {
            return $oldPath;
        }

        $manager = new ImageManager(new Driver);

        $image = method_exists($manager, 'read')
            ? $manager->read($file->getPathname())
            : $manager->decodePath($file->getPathname());

        $image->cover(800, 800);

        $filename = 'products/flavor-'.uniqid().'.webp';

        $encoded = method_exists($image, 'toWebp')
            ? $image->toWebp(80)
            : $image->encodeUsingFormat(Format::WEBP, quality: 80);

        Storage::disk('public')->put($filename, $encoded->toString());

        // NOTE: deletion of old path happens via deleteIfUnreferenced()
        // after the caller has successfully updated the DB record.

        return $filename;
    }

    /**
     * Delete file from disk only if no Product or FlavorGroup still references it.
     *
     * Safe for shared images: if another record uses the same path, the file stays.
     */
    public function deleteIfUnreferenced(
        ?string $path,
        ?int $excludingProductId = null,
        ?int $excludingFlavorGroupId = null
    ): void {
        if (! $path || ! Storage::disk('public')->exists($path)) {
            return;
        }

        $productRefs = Product::where('image', $path)
            ->when($excludingProductId, fn ($q) => $q->where('id', '!=', $excludingProductId))
            ->exists();

        $groupRefs = ProductFlavorGroup::where('image', $path)
            ->when($excludingFlavorGroupId, fn ($q) => $q->where('id', '!=', $excludingFlavorGroupId))
            ->exists();

        if (! $productRefs && ! $groupRefs) {
            Storage::disk('public')->delete($path);
        }
    }
}
