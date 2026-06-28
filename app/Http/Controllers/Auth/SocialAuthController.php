<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\User;
use App\Services\PhoneVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Socialite\Facades\Socialite;

class SocialAuthController extends Controller
{
    /**
     * Redirect to Google OAuth consent screen.
     */
    public function redirect(): RedirectResponse
    {
        return Socialite::driver('google')
            ->scopes(['openid', 'email', 'profile'])
            ->redirect();
    }

    /**
     * Handle Google OAuth callback.
     */
    public function callback(Request $request): RedirectResponse
    {
        try {
            $googleUser = Socialite::driver('google')->stateless()->user();
        } catch (\Exception $e) {
            logger()->warning('Google OAuth callback failed', ['error' => $e->getMessage()]);

            return redirect()->route('customer.home')
                ->with('error', 'Login Google gagal. Coba lagi.');
        }

        $email = $googleUser->getEmail();
        $googleId = $googleUser->getId();
        $name = $googleUser->getName() ?? $email;
        $avatar = $googleUser->getAvatar();

        // 1. Find existing user by Google provider
        $user = User::where('provider', 'google')
            ->where('provider_id', $googleId)
            ->first();

        // 2. Find existing user by email
        if (! $user) {
            $user = User::where('email', $email)->first();

            if ($user) {
                // Existing user with this email but not Google-linked
                // If they have a password (registered via AccountPromotion), reject
                // to prevent account takeover. They should login with password.
                if (! $user->hasGoogleAccount() && $user->password !== null) {
                    return redirect()->route('customer.home')
                        ->with('error', 'Akun dengan email ini sudah ada. Silakan login dengan password.');
                }

                // Link Google to existing user (e.g., was created with random password)
                $user->forceFill([
                    'provider' => 'google',
                    'provider_id' => $googleId,
                    'avatar' => $avatar,
                    'email_verified_at' => now(),
                ])->save();
            }
        }

        // 3. Create new user if not found
        if (! $user) {
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => bcrypt(Str::random(64)), // Unusable random password
                'role' => 'customer',
                'is_active' => true,
                'provider' => 'google',
                'provider_id' => $googleId,
                'avatar' => $avatar,
                'email_verified_at' => now(),
            ]);
        }

        // 4. Login (remember for customer — long-lived session)
        auth()->login($user, remember: true);

        // 5. Guarantee Customer record exists (idempotent; phone nullable)
        Customer::firstOrCreate(
            ['user_id' => $user->id],
            ['name' => $user->name, 'email' => $user->email, 'is_registered' => true],
        );

        // 6. Set session timestamps for session policy
        $request->session()->put('login_at', now()->timestamp);
        $request->session()->put('last_activity_at', now()->timestamp);

        // 6. Clear guest mode
        $request->session()->forget('guest_mode');

        // 7. Redirect to intended destination or home (phone is optional)
        $redirectUrl = $request->session()->pull('redirect_after_login', route('customer.home'));

        return redirect($redirectUrl)->with('success', 'Berhasil login.');
    }

    /**
     * Show phone verification page for post-Google-login.
     */
    public function showVerifyPhone(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

        if (! $user || ! $user->isCustomer()) {
            return redirect()->route('customer.home');
        }

        // If already has Customer with phone, redirect home
        if ($user->customer && $user->customer->phone) {
            return redirect()->route('customer.home');
        }

        return Inertia::render('customer/verify-phone', [
            'user' => [
                'name' => $user->name,
                'email' => $user->email,
                'avatar' => $user->avatar,
            ],
            'otpLength' => PhoneVerificationService::OTP_LENGTH,
            'ttlSeconds' => PhoneVerificationService::OTP_TTL_SECONDS,
        ]);
    }

    /**
     * Send OTP for phone verification.
     */
    public function sendPhoneOtp(Request $request, PhoneVerificationService $otpService): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'regex:/^62[0-9]{9,13}$/'],
        ]);

        $otpService->sendOtp($request, $validated['phone']);

        return response()->json(['sent' => true]);
    }

    /**
     * Verify OTP and link Customer.
     */
    public function verifyPhone(Request $request, PhoneVerificationService $otpService): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'regex:/^62[0-9]{9,13}$/'],
            'code' => ['required', 'string', 'size:6'],
        ]);

        $phone = $validated['phone'];
        $code = $validated['code'];

        if (! $otpService->verify($request, $code, $phone)) {
            return response()->json([
                'verified' => false,
                'error' => 'Kode OTP tidak valid atau sudah kadaluarsa.',
            ], 422);
        }

        // OTP verified — now link Customer
        $user = $request->user();

        if (! $user) {
            return response()->json(['verified' => false, 'error' => 'Sesi tidak ditemukan.'], 401);
        }

        $result = DB::transaction(function () use ($user, $phone) {
            // Check if Customer exists with this phone
            $customer = Customer::where('phone', $phone)->first();

            if ($customer) {
                // Scenario B: Unlinked guest customer — link
                if (! $customer->is_registered && $customer->user_id === null) {
                    $customer->linkToUser($user);

                    return [
                        'status' => 'linked',
                        'message' => 'Akun berhasil dihubungkan. Riwayat pesanan Anda tersedia.',
                    ];
                }

                // Scenario C: Already linked to another user — REJECT
                if ($customer->is_registered && $customer->user_id !== null && $customer->user_id !== $user->id) {
                    return [
                        'status' => 'rejected',
                        'message' => 'Nomor HP sudah terdaftar dengan akun lain.',
                    ];
                }

                // Scenario E: Already linked to this user
                if ($customer->user_id === $user->id) {
                    return [
                        'status' => 'already_linked',
                        'message' => 'Akun sudah terhubung.',
                    ];
                }
            }

            // Scenario A: New customer
            $newCustomer = Customer::create([
                'name' => $user->name,
                'phone' => $phone,
                'email' => $user->email,
                'is_registered' => true,
                'user_id' => $user->id,
            ]);

            return [
                'status' => 'created',
                'message' => 'Akun berhasil dibuat.',
            ];
        });

        if ($result['status'] === 'rejected') {
            $otpService->clear($request);

            return response()->json([
                'verified' => false,
                'error' => $result['message'],
            ], 422);
        }

        $otpService->clear($request);

        $redirectUrl = $request->session()->pull('redirect_after_login', route('customer.home'));

        return response()->json([
            'verified' => true,
            'status' => $result['status'],
            'message' => $result['message'],
            'redirect' => $redirectUrl,
        ]);
    }
}
