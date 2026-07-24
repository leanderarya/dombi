<?php

namespace App\Services;

use App\Enums\RefundRejectionReason;
use App\Models\Order;
use App\Models\RefundStatusHistory;
use Carbon\Carbon;

class RefundPayloadService
{
    public const QUEUES = [
        'awaiting_customer',
        'awaiting_guest',
        'ready',
        'in_progress',
        'action_required',
        'completed',
        'rejected',
    ];

    private const QUEUE_LABELS = [
        'awaiting_customer' => 'Menunggu Data Customer',
        'awaiting_guest' => 'Menunggu Data Guest',
        'ready' => 'Siap Diproses',
        'in_progress' => 'Sedang Diproses',
        'action_required' => 'Perlu Tindakan',
        'completed' => 'Selesai',
        'rejected' => 'Ditolak',
    ];

    private const STATUS_LABELS = [
        'refund_pending' => 'Menunggu Diproses',
        'refund_in_progress' => 'Sedang Diproses',
        'refunded' => 'Refund Selesai',
        'refund_rejected' => 'Refund Ditolak',
        'refund_failed' => 'Refund Gagal',
    ];

    private const ALLOWED_METADATA_KEYS = [
        'refund_amount', 'source_entry_point', 'destination_type',
        'rollback_mode', 'proof_present', 'reference_present',
    ];

    public function queueState(Order $order): ?string
    {
        $status = $order->payment_status;
        $destination = $order->refund_destination_status;

        return match (true) {
            $status === 'refund_pending' && $order->isGuestCustomer() && $destination !== 'valid' => 'awaiting_guest',
            $status === 'refund_pending' && ! $order->isGuestCustomer() && $destination !== 'valid' => 'awaiting_customer',
            $status === 'refund_pending' && $destination === 'valid' => 'ready',
            $status === 'refund_in_progress' && $order->refund_started_at?->gt(now()->subHours(24)) => 'in_progress',
            $status === 'refund_in_progress', $status === 'refund_failed' => 'action_required',
            $status === 'refunded' => 'completed',
            $status === 'refund_rejected' => 'rejected',
            default => null,
        };
    }

    public function statusLabel(Order $order): string
    {
        return self::STATUS_LABELS[$order->payment_status] ?? $order->payment_status ?? '';
    }

    public function queueLabel(string $queue): string
    {
        return self::QUEUE_LABELS[$queue] ?? $queue;
    }

    public function forOwner(Order $order): ?array
    {
        $queue = $this->queueState($order);
        if ($queue === null) {
            return null;
        }

        $order->loadMissing('customer', 'outlet');

        $base = $this->basePayload($order, $queue);

        $base['order_code'] = $order->order_code;
        $base['order_url'] = "/owner/finance?tab=refund&filter={$queue}";
        $base['customer_kind'] = $order->isGuestCustomer() ? 'guest' : 'registered';
        $base['customer_name'] = $order->customer_name ?? ($order->customer?->name ?? '');
        $base['customer_phone'] = $order->customer_phone ?? ($order->customer?->phone ?? '');

        $base['destination'] = $this->fullDestination($order);
        $base['proof_url'] = $order->payment_status === 'refunded' && $order->refund_proof_image
            ? "/refunds/{$order->id}/proof"
            : null;
        $base['transfer_reference'] = $order->refund_transfer_reference;
        $base['transfer_note'] = $order->refund_transfer_note;

        $base['can_enter_destination'] = $order->isGuestCustomer()
            && $order->payment_status === 'refund_pending'
            && $order->refund_destination_status !== 'valid';

        $base['can_legacy_repair'] = $order->payment_status === 'refund_pending'
            && $order->refund_destination_status !== 'valid'
            && $order->refund_requested_at !== null
            && $order->refund_requested_at->lt(Carbon::create(2026, 7, 24, 1, 0, 0, config('app.timezone')));

        $base['can_start'] = $order->payment_status === 'refund_pending'
            && $order->refund_destination_status === 'valid';

        $base['can_reject'] = $order->payment_status === 'refund_pending';

        $base['can_rollback'] = $order->payment_status === 'refund_in_progress';

        $base['can_complete'] = $order->payment_status === 'refund_in_progress';

        return $base;
    }

    public function forCustomer(Order $order): ?array
    {
        $queue = $this->queueState($order);
        if ($queue === null) {
            return null;
        }

        $order->loadMissing('customer');

        $base = $this->basePayload($order, $queue);

        $base['destination'] = $this->maskedDestination($order);
        $base['can_edit_destination'] = $order->payment_status === 'refund_pending'
            && $order->refund_destination_status !== 'valid';
        $base['can_resubmit'] = $order->payment_status === 'refund_rejected'
            && $order->refund_rejected_reason !== null
            && in_array($order->refund_rejected_reason, [
                RefundRejectionReason::InvalidDestination->value,
                RefundRejectionReason::IncompleteDestination->value,
            ], true);

        $base['proof_url'] = $order->payment_status === 'refunded' && $order->refund_proof_image
            ? "/refunds/{$order->id}/proof"
            : null;
        $base['transfer_reference'] = $order->refund_transfer_reference;
        $base['transfer_note'] = $order->refund_transfer_note;

        return $base;
    }

    public function forGuest(Order $order): ?array
    {
        $queue = $this->queueState($order);
        if ($queue === null) {
            return null;
        }

        $order->loadMissing('customer');

        $base = $this->basePayload($order, $queue);

        $base['guidance'] = 'Tim Dombi akan menghubungi nomor pesanan untuk konfirmasi tujuan refund.';

        return $base;
    }

    public function forOutlet(Order $order): ?array
    {
        $queue = $this->queueState($order);
        if ($queue === null) {
            return null;
        }

        return $this->basePayload($order, $queue);
    }

    public function normalizeStockReason(?string $reason): ?string
    {
        if ($reason === null) {
            return null;
        }

        return $reason === 'Stok Habis' ? 'Stok Tidak Tersedia' : $reason;
    }

    private function basePayload(Order $order, string $queue): array
    {
        $rejection = null;
        if ($order->refund_rejected_reason !== null) {
            $reasonEnum = RefundRejectionReason::tryFrom($order->refund_rejected_reason);
            $rejection = [
                'code' => $order->refund_rejected_reason,
                'label' => $reasonEnum?->label() ?? $order->refund_rejected_reason,
                'note' => $order->refund_rejection_note,
                'can_resubmit' => $reasonEnum?->canResubmit() ?? false,
            ];
        }

        return [
            'order_id' => $order->id,
            'payment_status' => $order->payment_status,
            'destination_status' => $order->refund_destination_status,
            'queue_state' => $queue,
            'status_label' => $this->statusLabel($order),
            'amount' => (float) ($order->refund_amount ?? 0),
            'requested_at' => $order->refund_requested_at?->toISOString(),
            'submitted_at' => $order->refund_destination_submitted_at?->toISOString(),
            'started_at' => $order->refund_started_at?->toISOString(),
            'completed_at' => $order->refunded_at?->toISOString(),
            'rejection' => $rejection,
            'timeline' => $this->safeTimeline($order),
        ];
    }

    private function safeTimeline(Order $order): array
    {
        if (! $order->relationLoaded('refundStatusHistories')) {
            return [];
        }

        return $order->refundStatusHistories->map(function (RefundStatusHistory $h) {
            $safeMetadata = null;
            if ($h->metadata !== null && is_array($h->metadata)) {
                $safeMetadata = array_intersect_key($h->metadata, array_flip(self::ALLOWED_METADATA_KEYS));
            }

            return [
                'id' => $h->id,
                'event' => $h->event,
                'from_status' => $h->from_status,
                'to_status' => $h->to_status,
                'actor_type' => $h->actor_type,
                'reason_code' => $h->reason_code,
                'note' => $h->note,
                'metadata' => $safeMetadata,
                'created_at' => $h->created_at?->toISOString(),
            ];
        })->all();
    }

    private function fullDestination(Order $order): ?array
    {
        if ($order->refund_destination_type === null) {
            return null;
        }

        if ($order->refund_destination_type === 'bank') {
            return [
                'type' => 'bank',
                'label' => $order->refund_bank_name,
                'holder' => $order->refund_account_holder,
                'number' => $order->refund_account_number,
            ];
        }

        if ($order->refund_destination_type === 'ewallet') {
            return [
                'type' => 'ewallet',
                'label' => $order->refund_ewallet_provider,
                'holder' => $order->refund_ewallet_holder,
                'number' => $order->refund_ewallet_number,
            ];
        }

        return null;
    }

    private function maskedDestination(Order $order): ?array
    {
        if ($order->refund_destination_type === null) {
            return null;
        }

        if ($order->refund_destination_type === 'bank') {
            $number = $order->refund_account_number;
            $masked = strlen($number) > 4
                ? str_repeat('•', max(0, strlen($number) - 4)).substr($number, -4)
                : $number;

            return [
                'type' => 'bank',
                'label' => $order->refund_bank_name,
                'holder' => $order->refund_account_holder,
                'masked_number' => $masked,
            ];
        }

        if ($order->refund_destination_type === 'ewallet') {
            $number = $order->refund_ewallet_number;
            $masked = strlen($number) > 4
                ? str_repeat('•', max(0, strlen($number) - 4)).substr($number, -4)
                : $number;

            return [
                'type' => 'ewallet',
                'label' => $order->refund_ewallet_provider,
                'holder' => $order->refund_ewallet_holder,
                'masked_number' => $masked,
            ];
        }

        return null;
    }
}
