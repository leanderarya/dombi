<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RefundRouteContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_destination_route_exists(): void
    {
        $this->assertTrue(\Route::has('customer.orders.refund-destination.update'));
        $route = \Route::getRoutes()->getByName('customer.orders.refund-destination.update');
        $this->assertEquals(['PATCH'], $route->methods());
    }

    public function test_owner_destination_route_exists(): void
    {
        $this->assertTrue(\Route::has('owner.refunds.destination'));
        $route = \Route::getRoutes()->getByName('owner.refunds.destination');
        $this->assertEquals(['POST'], $route->methods());
    }

    public function test_owner_start_route_exists(): void
    {
        $this->assertTrue(\Route::has('owner.refunds.start'));
        $route = \Route::getRoutes()->getByName('owner.refunds.start');
        $this->assertEquals(['POST'], $route->methods());
    }

    public function test_owner_reject_route_exists(): void
    {
        $this->assertTrue(\Route::has('owner.refunds.reject'));
        $route = \Route::getRoutes()->getByName('owner.refunds.reject');
        $this->assertEquals(['POST'], $route->methods());
    }

    public function test_owner_rollback_route_exists(): void
    {
        $this->assertTrue(\Route::has('owner.refunds.rollback'));
        $route = \Route::getRoutes()->getByName('owner.refunds.rollback');
        $this->assertEquals(['POST'], $route->methods());
    }

    public function test_owner_complete_route_exists(): void
    {
        $this->assertTrue(\Route::has('owner.refunds.complete'));
        $route = \Route::getRoutes()->getByName('owner.refunds.complete');
        $this->assertEquals(['POST'], $route->methods());
    }

    public function test_proof_route_exists(): void
    {
        $this->assertTrue(\Route::has('refunds.proof'));
    }

    public function test_finance_dashboard_route_exists(): void
    {
        $this->assertTrue(\Route::has('owner.finance.dashboard'));
    }

    public function test_owner_refunds_index_route_exists(): void
    {
        $this->assertTrue(\Route::has('owner.refunds.index'));
    }

    public function test_guest_cancel_route_absent(): void
    {
        $this->assertFalse(\Route::has('guest.orders.cancel-page'));
        $this->assertFalse(\Route::has('guest.orders.cancel'));
    }
}
