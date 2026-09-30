<?php

namespace App\Support;

use DateTimeInterface;

/**
 * Query-string date parsing that cannot throw.
 *
 * `$request->date()` looks null-safe but is not: Laravel's docblock declares
 * `@throws \Carbon\Exceptions\InvalidFormatException` and the body has no
 * try/catch, so `?date=notadate` turns any list page into a 500. Every filter
 * query parameter goes through this instead, so one update fixes the class.
 */
final class QueryDate
{
    /**
     * Parse a query-string date, returning null when it is absent, empty, or
     * malformed.
     */
    public static function parse(mixed $value): ?DateTimeInterface
    {
        if (is_object($value) && method_exists($value, 'toDate')) {
            return $value->toDate();
        }

        if (is_object($value)) {
            return null;
        }

        $value = is_scalar($value) ? trim((string) $value) : '';

        if ($value === '') {
            return null;
        }

        try {
            return \Date::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Parse a query-string date, falling back when the value is absent or
     * malformed. `$fallback` may be a raw value or a closure resolved lazily,
     * which keeps a "default to the other end of the range" fallback working.
     */
    public static function parseOr(mixed $value, mixed $fallback = null): ?DateTimeInterface
    {
        $parsed = self::parse($value);

        if ($parsed !== null) {
            return $parsed;
        }

        $fallback = $fallback instanceof \Closure ? $fallback() : $fallback;

        if ($fallback instanceof DateTimeInterface) {
            return $fallback;
        }

        return is_scalar($fallback) ? self::parse($fallback) : null;
    }
}
