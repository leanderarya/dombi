<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\SaveCustomerBannerRequest;
use App\Models\CustomerBanner;
use App\Services\BannerImageService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class CustomerBannerController extends Controller
{
    private const MAX_BANNERS = 3;

    public function index(): Response
    {
        return Inertia::render('owner/banners/index', [
            'maxBanners' => self::MAX_BANNERS,
            'banners' => CustomerBanner::orderBy('sort_order')->orderBy('id')->get()
                ->map(fn (CustomerBanner $banner) => [
                    'id' => $banner->id,
                    'name' => $banner->name,
                    'alt_text' => $banner->alt_text,
                    'image_url' => Storage::disk('public')->url($banner->image_path),
                    'target_path' => $banner->target_path,
                    'sort_order' => $banner->sort_order,
                    'is_active' => $banner->is_active,
                ]),
        ]);
    }

    public function store(SaveCustomerBannerRequest $request, BannerImageService $images): RedirectResponse
    {
        return $this->save($request, $images);
    }

    public function update(SaveCustomerBannerRequest $request, CustomerBanner $banner, BannerImageService $images): RedirectResponse
    {
        return $this->save($request, $images, $banner);
    }

    public function destroy(CustomerBanner $banner, BannerImageService $images): RedirectResponse
    {
        $path = DB::transaction(function () use ($banner): string {
            $locked = CustomerBanner::whereKey($banner->id)->lockForUpdate()->firstOrFail();
            $path = $locked->image_path;
            $locked->delete();

            return $path;
        });

        $this->cleanup($images, $path);

        return redirect()->route('owner.banners.index')->with('success', 'Banner berhasil dihapus.');
    }

    private function save(SaveCustomerBannerRequest $request, BannerImageService $images, ?CustomerBanner $banner = null): RedirectResponse
    {
        $data = $request->safe()->except('image');
        $data['target_path'] = $data['target_path'] ?? null;
        $newPath = null;

        if ($request->hasFile('image')) {
            try {
                $newPath = $images->store($request->file('image'));
            } catch (Throwable $exception) {
                report($exception);
                throw ValidationException::withMessages(['image' => 'Gambar gagal disimpan. Silakan coba lagi.']);
            }
            $data['image_path'] = $newPath;
        }

        try {
            $oldPath = DB::transaction(function () use ($banner, $data, $newPath): ?string {
                if (! $banner) {
                    if (CustomerBanner::lockForUpdate()->get()->count() >= self::MAX_BANNERS) {
                        throw ValidationException::withMessages([
                            'name' => 'Maksimal '.self::MAX_BANNERS.' banner. Hapus salah satu untuk menambah banner baru.',
                        ]);
                    }
                    CustomerBanner::create($data);

                    return null;
                }

                $locked = CustomerBanner::whereKey($banner->id)->lockForUpdate()->firstOrFail();
                $oldPath = $newPath ? $locked->image_path : null;
                $locked->update($data);

                return $oldPath;
            });
        } catch (Throwable $exception) {
            if ($newPath) {
                $this->cleanup($images, $newPath);
            }
            throw $exception;
        }

        if ($oldPath) {
            $this->cleanup($images, $oldPath);
        }

        return redirect()->route('owner.banners.index')->with('success', 'Banner berhasil disimpan.');
    }

    private function cleanup(BannerImageService $images, string $path): void
    {
        try {
            $images->delete($path);
        } catch (Throwable $exception) {
            Log::warning('Failed to clean up banner image.', ['path' => $path, 'exception' => $exception]);
        }
    }
}
