<?php

namespace App\Services;

use Illuminate\Http\Request;

/**
 * Handles OTP verification for delivery checkout.
 *
 * In development, OTP is logged. In production, integrate with SMS/WhatsApp gateway.
 */
class CheckoutOtpService
{
    public const OTP_LENGTH = 6;

    public const OTP_TTL_SECONDS = 300; // 5 minutes

    public const SESSION_KEY_OTP = 'checkout.otp_code';

    public const SESSION_KEY_OTP_EXPIRES = 'checkout.otp_expires_at';

    public const SESSION_KEY_OTP_PHONE = 'checkout.otp_phone';

    public const SESSION_KEY_OTP_VERIFIED = 'checkout.otp_verified';

    public const SESSION_KEY_OTP_ATTEMPTS = 'checkout.otp_attempts';

    public const MAX_ATTEMPTS = 5;

    /**
     * Generate and store an OTP for the given phone number.
     */
    public function sendOtp(Request $request, string $phone): string
    {
        $code = str_pad((string) random_int(0, 10 ** self::OTP_LENGTH - 1), self::OTP_LENGTH, '0', STR_PAD_LEFT);

        $request->session()->put(self::SESSION_KEY_OTP, $code);
        $request->session()->put(self::SESSION_KEY_OTP_EXPIRES, now()->addSeconds(self::OTP_TTL_SECONDS)->toISOString());
        $request->session()->put(self::SESSION_KEY_OTP_PHONE, $phone);
        $request->session()->put(self::SESSION_KEY_OTP_ATTEMPTS, 0);
        $request->session()->forget(self::SESSION_KEY_OTP_VERIFIED);

        // Log OTP for development — replace with SMS gateway in production
        logger()->info('Checkout OTP generated', [
            'phone' => $phone,
            'code' => $code,
            'expires_at' => $request->session()->get(self::SESSION_KEY_OTP_EXPIRES),
        ]);

        return $code;
    }

    /**
     * Verify the OTP code. Returns true if valid, false otherwise.
     */
    public function verify(Request $request, string $code, string $phone): bool
    {
        $storedCode = $request->session()->get(self::SESSION_KEY_OTP);
        $expiresAt = $request->session()->get(self::SESSION_KEY_OTP_EXPIRES);
        $storedPhone = $request->session()->get(self::SESSION_KEY_OTP_PHONE);
        $attempts = (int) $request->session()->get(self::SESSION_KEY_OTP_ATTEMPTS, 0);

        if ($attempts >= self::MAX_ATTEMPTS) {
            return false;
        }

        $request->session()->put(self::SESSION_KEY_OTP_ATTEMPTS, $attempts + 1);

        if (! $storedCode || ! $expiresAt || ! $storedPhone) {
            return false;
        }

        if (now()->isAfter($expiresAt)) {
            return false;
        }

        if ($storedPhone !== $phone) {
            return false;
        }

        if (! hash_equals($storedCode, $code)) {
            return false;
        }

        // Mark as verified
        $request->session()->put(self::SESSION_KEY_OTP_VERIFIED, true);
        $request->session()->forget([
            self::SESSION_KEY_OTP,
            self::SESSION_KEY_OTP_EXPIRES,
            self::SESSION_KEY_OTP_ATTEMPTS,
        ]);

        return true;
    }

    /**
     * Check if the current session has verified OTP for the given phone.
     */
    public function isVerified(Request $request, string $phone): bool
    {
        return $request->session()->get(self::SESSION_KEY_OTP_VERIFIED) === true
            && $request->session()->get(self::SESSION_KEY_OTP_PHONE) === $phone;
    }

    /**
     * Clear OTP verification state.
     */
    public function clear(Request $request): void
    {
        $request->session()->forget([
            self::SESSION_KEY_OTP,
            self::SESSION_KEY_OTP_EXPIRES,
            self::SESSION_KEY_OTP_PHONE,
            self::SESSION_KEY_OTP_VERIFIED,
            self::SESSION_KEY_OTP_ATTEMPTS,
        ]);
    }

    /**
     * Get remaining seconds until OTP expires.
     */
    public function getRemainingSeconds(Request $request): int
    {
        $expiresAt = $request->session()->get(self::SESSION_KEY_OTP_EXPIRES);

        if (! $expiresAt) {
            return 0;
        }

        return max(0, now()->diffInSeconds($expiresAt, false));
    }
}
