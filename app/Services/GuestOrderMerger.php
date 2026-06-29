<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\User;

class GuestOrderMerger
{
    /**
     * Merge guest customer orders into the authenticated user's account.
     *
     * Finds all Customer records with the same phone but no user_id,
     * and links them to the given user.
     */
    public function merge(User $user): int
    {
        $phone = $user->phone ?? $user->customer?->phone;

        if (! $phone) {
            return 0;
        }

        $guestCustomers = Customer::query()
            ->where('phone', $phone)
            ->whereNull('user_id')
            ->get();

        $merged = 0;

        foreach ($guestCustomers as $guestCustomer) {
            // Skip if already linked to another user
            if ($guestCustomer->user_id && $guestCustomer->user_id !== $user->id) {
                continue;
            }

            $guestCustomer->linkToUser($user);
            $merged++;
        }

        return $merged;
    }
}
