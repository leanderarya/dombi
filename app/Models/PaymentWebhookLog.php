<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentWebhookLog extends Model
{
    protected $fillable = [
        'request_id', 'source', 'invoice_number', 'status',
        'signature_valid', 'mapped_status', 'payload', 'error',
    ];

    protected $casts = [
        'signature_valid' => 'boolean',
        'payload' => 'array',
    ];
}
