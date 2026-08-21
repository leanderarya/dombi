<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Format;
use Intervention\Image\ImageManager;

class CourierNominationImageService
{
    private const MAX_SIZE = 5 * 1024 * 1024;

    public function store(?UploadedFile $file, string $kind): ?string
    {
        if (! $file) {
            return null;
        }

        $manager = new ImageManager(new Driver);

        $image = method_exists($manager, 'read')
            ? $manager->read($file->getPathname())
            : $manager->decodePath($file->getPathname());

        $image->cover(800, 800);

        $filename = 'couriers/'.($kind === 'face' ? 'faces' : 'vehicles').'/'.uniqid().'.webp';

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

    public function validate(?UploadedFile $file): bool
    {
        if (! $file) {
            return false;
        }

        return $file->isValid()
            && $file->getSize() <= self::MAX_SIZE
            && in_array($file->getMimeType(), ['image/jpeg', 'image/png', 'image/webp'], true);
    }
}
