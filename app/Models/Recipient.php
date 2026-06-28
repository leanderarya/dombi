<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Recipient extends Model
{
    protected $fillable = [
        'customer_id',
        'label',
        'name',
        'phone',
        'address_line',
        'address_detail',
        'province',
        'city',
        'district',
        'village',
        'postal_code',
        'latitude',
        'longitude',
        'landmark',
        'delivery_notes',
        'is_default',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
