<?php

namespace App\Support;

/**
 * Shared Indonesian phone number normalizer.
 *
 * Accepts any common format and normalizes to 62-prefixed digits:
 *   08123456789   → 628123456789
 *   628123456789  → 628123456789
 *   +628123456789 → 628123456789
 *   8123456789    → 628123456789
 */
final class PhoneNormalizer
{
    /**
     * Normalize an Indonesian phone number to 62-prefixed format.
     */
    public static function normalize(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        if ($digits === '') {
            return '';
        }

        // Already starts with 62
        if (str_starts_with($digits, '62')) {
            return $digits;
        }

        // Starts with 0 → replace leading 0 with 62
        if (str_starts_with($digits, '0')) {
            return '62'.substr($digits, 1);
        }

        // Starts with 8 (without leading 0) → prepend 62
        if (str_starts_with($digits, '8')) {
            return '62'.$digits;
        }

        return $digits;
    }

    /**
     * Check if a normalized phone number matches the expected Indonesian format.
     */
    public static function isValidIndonesian(string $phone): bool
    {
        return (bool) preg_match('/^62[0-9]{9,13}$/', $phone);
    }
}
