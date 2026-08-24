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
            $safeMetadata = collect($attempt->metadata ?? [])
                ->except(['customer_snapshot', 'customer', 'raw_response', 'session_token', 'token_id', 'secrets'])
                ->all();

            return array_merge($attempt->toArray(), ['metadata' => $safeMetadata]);
        });

        return response()->json([
            'attempts' => $attempts,
            'webhooks' => PaymentWebhookLog::query()->latest()->paginate(25),
            'refund_obligations' => RefundObligation::query()->with('paymentAttempt')->latest()->paginate(25),
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
