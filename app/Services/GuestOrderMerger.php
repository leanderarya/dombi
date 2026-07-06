<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Notification;
use App\Models\OrderReport;
use App\Models\User;
use App\Support\PhoneNormalizer;
use Illuminate\Support\Facades\DB;

class GuestOrderMerger
{
    /**
     * Merge guest customer orders into the authenticated user's account.
     *
     * Finds all Customer records with the same phone but no user_id,
     * and reassigns their data to the user's registered Customer.
     *
     * Wrapped in a transaction with row-level locking to prevent
     * race conditions from concurrent requests.
     */
    public function merge(User $user): int
    {
        $rawPhone = $user->phone ?? $user->customer?->phone;

        if (! $rawPhone) {
            return 0;
        }

        $phone = PhoneNormalizer::normalize($rawPhone);

        if ($phone === '') {
            return 0;
        }

        return DB::transaction(function () use ($user, $phone) {
            $registeredCustomer = $user->customer;

            // Lock the guest customer row to prevent concurrent merge
            $guestCustomers = Customer::query()
                ->where('phone', $phone)
                ->whereNull('user_id')
                ->lockForUpdate()
                ->get();

            $merged = 0;

            foreach ($guestCustomers as $guestCustomer) {
                // If user already has a registered Customer, reassign all data instead of linking
                // (unique constraint on user_id prevents two customers from sharing the same user_id)
                if ($registeredCustomer) {
                    $guestCustomer->orders()->update(['customer_id' => $registeredCustomer->id]);
                    $guestCustomer->addresses()->update(['customer_id' => $registeredCustomer->id]);
                    $guestCustomer->recipients()->update(['customer_id' => $registeredCustomer->id]);
                    $guestCustomer->favorites()->update(['customer_id' => $registeredCustomer->id]);
                    Notification::where('customer_id', $guestCustomer->id)->update(['customer_id' => $registeredCustomer->id]);
                    OrderReport::where('customer_id', $guestCustomer->id)->update(['customer_id' => $registeredCustomer->id]);
                    $guestCustomer->delete();
                } else {
                    $guestCustomer->linkToUser($user);
                    $registeredCustomer = $guestCustomer;
                }

                $merged++;
            }

            return $merged;
        });
    }
}
