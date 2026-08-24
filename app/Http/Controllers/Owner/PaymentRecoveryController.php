<?php

namespace App\Http\Controllers\Owner;

use App\Enums\RefundObligationStatus;
use App\Http\Controllers\Controller;
use App\Models\PaymentAttempt;
use App\Models\PaymentWebhookLog;
use App\Models\RefundObligation;
use App\Services\DokuReconciliationService;
use App\Services\RefundObligationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;

class PaymentRecoveryController extends Controller
{
    public function __construct(
        private readonly DokuReconciliationService $reconciliation,
        private readonly RefundObligationService $refunds,
    ) {}

    public function index(): JsonResponse
    {
        $attempts = PaymentAttempt::query()
            ->select([
                'id', 'attempt_key', 'invoice_number', 'payment_method', 'amount_snapshot', 'currency_snapshot',
                'gateway_amount', 'gateway_currency', 'gateway_transaction_id', 'gateway_status', 'creation_state',
                'settlement_status', 'verification_status', 'reconciliation_status', 'reconciled_at',
                'fulfilment_claimed_at', 'metadata', 'created_at', 'updated_at',
            ])
            ->latest()
            ->paginate(25);
        $attempts->getCollection()->transform(function (PaymentAttempt $attempt): array {
            $safeMetadataKeys = [
                'reconciliation_attempts', 'last_reconciliation_status', 'last_reconciliation_error',
                'next_reconciliation_at', 'reconciliation_deadline_at', 'last_event_anomaly',
            ];
            $safeMetadata = collect($attempt->metadata ?? [])
                ->only($safeMetadataKeys)
                ->filter(static fn (mixed $value): bool => is_scalar($value) || $value === null)
                ->all();

            return array_merge($attempt->toArray(), ['metadata' => $safeMetadata]);
        });

        $webhooks = PaymentWebhookLog::query()->latest()->paginate(25);
        $webhooks->getCollection()->transform(static fn (PaymentWebhookLog $webhook): array => [
            'id' => $webhook->id,
            'request_id' => $webhook->request_id,
            'source' => $webhook->source,
            'invoice_number' => $webhook->invoice_number,
            'status' => $webhook->status,
            'signature_valid' => $webhook->signature_valid,
            'mapped_status' => $webhook->mapped_status,
            'received_at' => $webhook->created_at,
            'processed_at' => $webhook->updated_at,
            'error_code' => is_string(data_get($webhook->payload, 'error_code'))
                && in_array(data_get($webhook->payload, 'error_code'), ['invalid_signature', 'invoice_not_found', 'provider_error', 'processing_error'], true)
                ? data_get($webhook->payload, 'error_code')
                : null,
        ]);

        $refundObligations = RefundObligation::query()->with('paymentAttempt:id,order_id')->latest()->paginate(25);
        $refundObligations->getCollection()->transform(static fn (RefundObligation $obligation): array => [
            'id' => $obligation->id,
            'order_id' => $obligation->paymentAttempt?->order_id,
            'attempt_id' => $obligation->payment_attempt_id,
            'reason' => $obligation->reason,
            'amount' => $obligation->amount,
            'currency' => $obligation->currency,
            'status' => $obligation->status,
            'requested_at' => $obligation->requested_at,
            'started_at' => $obligation->started_at,
            'completed_at' => $obligation->completed_at,
            'rejected_at' => $obligation->rejected_at,
            'processed_at' => $obligation->processed_at,
            'rejection_code' => is_string(data_get($obligation->metadata, 'rejection_code'))
                && in_array(data_get($obligation->metadata, 'rejection_code'), ['invalid_destination', 'duplicate', 'customer_cancelled', 'provider_failure'], true)
                ? data_get($obligation->metadata, 'rejection_code')
                : null,
        ]);

        return response()->json([
            'attempts' => $attempts,
            'webhooks' => $webhooks,
            'refund_obligations' => $refundObligations,
        ]);
    }

    public function checkStatus(PaymentAttempt $attempt): RedirectResponse
    {
        $result = $this->reconciliation->reconcile($attempt);

        return redirect()->back()->with('success', $result->changed ? 'Payment status reconciled.' : 'Payment status unchanged.');
    }

    public function needsReview(RefundObligation $obligation): RedirectResponse
    {
        $this->refunds->transition($obligation, RefundObligationStatus::NeedsReview);

        return redirect()->back()->with('success', 'Refund obligation marked for review.');
    }
}
