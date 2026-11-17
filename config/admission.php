<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Customer Admission
    |--------------------------------------------------------------------------
    |
    | 'active' (or the legacy alias 'open') allows new customer admissions.
    | 'held' closes new customer checkout and payment initiation by attaching
    | App\Http\Middleware\CheckCustomerAdmission to routes that create checkout
    | drafts, orders, or DOKU payment attempts.
    |
    | The default is held. Only an explicit active/open value allows customer
    | admissions; missing, empty, or unrecognized values remain held. Rebuild
    | the config cache after changing ADMISSION_CUSTOMER_CHECKOUT.
    |
    | DOKU callbacks (/payment/doku/notify, /payment/doku/redirect) are never
    | behind this gate. They must stay reachable so already-initiated payments
    | can still be persisted and confirmed.
    |
    */

    'customer_checkout' => env('ADMISSION_CUSTOMER_CHECKOUT', 'held'),

    'message' => env(
        'ADMISSION_CUSTOMER_CHECKOUT_MESSAGE',
        'Pesanan baru sedang kami tutup sementara untuk pemeliharaan. Silakan coba beberapa saat lagi.',
    ),

];
