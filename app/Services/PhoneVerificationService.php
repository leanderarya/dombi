<?php

namespace App\Services;

use Illuminate\Http\Request;

/**
 * Standalone phone verification service for Google Sign-In flow.
 * Used for account-level phone verification (not checkout).
 */
class PhoneVerificationService
{
    public const OTP_LENGTH = 6;

    public const OTP_TTL_SECONDS = 300; // 5 minutes

    public const SESSION_KEY_CODE = 'phone_verification.code';

    public const SESSION_KEY_EXPIRES = 'phone_verification.expires_at';

    public const SESSION_KEY_PHONE = 'phone_verification.phone';

    public const SESSION_KEY_VERIFIED = 'phone_verification.verified';

    public const SESSION_KEY_ATTEMPTS = 'phone_verification.attempts';

    public const MAX_ATTEMPTS = 5;

    /**
     * Generate and send an OTP for the given phone number.
     */
    public function sendOtp(Request $request, string $phone): string
    {
        $code = str_pad((string) random_int(0, 10 ** self::OTP_LENGTH - 1), self::OTP_LENGTH, '0', STR_PAD_LEFT);

        $request->session()->put(self::SESSION_KEY_CODE, $code);
        $request->session()->put(self::SESSION_KEY_EXPIRES, now()->addSeconds(self::OTP_TTL_SECONDS)->toISOString());
        $request->session()->put(self::SESSION_KEY_PHONE, $phone);
        $request->session()->put(self::SESSION_KEY_ATTEMPTS, 0);
        $request->session()->forget(self::SESSION_KEY_VERIFIED);

        $message = "Kode verifikasi Dombi Anda: {$code}\n\nBerlaku selama ".(self::OTP_TTL_SECONDS / 60)." menit. Jangan bagikan kode ini ke siapa pun.";

        $sent = app(GowaService::class)->sendText($phone, $message);

        if (! $sent && app()->isLocal()) {
            logger()->info('Phone verification OTP generated (GOWA unavailable)', [
                'phone' => $phone,
                'code' => $code,
            ]);
        }

        return $code;
    }

    /**
     * Verify the OTP code. Returns true if valid.
     */
    public function verify(Request $request, string $code, string $phone): bool
    {
        $storedCode = $request->session()->get(self::SESSION_KEY_CODE);
        $expiresAt = $request->session()->get(self::SESSION_KEY_EXPIRES);
        $storedPhone = $request->session()->get(self::SESSION_KEY_PHONE);
        $attempts = (int) $request->session()->get(self::SESSION_KEY_ATTEMPTS, 0);

        if ($attempts >= self::MAX_ATTEMPTS) {
            return false;
        }

        $request->session()->put(self::SESSION_KEY_ATTEMPTS, $attempts + 1);

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

        $request->session()->put(self::SESSION_KEY_VERIFIED, true);
        $request->session()->forget([
            self::SESSION_KEY_CODE,
            self::SESSION_KEY_EXPIRES,
            self::SESSION_KEY_ATTEMPTS,
        ]);

        return true;
    }

    /**
     * Check if the given phone is verified in the current session.
     */
    public function isVerified(Request $request, string $phone): bool
    {
        return $request->session()->get(self::SESSION_KEY_VERIFIED) === true
            && $request->session()->get(self::SESSION_KEY_PHONE) === $phone;
    }

    /**
     * Clear all verification state.
     */
    public function clear(Request $request): void
    {
        $request->session()->forget([
            self::SESSION_KEY_CODE,
            self::SESSION_KEY_EXPIRES,
            self::SESSION_KEY_PHONE,
            self::SESSION_KEY_VERIFIED,
            self::SESSION_KEY_ATTEMPTS,
        ]);
    }
}
