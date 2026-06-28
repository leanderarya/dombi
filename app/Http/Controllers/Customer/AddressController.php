<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\StoreCustomerAddressRequest;
use App\Http\Requests\Customer\UpdateCustomerAddressRequest;
use App\Models\CustomerAddress;
use App\Services\CustomerAddressService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class AddressController extends Controller
{
    public function __construct(private readonly CustomerAddressService $addressService) {}

    public function index(): Response
    {
        return Inertia::render('customer/addresses/index', [
            'addresses' => collect(),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('customer/addresses/create');
    }

    public function store(StoreCustomerAddressRequest $request): RedirectResponse
    {
        return redirect()->route('customer.addresses.index')->with('success', 'Alamat berhasil ditambahkan.');
    }

    public function edit(CustomerAddress $address): Response
    {
        $this->authorizeAddress($address);

        return Inertia::render('customer/addresses/edit', [
            'address' => $address,
        ]);
    }

    public function update(UpdateCustomerAddressRequest $request, CustomerAddress $address): RedirectResponse
    {
        $this->authorizeAddress($address);

        $this->addressService->update($address, $request->validated());

        return redirect()->route('customer.addresses.index')->with('success', 'Alamat berhasil diperbarui.');
    }

    public function destroy(CustomerAddress $address): RedirectResponse
    {
        $this->authorizeAddress($address);

        $this->addressService->delete($address);

        return redirect()->route('customer.addresses.index')->with('success', 'Alamat berhasil dihapus.');
    }

    public function setDefault(CustomerAddress $address): RedirectResponse
    {
        $this->authorizeAddress($address);

        $this->addressService->setDefault($address);

        return redirect()->route('customer.addresses.index')->with('success', 'Alamat utama berhasil diperbarui.');
    }

    private function authorizeAddress(CustomerAddress $address): void
    {
        $user = auth()->user();

        if (! $user->isOwner() && $user->getCustomerOrCreate()->id !== $address->customer_id) {
            abort(403, 'Anda tidak memiliki akses ke alamat ini.');
        }
    }
}
