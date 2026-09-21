<?php

namespace Tests\Unit;

use App\Models\Notification;
use Tests\TestCase;

class NotificationDestinationTest extends TestCase
{
    public function test_order_created_belongs_to_the_outlet_not_the_customer(): void
    {
        $this->assertSame(
            '/outlet/orders/7',
            Notification::destinationUrl('order.created', ['order_id' => 7], 'outlet')
        );
        $this->assertSame(
            '/customer/orders/7',
            Notification::destinationUrl('order.confirmed', ['order_id' => 7], 'customer')
        );
        $this->assertSame('/owner/orders', Notification::destinationUrl('order.rejected', ['order_id' => 7], 'owner'));
    }

    public function test_payment_notifications_route_by_role_not_by_entity(): void
    {
        $this->assertSame(
            '/outlet/settlement-payments',
            Notification::destinationUrl('payment.verified', ['payment_id' => 3], 'outlet')
        );
        $this->assertSame(
            '/owner/finance',
            Notification::destinationUrl('payment.submitted', ['payment_id' => 3], 'owner')
        );
    }

    public function test_delivery_notifications_route_per_role(): void
    {
        $data = ['order_id' => 9, 'delivery_id' => 4];

        $this->assertSame('/courier/deliveries/4', Notification::destinationUrl('delivery.courier_assigned', $data, 'courier'));
        $this->assertSame('/outlet/deliveries/4', Notification::destinationUrl('delivery.returned_to_outlet', $data, 'outlet'));
        $this->assertSame('/owner/deliveries', Notification::destinationUrl('delivery.failed', $data, 'owner'));
        $this->assertSame('/customer/orders/9', Notification::destinationUrl('delivery.completed', $data, 'customer'));
    }

    public function test_inventory_refund_and_report_families(): void
    {
        $this->assertSame('/outlet/restocks/5', Notification::destinationUrl('inventory.restock_approved', ['restock_id' => 5], 'outlet'));
        $this->assertSame('/owner/restocks/5', Notification::destinationUrl('inventory.restock_created', ['restock_id' => 5], 'owner'));
        $this->assertSame('/outlet/returns/2', Notification::destinationUrl('return.approved', ['return_request_id' => 2], 'outlet'));
        $this->assertSame('/owner/exchanges/3', Notification::destinationUrl('exchange.received', ['exchange_request_id' => 3], 'owner'));
        $this->assertSame('/owner/finance?tab=refund', Notification::destinationUrl('order.refund_requested', ['order_id' => 8], 'owner'));
        $this->assertSame('/customer/orders/8', Notification::destinationUrl('order.refund_processed', ['order_id' => 8], 'customer'));
        $this->assertSame('/outlet/order-reports/6', Notification::destinationUrl('new_order_report', ['report_id' => 6], 'outlet'));
    }

    public function test_existing_refund_url_wins_and_unknown_types_navigate_nowhere(): void
    {
        $this->assertSame(
            '/customer/orders/1',
            Notification::destinationUrl('order.refund_requested', ['url' => '/customer/orders/1'], 'customer')
        );
        $this->assertNull(Notification::destinationUrl('order.created', ['order_id' => 7], 'courier'));
        $this->assertNull(Notification::destinationUrl('inventory.restock_approved', [], 'outlet'));
        $this->assertNull(Notification::destinationUrl('something.unknown', [], 'owner'));
    }
}
