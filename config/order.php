<?php

$positiveInteger = static fn (mixed $value, int $default): int => filter_var($value, FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1],
]) ?: $default;

return [
    'confirmation_timeout_minutes' => $positiveInteger(env('ORDER_CONFIRMATION_TIMEOUT_MINUTES', 30), 30),

    // Minutes given to customer to retry payment after a failed/expired attempt.
    // Resets confirmation_expires_at so the order doesn't expire immediately.
    'payment_retry_window_minutes' => $positiveInteger(env('ORDER_PAYMENT_RETRY_WINDOW_MINUTES', 15), 15),

    'doku_reconciliation_deadline_hours' => $positiveInteger(env(
        'DOKU_RECONCILIATION_DEADLINE_HOURS',
        24,
    ), 24),

    'max_payment_attempts' => env('ORDER_MAX_PAYMENT_ATTEMPTS', 3),
];
