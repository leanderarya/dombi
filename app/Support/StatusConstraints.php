<?php

namespace App\Support;

final class StatusConstraints
{
    /**
     * 'current' values are the ones application code writes today. 'legacy' values
     * are still accepted because older rows and pre-relaxation enum definitions
     * can contain them. The drift test only compares 'current' against the model
     * constants, so retiring a legacy value is an explicit decision.
     */
    public const ALLOWED_VALUES = [
        'orders' => [
            'status' => [
                'current' => [
                    'pending_confirmation', 'awaiting_preparation', 'confirmed', 'preparing',
                    'ready_for_pickup', 'picked_up', 'delivering', 'completed',
                    'cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet',
                    'failed_delivery', 'expired',
                ],
                'legacy' => ['pending', 'cancelled', 'failed'],
            ],
            'fulfillment_type' => [
                'current' => ['pickup', 'delivery_dombi', 'delivery_ojol'],
                'legacy' => [],
            ],
            'refund_destination_status' => [
                'current' => ['missing', 'valid', 'invalid'],
                'legacy' => [],
            ],
        ],
        'deliveries' => [
            'status' => [
                'current' => [
                    'waiting_assignment', 'waiting_pickup', 'picked_up', 'delivering',
                    'completed', 'failed', 'retry_delivery', 'returned_to_outlet',
                    'cancelled_and_released', 'rejected_by_courier',
                ],
                'legacy' => [],
            ],
            'courier_type' => [
                'current' => ['dombi', 'eksternal'],
                'legacy' => [],
            ],
            'resolution_status' => [
                'current' => ['retry_delivery', 'returned_to_outlet', 'cancelled_and_released'],
                'legacy' => [],
            ],
            'return_status' => [
                'current' => ['returning_to_outlet', 'returned_to_outlet'],
                'legacy' => [],
            ],
        ],
        'outlets' => [
            'status' => [
                'current' => ['active', 'inactive', 'temporarily_closed', 'maintenance', 'archived'],
                'legacy' => [],
            ],
        ],
        'settlements' => [
            'status' => [
                'current' => ['pending', 'generated', 'due_today', 'overdue', 'partial', 'paid'],
                'legacy' => [],
            ],
            'period_type' => [
                'current' => ['weekly'],
                'legacy' => ['daily'],
            ],
            'direction' => [
                'current' => ['owner_pays_outlet', 'outlet_pays_owner'],
                'legacy' => [],
            ],
        ],
        'settlement_payments' => [
            'direction' => [
                'current' => ['owner_pays_outlet', 'outlet_pays_owner'],
                'legacy' => [],
            ],
        ],
        'return_requests' => [
            'status' => [
                'current' => [
                    'draft', 'submitted', 'approved', 'rejected',
                    'received_at_center', 'completed', 'cancelled',
                ],
                'legacy' => [],
            ],
        ],
        'exchange_requests' => [
            'status' => [
                'current' => [
                    'submitted', 'approved', 'rejected', 'preparing',
                    'shipped', 'received', 'completed', 'cancelled',
                ],
                'legacy' => [],
            ],
        ],
        'order_reports' => [
            'status' => [
                'current' => ['pending', 'investigating', 'resolved', 'rejected'],
                'legacy' => [],
            ],
            'type' => [
                'current' => ['not_received', 'wrong_items', 'damaged', 'other'],
                'legacy' => [],
            ],
        ],
        'order_refund_destinations' => [
            'event' => [
                'current' => ['submitted', 'updated', 'backfilled'],
                'legacy' => [],
            ],
            'destination_type' => [
                'current' => ['bank', 'ewallet'],
                'legacy' => [],
            ],
            'actor_type' => [
                'current' => ['customer', 'owner'],
                'legacy' => [],
            ],
        ],
    ];

    public static function constraintName(string $table, string $column): string
    {
        return $table.'_'.$column.'_allowed_values';
    }

    public static function allowedFor(string $table, string $column): array
    {
        $definition = self::ALLOWED_VALUES[$table][$column];

        return array_merge($definition['current'], $definition['legacy']);
    }

    public static function currentFor(string $table, string $column): array
    {
        return self::ALLOWED_VALUES[$table][$column]['current'];
    }

    public static function legacyFor(string $table, string $column): array
    {
        return self::ALLOWED_VALUES[$table][$column]['legacy'];
    }
}
