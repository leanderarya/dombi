<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\User;
use App\Services\CheckoutOtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class AccountPromotionController extends Controller
{
    /**
     * Send OTP for phone verification.
     */
    public function sendOtp(Request $request, CheckoutOtpService $otpService): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'regex:/^62[0-9]{9,13}$/'],
        ]);

        $result = $otpService->sendOtp($validated['phone']);

        if ($result['success']) {
            return response()->json([
                'success' => true,
                'message' => 'Kode OTP telah dikirim.',
            ]);
        }

        return response()->json([
            'success' => false,
            'error' => $result['message'] ?? 'Gagal mengirim OTP.',
        ], 422);
    }

    /**
     * Verify OTP code.
     */
    public function verify(Request $request, CheckoutOtpService $otpService): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string'],
            'code' => ['required', 'string', 'size:6'],
        ]);

        $result = $otpService->verifyOtp($validated['phone'], $validated['code']);

        if ($result) {
            session(['otp_verified_phone' => $validated['phone']]);
            return response()->json(['verified' => true]);
        }

        return response()->json([
            'verified' => false,
            'error' => 'Kode OTP tidak valid.',
        ], 422);
    }

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

        $verifiedPhone = session('otp_verified_phone');
        if (! $verifiedPhone || $verifiedPhone !== $validated['phone']) {
            return response()->json([
                'success' => false,
                'error' => 'Silakan verifikasi nomor HP terlebih dahulu.',
            ], 422);
        }

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
