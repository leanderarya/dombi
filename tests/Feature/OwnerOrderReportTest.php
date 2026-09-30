<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderReport;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The owner's treatment of a customer complaint report.
 *
 * The show page was deleted in an earlier refactor while its route and its
 * Inertia render target stayed behind, so the only link on the Analitik >
 * Masalah tab — `/owner/order-reports/{id}` — answered 500. These tests pin the
 * route back down, plus the transition rule the page's status select mirrors.
 */
class OwnerOrderReportTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'role' => 'owner',
            'is_active' => true,
            'must_change_password' => false,
        ]);
    }

    private function report(string $status = OrderReport::STATUS_PENDING): OrderReport
    {
        $outlet = Outlet::factory()->create();
        $customer = Customer::factory()->create();

        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
        ]);

        return OrderReport::create([
            'order_id' => $order->id,
            'customer_id' => $customer->id,
            'type' => OrderReport::TYPE_WRONG_ITEMS,
            'notes' => 'Item yang dikirim tidak sesuai pesanan.',
            'status' => $status,
        ]);
    }

    public function test_the_show_page_renders_for_the_owner(): void
    {
        $report = $this->report();

        $this->actingAs($this->owner)
            ->get('/owner/order-reports/'.$report->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/order-reports/show')
                ->where('report.id', $report->id)
                ->where('report.status', OrderReport::STATUS_PENDING)
                ->has('report.order')
                ->has('report.customer'));
    }

    public function test_the_owner_can_move_a_pending_report_to_investigating(): void
    {
        $report = $this->report();

        $this->actingAs($this->owner)
            ->put('/owner/order-reports/'.$report->id, ['status' => OrderReport::STATUS_INVESTIGATING])
            ->assertRedirect();

        $report->refresh();

        $this->assertSame(OrderReport::STATUS_INVESTIGATING, $report->status);
        // Investigating is not an outcome, so nobody is credited with resolving it.
        $this->assertNull($report->resolved_at);
        $this->assertNull($report->resolved_by);
    }

    public function test_resolving_records_the_resolver_and_the_notes(): void
    {
        $report = $this->report(OrderReport::STATUS_INVESTIGATING);

        $this->actingAs($this->owner)
            ->put('/owner/order-reports/'.$report->id, [
                'status' => OrderReport::STATUS_RESOLVED,
                'resolution_notes' => 'Penggantian dikirim ulang hari ini.',
            ])
            ->assertRedirect();

        $report->refresh();

        $this->assertSame(OrderReport::STATUS_RESOLVED, $report->status);
        $this->assertSame($this->owner->id, $report->resolved_by);
        $this->assertNotNull($report->resolved_at);
        $this->assertSame('Penggantian dikirim ulang hari ini.', $report->resolution_notes);
    }

    public function test_a_final_report_cannot_be_reopened(): void
    {
        $report = $this->report(OrderReport::STATUS_RESOLVED);

        $this->actingAs($this->owner)
            ->put('/owner/order-reports/'.$report->id, ['status' => OrderReport::STATUS_INVESTIGATING])
            ->assertSessionHasErrors('status');

        $this->assertSame(OrderReport::STATUS_RESOLVED, $report->refresh()->status);
    }

    public function test_resolving_without_notes_is_refused(): void
    {
        $report = $this->report(OrderReport::STATUS_INVESTIGATING);

        $this->actingAs($this->owner)
            ->put('/owner/order-reports/'.$report->id, ['status' => OrderReport::STATUS_RESOLVED])
            ->assertSessionHasErrors('resolution_notes');

        $this->assertSame(OrderReport::STATUS_INVESTIGATING, $report->refresh()->status);
    }

    public function test_an_outlet_user_cannot_resolve_the_report(): void
    {
        $report = $this->report(OrderReport::STATUS_INVESTIGATING);

        $outletUser = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $report->order->outlet_id,
        ]);

        // The owner routes sit behind `role:owner`, which bounces a wrong-role
        // user to their own dashboard rather than showing a 403. Reporting on
        // an outlet's own report belongs to the outlet controller instead.
        $this->actingAs($outletUser)
            ->put('/owner/order-reports/'.$report->id, [
                'status' => OrderReport::STATUS_RESOLVED,
                'resolution_notes' => 'Bukan wewenang outlet.',
            ])
            ->assertRedirect('/outlet/dashboard');

        $this->assertSame(OrderReport::STATUS_INVESTIGATING, $report->refresh()->status);
        $this->assertNull($report->resolution_notes);
    }
}
