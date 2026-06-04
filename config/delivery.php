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
];
