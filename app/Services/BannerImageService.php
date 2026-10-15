<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Format;
use Intervention\Image\ImageManager;
use RuntimeException;

class BannerImageService
{
    public function store(UploadedFile $file): string
    {
        $image = (new ImageManager(new Driver))->decodePath($file->getPathname());
        $image->scaleDown(width: 1200);
        $encoded = $image->encodeUsingFormat(Format::WEBP, quality: 80);
        $path = 'banners/'.Str::uuid().'.webp';

        if (! Storage::disk('public')->put($path, $encoded->toString())) {
            throw new RuntimeException('Failed to store banner image.');
        }

        return $path;
    }

    public function delete(string $path): void
    {
        if (! Storage::disk('public')->delete($path)) {
            throw new RuntimeException('Failed to delete banner image.');
        }
    }
}
