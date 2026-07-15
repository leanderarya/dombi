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

    // Allowed payment methods (null = all methods) - deprecated, use methods/enabled_methods
    'payment_methods' => env('DOKU_PAYMENT_METHODS', 'QRIS'),
    'callback_url' => env('DOKU_CALLBACK_URL'),

    // Max age (seconds) for a webhook timestamp to be considered fresh.
    'webhook_max_age_seconds' => env('DOKU_WEBHOOK_MAX_AGE_SECONDS', 300),

    // Fee threshold: subtotal only (no delivery). Below = Dombi absorbs fully, above = customer pays.
    'fee_threshold' => env('DOKU_FEE_THRESHOLD', 500_000),

    // Fee registry per method
    'methods' => [
        'qris'        => ['label' => 'QRIS',          'doku_type' => 'QRIS',       'channel' => null,   'fee_rate' => env('DOKU_FEE_QRIS', 0.007)],
        'transfer'    => ['label' => 'Transfer Bank', 'doku_type' => 'VA',         'channel' => 'BCA',  'fee_rate' => env('DOKU_FEE_TRANSFER', 0.004)],
        'ewallet'     => ['label' => 'E-Wallet',      'doku_type' => 'EWALLET',    'channel' => 'GOPAY','fee_rate' => env('DOKU_FEE_EWALLET', 0.015)],
        'credit_card' => ['label' => 'Kartu Kredit',  'doku_type' => 'CREDIT_CARD', 'channel' => null,   'fee_rate' => env('DOKU_FEE_CC', 0.029)],
        // legacy aliases for old orders
        'gopay'       => ['label' => 'GoPay',         'doku_type' => 'EWALLET',    'channel' => 'GOPAY',      'fee_rate' => env('DOKU_FEE_GOPAY', 0.015)],
        'shopeepay'   => ['label' => 'ShopeePay',     'doku_type' => 'EWALLET',    'channel' => 'SHOPEEPAY',  'fee_rate' => env('DOKU_FEE_SHOPEEPAY', 0.015)],
        'dana'        => ['label' => 'DANA',          'doku_type' => 'EWALLET',    'channel' => 'DANA',       'fee_rate' => env('DOKU_FEE_DANA', 0.015)],
    ],

    'enabled_methods' => explode(',', env('DOKU_ENABLED_METHODS', 'qris,transfer,ewallet,credit_card')),
];
