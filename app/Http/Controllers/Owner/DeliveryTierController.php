<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\StoreDeliveryTierRequest;
use App\Models\DeliveryTier;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class DeliveryTierController extends Controller
{
    public function index(): Response
    {
        $tiers = DeliveryTier::ordered()->get();

        return Inertia::render('owner/delivery-tiers/index', [
            'tiers' => $tiers,
        ]);
    }

    public function store(StoreDeliveryTierRequest $request): RedirectResponse
    {
        DeliveryTier::create($request->validated());

        return redirect()->route('owner.delivery-tiers.index')->with('success', 'Tier ongkir berhasil ditambahkan.');
    }

    public function update(StoreDeliveryTierRequest $request, DeliveryTier $tier): RedirectResponse
    {
        $tier->update($request->validated());

        return redirect()->route('owner.delivery-tiers.index')->with('success', 'Tier ongkir berhasil diperbarui.');
    }

    public function destroy(DeliveryTier $tier): RedirectResponse
    {
        $tier->delete();

        return redirect()->route('owner.delivery-tiers.index')->with('success', 'Tier ongkir berhasil dihapus.');
    }

    public function toggle(DeliveryTier $tier): RedirectResponse
    {
        $tier->update(['is_active' => ! $tier->is_active]);

        return redirect()->route('owner.delivery-tiers.index');
    }
}
