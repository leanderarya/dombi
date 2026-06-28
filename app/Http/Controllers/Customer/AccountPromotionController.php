<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class AccountPromotionController extends Controller
{
    /**
     * Register an account for an OTP-verified guest customer.
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'regex:/^62[0-9]{9,13}$/'],
            'name' => ['required', 'string', 'min:3', 'max:255'],
            'password' => ['required', 'string', Password::min(8), 'confirmed'],
        ]);

        $existingUser = User::where('phone', $validated['phone'])->first();
        if ($existingUser) {
            return response()->json([
                'success' => false,
                'error' => 'Nomor HP sudah terdaftar. Silakan login.',
            ], 422);
        }

        $customer = Customer::where('phone', $validated['phone'])
            ->where('is_registered', false)
            ->first();

        if (! $customer) {
            return response()->json([
                'success' => false,
                'error' => 'Customer tidak ditemukan atau sudah terdaftar.',
            ], 422);
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['phone'].'@dombi.guest',
            'phone' => $validated['phone'],
            'password' => Hash::make($validated['password']),
            'role' => 'customer',
            'is_active' => true,
        ]);

        $customer->linkToUser($user);

        auth()->login($user);

        return response()->json([
            'success' => true,
            'redirect' => route('customer.orders.index'),
        ]);
    }
}
