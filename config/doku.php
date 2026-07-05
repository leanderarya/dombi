<?php

return [
    'client_id' => env('DOKU_CLIENT_ID'),
    'api_key' => env('DOKU_API_KEY'),
    'sandbox' => env('DOKU_IS_SANDBOX', true),
    'base_url' => env('DOKU_IS_SANDBOX', true)
        ? 'https://api-sandbox.doku.com'
        : 'https://api.doku.com',

    // Payment configuration
    'payment_timeout' => env('DOKU_PAYMENT_TIMEOUT', 30), // minutes
    'auto_redirect' => env('DOKU_AUTO_REDIRECT', true),
    'currency' => env('DOKU_CURRENCY', 'IDR'),

    // Allowed payment methods (null = all methods)
    'payment_methods' => env('DOKU_PAYMENT_METHODS', 'QRIS'),
];
