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
            'addresses' => CustomerAddress::where('user_id', auth()->id())
                ->orderByDesc('is_default')
                ->latest()
                ->get(),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('customer/addresses/create');
    }

    public function store(StoreCustomerAddressRequest $request): RedirectResponse
    {
        $this->addressService->create($request->user(), $request->validated());

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

        $this->addressService->update($address, $request->validated());

        return redirect()->route('customer.addresses.index')->with('success', 'Alamat berhasil diperbarui.');
    }

    public function destroy(CustomerAddress $address): RedirectResponse
    {
        abort_unless($address->user_id === auth()->id(), 403);

        $this->addressService->delete($address);

        return redirect()->route('customer.addresses.index')->with('success', 'Alamat berhasil dihapus.');
    }

    public function setDefault(CustomerAddress $address): RedirectResponse
    {
        abort_unless($address->user_id === auth()->id(), 403);

        $this->addressService->setDefault($address);

        return redirect()->route('customer.addresses.index')->with('success', 'Alamat default diperbarui.');
    }
}
