<?php

return [
    'tiers' => [
        ['max_km' => 3, 'fee' => 5000],
        ['max_km' => 5, 'fee' => 8000],
        ['max_km' => 8, 'fee' => 12000],
        ['max_km' => 10, 'fee' => 15000],
    ],

    'sla' => [
        'assignment_sla_minutes' => 10,
        'pickup_sla_minutes' => 20,
        'delivery_sla_minutes' => 60,
    ],

    'capacity' => [
        'max_active_deliveries' => (int) env('DELIVERY_MAX_ACTIVE_DELIVERIES', 3),
    ],

    'auto_offline' => [
        'hours' => (int) env('DELIVERY_AUTO_OFFLINE_HOURS', 4),
    ],

    'rejection_reasons' => [
        'Sedang Mengantar Pesanan Lain',
        'Kendaraan Bermasalah',
        'Di Luar Area Operasional',
        'Shift Akan Berakhir',
        'Kendala Pribadi',
        'Lainnya',
    ],

    'failure_reasons' => [
        'Customer Tidak Ditemukan',
        'Penerima Tidak Ada',
        'Alamat Tidak Jelas',
        'Menolak Pesanan',
        'Kendala Operasional',
        'Lainnya',
    ],
];
