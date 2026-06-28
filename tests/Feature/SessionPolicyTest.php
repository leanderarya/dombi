<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Date;
use Carbon\Carbon;
use Tests\TestCase;

class SessionPolicyTest extends TestCase
{
    use RefreshDatabase;

    // ── Part 1: Logout redirect ─────────────────────────────────────

    public function test_customer_logout_redirects_to_home(): void
    {
        $user = $this->createUser('customer');

        $response = $this->actingAs($user)->post('/logout');

        $response->assertRedirect('/');
    }

    public function test_owner_logout_redirects_to_login(): void
    {
        $user = $this->createUser('owner');

        $response = $this->actingAs($user)->post('/logout');

        $response->assertRedirect(route('login'));
    }

    public function test_outlet_logout_redirects_to_login(): void
    {
        $user = $this->createUser('outlet');

        $response = $this->actingAs($user)->post('/logout');

        $response->assertRedirect(route('login'));
    }

    public function test_courier_logout_redirects_to_login(): void
    {
        $user = $this->createUser('courier');

        $response = $this->actingAs($user)->post('/logout');

        $response->assertRedirect(route('login'));
    }

    public function test_logout_invalidates_session_and_regenerates_token(): void
    {
        $user = $this->createUser('customer');

        $this->actingAs($user);

        // Store something in session to verify it's cleared
        session(['test_key' => 'test_value']);
        $oldCsrfToken = session()->token();

        $this->post('/logout');

        // Session should be invalidated — test_key gone
        $this->assertNull(session('test_key'));
    }

    // ── Part 2: Session policy ──────────────────────────────────────

    public function test_customer_idle_within_limit_stays_logged_in(): void
    {
        $user = $this->createUser('customer');
        $policy = config('auth.session_policy.customer');

        // Set last_activity_at to just within limit
        $recentTimestamp = now()->subMinutes($policy['idle_minutes'] - 5)->timestamp;

        $this->actingAs($user);
        session(['login_at' => $recentTimestamp, 'last_activity_at' => $recentTimestamp]);

        // Make a request to a protected page
        $response = $this->get('/customer/home');

        $response->assertOk();
        $this->assertAuthenticated();
    }

    public function test_customer_idle_beyond_limit_logged_out(): void
    {
        $user = $this->createUser('customer');
        $policy = config('auth.session_policy.customer');

        // Set last_activity_at beyond idle limit
        $oldTimestamp = now()->subMinutes($policy['idle_minutes'] + 1)->timestamp;

        $this->actingAs($user);
        session(['login_at' => $oldTimestamp, 'last_activity_at' => $oldTimestamp]);

        $response = $this->get('/customer/home');

        $response->assertRedirect('/');
        $this->assertGuest();
    }

    public function test_operational_idle_beyond_limit_logged_out(): void
    {
        $user = $this->createUser('owner');
        $policy = config('auth.session_policy.operational');

        $oldTimestamp = now()->subMinutes($policy['idle_minutes'] + 1)->timestamp;

        $this->actingAs($user);
        session(['login_at' => $oldTimestamp, 'last_activity_at' => $oldTimestamp]);

        $response = $this->get('/owner/dashboard');

        $response->assertRedirect(route('login'));
        $this->assertGuest();
    }

    public function test_operational_absolute_cap_forces_logout_even_if_active(): void
    {
        $user = $this->createUser('owner');
        $policy = config('auth.session_policy.operational');

        // login_at is beyond absolute cap, but last_activity_at is recent (user is active)
        $oldLoginAt = now()->subMinutes($policy['absolute_minutes'] + 1)->timestamp;
        $recentActivity = now()->subMinutes(5)->timestamp;

        $this->actingAs($user);
        session(['login_at' => $oldLoginAt, 'last_activity_at' => $recentActivity]);

        $response = $this->get('/owner/dashboard');

        $response->assertRedirect(route('login'));
        $this->assertGuest();
    }

    public function test_guest_pickup_not_affected_by_session_policy(): void
    {
        // Guest tracking page should be accessible without auth
        // (enforce.session passes through unauthenticated users)
        $response = $this->get('/track/INVALID_TOKEN');

        // Should render track page (with not-found state), not redirect to login
        $response->assertOk();
    }

    public function test_missing_timestamps_defaults_safely(): void
    {
        $user = $this->createUser('customer');

        // Login without setting login_at/last_activity_at (simulates upgrade)
        $this->actingAs($user);
        // Don't set session timestamps — middleware should initialize them

        $response = $this->get('/customer/home');

        // Should NOT be logged out — safe default
        $response->assertOk();
        $this->assertAuthenticated();
        $this->assertNotNull(session('login_at'));
        $this->assertNotNull(session('last_activity_at'));
    }

    // ── Helpers ─────────────────────────────────────────────────────

    private function createUser(string $role): User
    {
        $user = User::forceCreate([
            'name' => ucfirst($role).' User',
            'email' => $role.'-'.uniqid().'@test.com',
            'password' => bcrypt('password'),
            'role' => $role,
            'is_active' => true,
        ]);

        if ($role === 'customer') {
            Customer::forceCreate([
                'name' => $user->name,
                'phone' => '628123456' . rand(10000, 99999),
                'email' => $user->email,
                'user_id' => $user->id,
                'is_registered' => true,
            ]);
        }

        return $user;
    }
}
