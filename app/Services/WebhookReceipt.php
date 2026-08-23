<?php

namespace App\Services;

use App\Models\PaymentWebhookLog;

final readonly class WebhookReceipt
{
    public function __construct(public PaymentWebhookLog $log, public int $statusCode, public string $message) {}
}
