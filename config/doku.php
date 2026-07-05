<?php

return [
    'client_id' => env('DOKU_CLIENT_ID'),
    'api_key' => env('DOKU_API_KEY'),
    'sandbox' => env('DOKU_IS_SANDBOX', true),
    'base_url' => env('DOKU_IS_SANDBOX', true)
        ? 'https://api-sandbox.doku.com'
        : 'https://api.doku.com',
];
