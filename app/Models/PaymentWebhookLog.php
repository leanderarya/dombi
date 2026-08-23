<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentWebhookLog extends Model
{
    protected $fillable = [
        'request_id', 'source', 'invoice_number', 'status',
        'signature_valid', 'mapped_status', 'payload', 'raw_body', 'body_digest', 'claimed_at', 'claim_token', 'error',
    ];

    protected $casts = [
        'signature_valid' => 'boolean',
        'payload' => 'array',
        'claimed_at' => 'datetime',
        'claim_token' => 'string',
    ];
}
