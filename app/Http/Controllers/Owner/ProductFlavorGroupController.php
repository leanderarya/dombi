<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\ProductFlavorGroup;
use App\Services\ProductImageService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ProductFlavorGroupController extends Controller
{
    public function updateImage(Request $req, ProductFlavorGroup $flavorGroup, ProductImageService $imgService): RedirectResponse
    {
        $req->validate(['image' => 'required|image|mimes:jpg,jpeg,png,webp|max:4096']);

        $oldPath = $flavorGroup->image;
        $newPath = $imgService->storeForFlavorGroup($req->file('image'), null, $flavorGroup->id);
        $flavorGroup->update(['image' => $newPath]);

        $imgService->deleteIfUnreferenced($oldPath, excludingFlavorGroupId: $flavorGroup->id);

        return back()->with('success', 'Foto rasa diperbarui untuk semua ukuran');
    }
}
