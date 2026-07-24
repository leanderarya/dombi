<?php

namespace App\Services;

use App\Enums\PaymentStatus;
use App\Enums\RefundRejectionReason;
use App\Models\Order;
use App\Models\RefundStatusHistory;
use DomainException;
use Illuminate\Support\Facades\DB;

class RefundService
{
    private const REQUEST_SOURCES = [
        'customer_cancellation',
        'outlet_rejection',
        'outlet_cancellation',
        'expiry',
        'late_payment',
        'manual_mark_paid',
    ];

    private const ACTOR_TYPES = [
        'customer', 'guest', 'outlet', 'owner', 'system',
    ];

    public function request(Order $order, string $actorType, ?int $actorId, string $source): ?RefundStatusHistory
    {
        if (!in_array($actorType, self::ACTOR_TYPES, true)) {
            throw new DomainException('Invalid actor type.');
        }

        if (!in_array($source, self::REQUEST_SOURCES, true)) {
            throw new DomainException('Invalid refund source.');
        }

        return DB::transaction(function () use ($order, $actorType, $actorId, $source) {
            $locked = Order::lockForUpdate()
                ->with('paymentTransactions')
                ->findOrFail($order->id);

            if (in_array($locked->payment_status, [
                PaymentStatus::RefundPending->value,
                PaymentStatus::RefundInProgress->value,
                PaymentStatus::Refunded->value,
                PaymentStatus::RefundRejected->value,
                PaymentStatus::RefundFailed->value,
            ], true)) {
                return null;
            }

            if (!in_array($locked->payment_status, [
                PaymentStatus::Paid->value,
                PaymentStatus::Settled->value,
            ], true)) {
                return null;
            }

            $trustedPaidAmount = $this->computeTrustedPaidAmount($locked);

            if ((float) $locked->total <= 0 || $trustedPaidAmount <= 0 || (float) $locked->total > $trustedPaidAmount) {
                throw new DomainException('Refund amount melebihi pembayaran terverifikasi.');
            }

            $fromStatus = $locked->payment_status;

            $locked->update([
                'payment_status' => PaymentStatus::RefundPending->value,
                'refund_amount' => (float) $locked->total,
                'refund_requested_at' => now(),
                'refund_reason' => $source,
                'refund_destination_status' => Order::REFUND_DESTINATION_MISSING,
            ]);

            return RefundStatusHistory::create([
                'order_id' => $locked->id,
                'from_status' => $fromStatus,
                'to_status' => PaymentStatus::RefundPending->value,
                'event' => RefundStatusHistory::EVENT_REFUND_REQUESTED,
                'actor_type' => $actorType,
                'actor_id' => $actorId,
                'metadata' => [
                    'refund_amount' => (float) $locked->total,
                    'source_entry_point' => $source,
                ],
            ]);
        });
    }

    public function submitDestination(Order $order, string $destinationType, string $actorType, ?int $actorId, array $data): RefundStatusHistory
    {
        return DB::transaction(function () use ($order, $destinationType, $actorType, $actorId, $data) {
            $locked = Order::lockForUpdate()
                ->with('customer')
                ->findOrFail($order->id);

            $customer = $locked->customer;

            if ($actorType === 'customer' && $customer?->isGuest()) {
                throw new DomainException('Tujuan refund tidak dapat diubah pada status ini.');
            }

            if ($actorType === 'owner' && !$customer?->isGuest()) {
                throw new DomainException('Tujuan refund tidak dapat diubah pada status ini.');
            }

            $this->validateDestinationData($destinationType, $data);

            $updateData = $this->buildDestinationUpdateData($destinationType, $data);

            $eligibleRejection = $locked->refund_destination_status === Order::REFUND_DESTINATION_INVALID
                && $locked->refund_rejected_reason !== null
                && in_array($locked->refund_rejected_reason, [
                    RefundRejectionReason::InvalidDestination->value,
                    RefundRejectionReason::IncompleteDestination->value,
                ], true);

            if ($eligibleRejection) {
                $updateData = array_merge($updateData, [
                    'payment_status' => PaymentStatus::RefundPending->value,
                    'refund_destination_status' => Order::REFUND_DESTINATION_VALID,
                    'refund_rejected_reason' => null,
                    'refund_rejection_note' => null,
                    'refund_rejected_at' => null,
                    'refund_rejected_by' => null,
                ]);

                $locked->update($updateData);

                return RefundStatusHistory::create([
                    'order_id' => $locked->id,
                    'from_status' => PaymentStatus::RefundRejected->value,
                    'to_status' => PaymentStatus::RefundPending->value,
                    'event' => RefundStatusHistory::EVENT_REFUND_REOPENED,
                    'actor_type' => $actorType,
                    'actor_id' => $actorId,
                    'metadata' => ['destination_type' => $destinationType],
                ]);
            }

            if ($locked->refund_destination_status === Order::REFUND_DESTINATION_MISSING) {
                if ($actorType === 'owner') {
                    $event = RefundStatusHistory::EVENT_GUEST_DESTINATION_SUBMITTED_BY_OWNER;
                } else {
                    $event = RefundStatusHistory::EVENT_DESTINATION_SUBMITTED;
                }
            } elseif ($locked->refund_destination_status === Order::REFUND_DESTINATION_VALID) {
                if ($actorType === 'owner') {
                    $event = RefundStatusHistory::EVENT_GUEST_DESTINATION_UPDATED_BY_OWNER;
                } else {
                    $event = RefundStatusHistory::EVENT_DESTINATION_UPDATED;
                }
            } else {
                throw new DomainException('Tujuan refund tidak dapat diubah pada status ini.');
            }

            $updateData['refund_destination_status'] = Order::REFUND_DESTINATION_VALID;

            $locked->update($updateData);

            return RefundStatusHistory::create([
                'order_id' => $locked->id,
                'from_status' => $locked->payment_status,
                'to_status' => $locked->payment_status,
                'event' => $event,
                'actor_type' => $actorType,
                'actor_id' => $actorId,
                'metadata' => ['destination_type' => $destinationType],
            ]);
        });
    }

    private function computeTrustedPaidAmount(Order $order): float
    {
        $successfulTransactions = $order->paymentTransactions
            ->whereIn('status', ['paid', 'settled']);

        if ($successfulTransactions->isNotEmpty()) {
            return (float) $successfulTransactions->max('amount');
        }

        if ($order->paid_at !== null) {
            return (float) $order->total;
        }

        return 0.0;
    }

    private function validateDestinationData(string $destinationType, array $data): void
    {
        if ($destinationType === 'bank') {
            if (empty($data['bank_name']) || empty($data['account_number']) || empty($data['account_holder'])) {
                throw new DomainException('Tujuan refund tidak dapat diubah pada status ini.');
            }
        } elseif ($destinationType === 'ewallet') {
            if (empty($data['ewallet_provider']) || empty($data['ewallet_number']) || empty($data['ewallet_holder'])) {
                throw new DomainException('Tujuan refund tidak dapat diubah pada status ini.');
            }
        } else {
            throw new DomainException('Tujuan refund tidak dapat diubah pada status ini.');
        }
    }

    private function buildDestinationUpdateData(string $destinationType, array $data): array
    {
        $base = [
            'refund_destination_type' => $destinationType,
            'refund_destination_submitted_at' => now(),
        ];

        if ($destinationType === 'bank') {
            return array_merge($base, [
                'refund_bank_name' => $data['bank_name'],
                'refund_account_number' => $data['account_number'],
                'refund_account_holder' => $data['account_holder'],
                'refund_ewallet_provider' => null,
                'refund_ewallet_number' => null,
                'refund_ewallet_holder' => null,
            ]);
        }

        return array_merge($base, [
            'refund_bank_name' => null,
            'refund_account_number' => null,
            'refund_account_holder' => null,
            'refund_ewallet_provider' => $data['ewallet_provider'],
            'refund_ewallet_number' => $data['ewallet_number'],
            'refund_ewallet_holder' => $data['ewallet_holder'],
        ]);
    }
}
