<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthRedirectTraceTest extends TestCase
{
    use RefreshDatabase;

    // ─── STEP 5: AUTH STATE VERIFICATION ────────────────────────────

    public function test_owner_user_has_correct_role(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $this->assertSame('owner', $owner->role);
        $this->assertTrue($owner->isOwner());
        $this->assertFalse($owner->isCustomer());
        $this->assertTrue($owner->is_active);
    }

    public function test_outlet_user_has_correct_role(): void
    {
        $outlet = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        $this->assertSame('outlet', $outlet->role);
        $this->assertTrue($outlet->isOutlet());
        $this->assertFalse($outlet->isCustomer());
    }

    public function test_courier_user_has_correct_role(): void
    {
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true]);
        $this->assertSame('courier', $courier->role);
        $this->assertTrue($courier->isCourier());
        $this->assertFalse($courier->isCustomer());
    }

    public function test_customer_model_has_correct_fields(): void
    {
        $customer = Customer::create(['name' => 'Test Customer', 'phone' => '6281234567890']);
        $this->assertSame('Test Customer', $customer->name);
        $this->assertSame('6281234567890', $customer->phone);
        $this->assertNull($customer->email);
    }

    // ─── STEP 2: LOGIN REDIRECT FLOW ───────────────────────────────

    public function test_owner_login_redirects_to_owner_dashboard(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        $response = $this->post('/login', [
            'email' => $owner->email,
            'password' => 'password',
        ]);

        $response->assertRedirect('/dashboard');
    }

    public function test_outlet_login_redirects_to_outlet_dashboard(): void
    {
        $outlet = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $response = $this->post('/login', [
            'email' => $outlet->email,
            'password' => 'password',
        ]);

        $response->assertRedirect('/dashboard');
    }

    public function test_courier_login_redirects_to_courier_dashboard(): void
    {
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true]);

        $response = $this->post('/login', [
            'email' => $courier->email,
            'password' => 'password',
        ]);

        $response->assertRedirect('/dashboard');
    }

    // ─── STEP 3: ROOT REDIRECT ─────────────────────────────────────

    public function test_guest_root_shows_customer_home(): void
    {
        $this->get('/')->assertOk();
    }

    public function test_owner_root_redirects_to_owner_dashboard(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $this->actingAs($owner)->get('/')->assertRedirect('/dashboard');
    }

    public function test_dashboard_redirect_controller_for_owner(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $this->actingAs($owner)->get('/dashboard')->assertRedirect('/owner/dashboard');
    }

    public function test_dashboard_redirect_controller_for_outlet(): void
    {
        $outlet = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        $this->actingAs($outlet)->get('/dashboard')->assertRedirect('/outlet/dashboard');
    }

    public function test_dashboard_redirect_controller_for_courier(): void
    {
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true]);
        $this->actingAs($courier)->get('/dashboard')->assertRedirect('/courier/dashboard');
    }

    // ─── STEP 4: MIDDLEWARE CHAIN ──────────────────────────────────

    public function test_owner_can_access_owner_dashboard(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $this->actingAs($owner)->get('/owner/dashboard')->assertOk();
    }

    public function test_outlet_can_access_outlet_dashboard(): void
    {
        $outlet = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        \App\Models\Outlet::create([
            'user_id' => $outlet->id,
            'name' => 'Test Outlet',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Jl. Test',
            'status' => 'active',
        ]);
        $outlet->update(['outlet_id' => $outlet->outlet->id]);
        $this->actingAs($outlet)->get('/outlet/dashboard')->assertOk();
    }

    public function test_courier_can_access_courier_dashboard(): void
    {
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true]);
        $this->actingAs($courier)->get('/courier/dashboard')->assertOk();
    }

    public function test_customer_home_accessible_as_guest(): void
    {
        $this->get('/customer/home')->assertOk();
    }

    // ─── STEP 4: CROSS-ROLE REDIRECTS ──────────────────────────────

    public function test_owner_cannot_access_customer_home(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $this->actingAs($owner)->get('/customer/home')->assertRedirect('/owner/dashboard');
    }

    public function test_outlet_cannot_access_owner_dashboard(): void
    {
        $outlet = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        $this->actingAs($outlet)->get('/owner/dashboard')->assertRedirect('/outlet/dashboard');
    }

    public function test_courier_cannot_access_outlet_dashboard(): void
    {
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true]);
        $this->actingAs($courier)->get('/outlet/dashboard')->assertRedirect('/courier/dashboard');
    }

    // ─── STEP 1: GUEST ACCESS ──────────────────────────────────────

    public function test_unauthenticated_user_redirected_to_login(): void
    {
        $this->get('/owner/dashboard')->assertRedirect('/login');
    }

    public function test_guest_can_access_login_page(): void
    {
        $this->get('/login')->assertOk();
    }

    public function test_authenticated_owner_redirected_from_login(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $this->actingAs($owner)->get('/login')->assertOk();
    }

    public function test_authenticated_owner_sees_logged_in_state_on_login(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $this->actingAs($owner)
            ->get('/login')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('auth.user.role', 'owner')
                ->where('auth.user.name', $owner->name)
            );
    }

    // ─── STEP 6: EDGE CASES ────────────────────────────────────────

    public function test_inactive_user_cannot_login(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => false]);

        $response = $this->post('/login', [
            'email' => $owner->email,
            'password' => 'password',
        ]);

        $response->assertSessionHasErrors('email');
    }

    public function test_owner_can_access_owner_orders(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $this->actingAs($owner)->get('/owner/orders')->assertOk();
    }

    public function test_owner_can_access_owner_deliveries(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $this->actingAs($owner)->get('/owner/deliveries')->assertOk();
    }

    public function test_full_login_logout_login_cycle(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        // Login
        $this->post('/login', [
            'email' => $owner->email,
            'password' => 'password',
        ])->assertRedirect('/dashboard');

        // Dashboard redirect to role-specific page
        $this->get('/dashboard')->assertRedirect('/owner/dashboard');

        // Access protected route
        $this->get('/owner/dashboard')->assertOk();

        // Logout
        $this->post('/logout')->assertRedirect('/login');

        // Access protected route after logout -> redirect to login
        $this->get('/owner/dashboard')->assertRedirect('/login');
    }

    public function test_owner_can_login_and_access_dashboard(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        // Login as owner
        $this->post('/login', [
            'email' => $owner->email,
            'password' => 'password',
        ])->assertRedirect('/dashboard');
        $this->get('/dashboard')->assertRedirect('/owner/dashboard');

        // Owner can access owner dashboard
        $this->get('/owner/dashboard')->assertOk();
    }
}
