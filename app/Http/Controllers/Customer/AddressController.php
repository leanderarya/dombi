<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\StoreAddressFromLocationRequest;
use App\Http\Requests\Customer\StoreCustomerAddressRequest;
use App\Http\Requests\Customer\UpdateCustomerAddressRequest;
use App\Models\CustomerAddress;
use App\Services\CustomerAddressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class AddressController extends Controller
{
    public function __construct(private readonly CustomerAddressService $addressService) {}

    public function index(): Response
    {
        $user = auth()->user();
        $customer = $user->getCustomerOrCreate();

        $addresses = $customer->addresses()
            ->orderByDesc('is_default')
            ->orderByDesc('updated_at')
            ->get();

        return Inertia::render('customer/addresses/index', [
            'addresses' => $addresses,
        ]);
    }

    public function apiIndex(): JsonResponse
    {
        $user = auth()->user();
        $customer = $user->getCustomerOrCreate();

        $addresses = $customer->addresses()
            ->orderByDesc('is_default')
            ->orderByDesc('updated_at')
            ->get(['id', 'label', 'address_line', 'address_detail', 'village', 'district', 'city', 'province', 'postal_code', 'latitude', 'longitude', 'landmark', 'delivery_notes', 'is_default']);

        return response()->json([
            'addresses' => $addresses,
            'max_addresses' => 5,
            'can_add' => $addresses->count() < 5,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('customer/addresses/create');
    }

    public function store(StoreCustomerAddressRequest $request): RedirectResponse
    {
        $user = auth()->user();
        $customer = $user->getCustomerOrCreate();

        $this->addressService->create($customer, $request->validated());

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

    /**
     * Save checkout location as a new saved address.
     */
    public function storeFromCheckout(StoreAddressFromLocationRequest $request): JsonResponse
    {
        $user = auth()->user();
        $customer = $user->getCustomerOrCreate();

        try {
            $address = $this->addressService->storeFromLocation(
                $customer,
                $request->validated(),
                $request->input('label'),
            );

            return response()->json(['address' => $address, 'success' => true]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    private function authorizeAddress(CustomerAddress $address): void
    {
        $user = auth()->user();

        if (! $user->isOwner() && $user->getCustomerOrCreate()->id !== $address->customer_id) {
            abort(403, 'Anda tidak memiliki akses ke alamat ini.');
        }
    }
}
