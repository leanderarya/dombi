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
        return response()->json([
            'attempts' => PaymentAttempt::query()->with('refundObligations')->latest()->paginate(25),
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
