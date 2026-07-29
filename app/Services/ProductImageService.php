<?php

namespace App\Services;

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

        if ($oldPath && Storage::disk('public')->exists($oldPath)) {
            $otherCount = ProductFlavorGroup::where('image', $oldPath)->where('id', '!=', $groupId)->count();
            if ($otherCount === 0) {
                Storage::disk('public')->delete($oldPath);
            }
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

        return $filename;
    }
}
