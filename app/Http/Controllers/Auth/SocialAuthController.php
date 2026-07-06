<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Notification;
use App\Models\OrderReport;
use App\Models\User;
use App\Services\GuestOrderMerger;
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
    public function redirect(Request $request): RedirectResponse
    {
        if ($redirect = $request->query('redirect')) {
            // Only allow relative paths to prevent open redirect attacks
            if (str_starts_with($redirect, '/') && ! str_starts_with($redirect, '//')) {
                $request->session()->put('redirect_after_login', $redirect);
            }
        }

        return Socialite::driver('google')
            ->scopes(['openid', 'email', 'profile'])
            ->redirect();
    }

    /**
     * Handle Google OAuth callback.
     */
    public function callback(Request $request): RedirectResponse
    {
        $fallbackUrl = $request->session()->get('redirect_after_login', route('customer.home'));

        try {
            $googleUser = Socialite::driver('google')->stateless()->user();
        } catch (\Exception $e) {
            logger()->warning('Google OAuth callback failed', ['error' => $e->getMessage()]);

            return redirect($fallbackUrl)
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
                    return redirect($fallbackUrl)
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
        ]);
    }

    /**
     * Verify phone and link Customer (direct, no OTP).
     */
    public function verifyPhone(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'regex:/^62[0-9]{9,13}$/'],
        ]);

        $phone = $validated['phone'];
        $user = $request->user();

        if (! $user) {
            return response()->json(['error' => 'Sesi tidak ditemukan.'], 401);
        }

        $result = DB::transaction(function () use ($user, $phone) {
            // Reject if phone already linked to another registered user
            $existing = Customer::where('phone', $phone)
                ->where('is_registered', true)
                ->where('user_id', '!=', $user->id)
                ->whereNotNull('user_id')
                ->lockForUpdate()
                ->first();

            if ($existing) {
                return ['status' => 'rejected', 'message' => 'Nomor HP sudah terdaftar dengan akun lain.'];
            }

            // Link unlinked guest customer
            $guestCustomer = Customer::where('phone', $phone)
                ->whereNull('user_id')
                ->lockForUpdate()
                ->first();

            if ($guestCustomer) {
                $registeredCustomer = $user->customer;

                if ($registeredCustomer) {
                    // Reassign guest data to registered customer
                    $guestCustomer->orders()->update(['customer_id' => $registeredCustomer->id]);
                    $guestCustomer->addresses()->update(['customer_id' => $registeredCustomer->id]);
                    $guestCustomer->recipients()->update(['customer_id' => $registeredCustomer->id]);
                    $guestCustomer->favorites()->update(['customer_id' => $registeredCustomer->id]);
                    Notification::where('customer_id', $guestCustomer->id)->update(['customer_id' => $registeredCustomer->id]);
                    OrderReport::where('customer_id', $guestCustomer->id)->update(['customer_id' => $registeredCustomer->id]);
                    $guestCustomer->delete();
                } else {
                    $guestCustomer->linkToUser($user);
                }

                return ['status' => 'linked', 'message' => 'Akun berhasil dihubungkan. Riwayat pesanan Anda tersedia.'];
            }

            // Update or create registered customer with phone
            $registeredCustomer = $user->customer;

            if ($registeredCustomer && ! $registeredCustomer->phone) {
                $registeredCustomer->update(['phone' => $phone]);
            } elseif (! $registeredCustomer) {
                Customer::create([
                    'name' => $user->name,
                    'phone' => $phone,
                    'email' => $user->email,
                    'is_registered' => true,
                    'user_id' => $user->id,
                ]);
            }

            app(GuestOrderMerger::class)->merge($user);

            return ['status' => 'created', 'message' => 'Nomor HP berhasil dihubungkan.'];
        });

        if ($result['status'] === 'rejected') {
            return response()->json(['error' => $result['message']], 422);
        }

        $redirectUrl = $request->session()->pull('redirect_after_login', route('customer.home'));

        return response()->json([
            'verified' => true,
            'status' => $result['status'],
            'message' => $result['message'],
            'redirect' => $redirectUrl,
        ]);
    }
}
