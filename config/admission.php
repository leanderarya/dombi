<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Customer Admission
    |--------------------------------------------------------------------------
    |
    | 'open' (the default) preserves normal behaviour: no customer route is
    | blocked. 'held' closes new customer checkout and payment initiation by
    | attaching App\Http\Middleware\CheckCustomerAdmission to the routes that
    | create checkout drafts, orders, or DOKU payment attempts.
    |
    | Reversible without a code change: set ADMISSION_CUSTOMER_CHECKOUT=held
    | and rebuild the config cache. Any value other than 'held' — including an
    | unset, empty, or misspelled one — leaves admissions OPEN, so this control
    | cannot close production by accident.
    |
    | DOKU callbacks (/payment/doku/notify, /payment/doku/redirect) are never
    | behind this gate. They must stay reachable so already-initiated payments
    | can still be persisted and confirmed.
    |
    */

    'customer_checkout' => env('ADMISSION_CUSTOMER_CHECKOUT', 'open'),

    'message' => env(
        'ADMISSION_CUSTOMER_CHECKOUT_MESSAGE',
        'Pesanan baru sedang kami tutup sementara untuk pemeliharaan. Silakan coba beberapa saat lagi.',
    ),

];
