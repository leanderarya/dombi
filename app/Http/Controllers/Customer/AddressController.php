<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\StoreCustomerAddressRequest;
use App\Http\Requests\Customer\UpdateCustomerAddressRequest;
use App\Models\CustomerAddress;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class AddressController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('customer/addresses/index', [
            'addresses' => CustomerAddress::where('user_id', auth()->id())->latest()->get(),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('customer/addresses/create');
    }

    public function store(StoreCustomerAddressRequest $request): RedirectResponse
    {
        $data = $request->validated();

        if ($data['is_default'] ?? false) {
            CustomerAddress::where('user_id', $request->user()->id)->update(['is_default' => false]);
        }

        $request->user()->customerAddresses()->create($data);

        return redirect()->route('customer.addresses.index')->with('success', 'Alamat berhasil dibuat.');
    }

    public function edit(CustomerAddress $address): Response
    {
        abort_unless($address->user_id === auth()->id(), 403);

        return Inertia::render('customer/addresses/edit', ['address' => $address]);
    }

    public function update(UpdateCustomerAddressRequest $request, CustomerAddress $address): RedirectResponse
    {
        abort_unless($address->user_id === $request->user()->id, 403);
        $data = $request->validated();

        if ($data['is_default'] ?? false) {
            CustomerAddress::where('user_id', $request->user()->id)->whereKeyNot($address->id)->update(['is_default' => false]);
        }

        $address->update($data);

        return redirect()->route('customer.addresses.index')->with('success', 'Alamat berhasil diperbarui.');
    }

    public function destroy(CustomerAddress $address): RedirectResponse
    {
        abort_unless($address->user_id === auth()->id(), 403);
        $address->delete();

        return redirect()->route('customer.addresses.index')->with('success', 'Alamat berhasil dihapus.');
    }
}
