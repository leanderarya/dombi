<?php

return [
    'confirmation_timeout_minutes' => env('ORDER_CONFIRMATION_TIMEOUT_MINUTES', 15),

    // Minutes given to customer to retry payment after a failed/expired attempt.
    // Resets confirmation_expires_at so the order doesn't expire immediately.
    'payment_retry_window_minutes' => env('ORDER_PAYMENT_RETRY_WINDOW_MINUTES', 15),

    'max_payment_attempts' => env('ORDER_MAX_PAYMENT_ATTEMPTS', 3),
];
