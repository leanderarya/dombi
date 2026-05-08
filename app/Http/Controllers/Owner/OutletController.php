<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\StoreOutletRequest;
use App\Http\Requests\Owner\UpdateOutletRequest;
use App\Models\Outlet;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class OutletController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('owner/outlets/index', [
            'outlets' => Outlet::latest()->paginate(15),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('owner/outlets/create');
    }

    public function store(StoreOutletRequest $request): RedirectResponse
    {
        Outlet::create($request->validated());

        return redirect()->route('owner.outlets.index')->with('success', 'Outlet berhasil dibuat.');
    }

    public function edit(Outlet $outlet): Response
    {
        return Inertia::render('owner/outlets/edit', ['outlet' => $outlet]);
    }

    public function update(UpdateOutletRequest $request, Outlet $outlet): RedirectResponse
    {
        $outlet->update($request->validated());

        return redirect()->route('owner.outlets.index')->with('success', 'Outlet berhasil diperbarui.');
    }

    public function destroy(Outlet $outlet): RedirectResponse
    {
        $outlet->delete();

        return redirect()->route('owner.outlets.index')->with('success', 'Outlet berhasil dihapus.');
    }
}
