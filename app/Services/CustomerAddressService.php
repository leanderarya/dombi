<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerAddress;
use Illuminate\Support\Facades\DB;

class CustomerAddressService
{
    public function create(Customer $customer, array $data): CustomerAddress
    {
        return DB::transaction(function () use ($customer, $data): CustomerAddress {
            $hasExisting = $customer->addresses()->exists();

            // First address is always default
            if (! $hasExisting) {
                $data['is_default'] = true;
            }

            // Max 5 addresses per customer
            $currentCount = $customer->addresses()->count();

            if ($currentCount >= 5) {
                throw new \InvalidArgumentException('Maksimal 5 alamat tersimpan. Hapus alamat lama untuk menambah baru.');
            }

            // If setting as default, unset others
            if ($data['is_default'] ?? false) {
                $customer->addresses()->update(['is_default' => false]);
            }

            return $customer->addresses()->create($data);
        });
    }

    public function update(CustomerAddress $address, array $data): CustomerAddress
    {
        return DB::transaction(function () use ($address, $data): CustomerAddress {
            if ($data['is_default'] ?? false) {
                CustomerAddress::where('customer_id', $address->customer_id)
                    ->whereKeyNot($address->id)
                    ->update(['is_default' => false]);
            }

            $address->update($data);

            return $address->fresh();
        });
    }

    public function delete(CustomerAddress $address): void
    {
        DB::transaction(function () use ($address): void {
            $wasDefault = $address->is_default;
            $customerId = $address->customer_id;

            $address->delete();

            // If deleted address was default, assign another
            if ($wasDefault) {
                $fallback = CustomerAddress::where('customer_id', $customerId)->latest()->first();
                $fallback?->update(['is_default' => true]);
            }
        });
    }

    public function setDefault(CustomerAddress $address): void
    {
        DB::transaction(function () use ($address): void {
            CustomerAddress::where('customer_id', $address->customer_id)->update(['is_default' => false]);
            $address->update(['is_default' => true]);
        });
    }

    /**
     * Create address from checkout location data.
     */
    public function storeFromLocation(Customer $customer, array $location, ?string $label = null): CustomerAddress
    {
        $label = $label ?: $this->inferLabel($location);

        return $this->create($customer, [
            'label' => $label,
            'address_line' => $location['address_line'] ?? '',
            'address_detail' => $location['address_detail'] ?? '',
            'province' => $location['province'] ?? '',
            'city' => $location['city'] ?? '',
            'district' => $location['district'] ?? '',
            'village' => $location['village'] ?? '',
            'postal_code' => $location['postal_code'] ?? '',
            'latitude' => $location['latitude'] ?? 0,
            'longitude' => $location['longitude'] ?? 0,
            'landmark' => $location['landmark'] ?? '',
            'delivery_notes' => $location['delivery_notes'] ?? '',
        ]);
    }

    private function inferLabel(array $location): string
    {
        $village = $location['village'] ?? '';
        $district = $location['district'] ?? '';

        if ($village || $district) {
            return $village && $district ? "$village, $district" : ($village ?: $district);
        }

        return 'Alamat Baru';
    }
}
