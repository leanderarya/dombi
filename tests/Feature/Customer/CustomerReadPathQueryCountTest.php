<?php

namespace Tests\Feature\Customer;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletHoliday;
use App\Models\OutletOperatingHours;
use App\Models\OutletProductPrice;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CustomerReadPathQueryCountTest extends TestCase
{
    use RefreshDatabase;

    public function test_outlet_list_query_count_does_not_grow_with_outlets(): void
    {
        $this->seedOutlets(2);
        $few = $this->countQueries(fn () => $this->getJson('/customer/outlets')->assertOk());

        $this->seedOutlets(6);
        $many = $this->countQueries(fn () => $this->getJson('/customer/outlets')->assertOk());

        $this->assertSame($few, $many, 'Outlet list must not run one query per outlet.');
    }

    public function test_product_catalog_query_count_does_not_grow_with_products(): void
    {
        $outlet = Outlet::factory()->create();
        $category = ProductCategory::factory()->create();

        $this->seedProducts($outlet, $category, 2);
        $few = $this->countQueries(fn () => $this->getJson("/customer/products/api?outlet_id={$outlet->id}")->assertOk());

        $this->seedProducts($outlet, $category, 6);
        $many = $this->countQueries(fn () => $this->getJson("/customer/products/api?outlet_id={$outlet->id}")->assertOk());

        $this->assertSame($few, $many, 'Product catalog must not run one price query per product.');
    }

    public function test_customer_order_list_query_count_does_not_grow_with_orders(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'user_id' => $user->id,
            'name' => 'Query Count Customer',
            'phone' => '628123456790',
            'is_registered' => true,
        ]);

        $this->actingAs($user);

        $this->seedHistoryOrders($customer, 2);
        $few = $this->countOrderListQueries($user);

        $this->seedHistoryOrders($customer, 4);
        $many = $this->countOrderListQueries($user);

        $this->assertSame($few, $many, 'Order list must not run one query per order.');
    }

    private function countOrderListQueries(User $user): int
    {
        $user->unsetRelation('customer');
        $this->actingAs($user);

        return $this->countQueries(fn () => $this->get('/customer/orders')->assertOk());
    }

    private function seedOutlets(int $count): void
    {
        Outlet::factory()->count($count)->create()->each(function (Outlet $outlet): void {
            foreach (range(0, 6) as $day) {
                OutletOperatingHours::factory()->create([
                    'outlet_id' => $outlet->id,
                    'day_of_week' => $day,
                    'open_time' => '08:00:00',
                    'close_time' => '20:00:00',
                    'is_closed' => false,
                ]);
            }

            OutletHoliday::create([
                'outlet_id' => $outlet->id,
                'start_date' => now()->subDay()->toDateString(),
                'end_date' => now()->addDay()->toDateString(),
                'reason' => 'Query count fixture',
            ]);
        });
    }

    private function seedProducts(Outlet $outlet, ProductCategory $category, int $count): void
    {
        Product::factory()->count($count)->create(['product_category_id' => $category->id])
            ->each(fn (Product $product) => OutletProductPrice::factory()->create([
                'outlet_id' => $outlet->id,
                'product_id' => $product->id,
                'selling_price' => 45000,
            ]));
    }

    private function seedHistoryOrders(Customer $customer, int $count): void
    {
        Order::factory()->count($count)->create([
            'customer_id' => $customer->id,
            'status' => Order::STATUS_COMPLETED,
            'payment_status' => 'refunded',
            'refund_reason' => 'customer_cancel',
        ]);
    }

    private function countQueries(callable $request): int
    {
        DB::flushQueryLog();
        DB::enableQueryLog();

        try {
            $request();
        } finally {
            $count = count(DB::getQueryLog());
            DB::disableQueryLog();
            DB::flushQueryLog();
        }

        return $count;
    }
}
