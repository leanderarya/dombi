<?php

namespace App\Services;

use App\Models\CustomerAddress;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CustomerAddressService
{
    public function create(User $customer, array $data): CustomerAddress
    {
        return DB::transaction(function () use ($customer, $data): CustomerAddress {
            $hasExisting = $customer->customerAddresses()->exists();

            // First address is always default
            if (! $hasExisting) {
                $data['is_default'] = true;
            }

            // If setting as default, unset others
            if ($data['is_default'] ?? false) {
                $customer->customerAddresses()->update(['is_default' => false]);
            }

            return $customer->customerAddresses()->create($data);
        });
    }

    public function update(CustomerAddress $address, array $data): CustomerAddress
    {
        return DB::transaction(function () use ($address, $data): CustomerAddress {
            if ($data['is_default'] ?? false) {
                CustomerAddress::where('user_id', $address->user_id)
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
            $userId = $address->user_id;

            $address->delete();

            // If deleted address was default, assign another
            if ($wasDefault) {
                $fallback = CustomerAddress::where('user_id', $userId)->latest()->first();
                $fallback?->update(['is_default' => true]);
            }
        });
    }

    public function setDefault(CustomerAddress $address): void
    {
        DB::transaction(function () use ($address): void {
            CustomerAddress::where('user_id', $address->user_id)->update(['is_default' => false]);
            $address->update(['is_default' => true]);
        });
    }
}
