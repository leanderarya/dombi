<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class OwnerProfileUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_change_password_from_profile(): void
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'password' => Hash::make('old-password-123'),
        ]);

        $response = $this->actingAs($owner)->put(
            route('owner.profile.password.update'),
            [
                'current_password' => 'old-password-123',
                'password' => 'new-password-456',
                'password_confirmation' => 'new-password-456',
            ],
        );

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $owner->refresh();
        $this->assertTrue(Hash::check('new-password-456', $owner->password));
        $this->assertFalse(Hash::check('old-password-123', $owner->password));
    }

    public function test_remember_token_rotates_on_password_change(): void
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'password' => Hash::make('old-password-123'),
            'remember_token' => 'old-token-abc',
        ]);

        $this->actingAs($owner)->put(route('owner.profile.password.update'), [
            'current_password' => 'old-password-123',
            'password' => 'new-password-456',
            'password_confirmation' => 'new-password-456',
        ]);

        $owner->refresh();
        $this->assertNotSame('old-token-abc', $owner->remember_token);
        $this->assertNotNull($owner->remember_token);
    }

    public function test_wrong_current_password_is_rejected(): void
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'password' => Hash::make('old-password-123'),
        ]);

        $this->actingAs($owner)
            ->put(route('owner.profile.password.update'), [
                'current_password' => 'wrong-password',
                'password' => 'new-password-456',
                'password_confirmation' => 'new-password-456',
            ])
            ->assertSessionHasErrors('current_password');

        $this->assertTrue(
            Hash::check('old-password-123', $owner->fresh()->password),
        );
    }

    public function test_password_must_be_confirmed(): void
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'password' => Hash::make('old-password-123'),
        ]);

        $this->actingAs($owner)
            ->put(route('owner.profile.password.update'), [
                'current_password' => 'old-password-123',
                'password' => 'new-password-456',
                'password_confirmation' => 'different-password',
            ])
            ->assertSessionHasErrors('password');
    }

    /**
     * EnsurePasswordIsChanged stands in front of the whole owner group, so an
     * account still flagged must_change_password never reaches this endpoint —
     * it is sent to the dedicated /password/change page instead. Only couriers
     * and outlets ever get the flag set, so this is a guard, not a dead end.
     */
    public function test_must_change_password_account_is_sent_to_change_page(): void
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'password' => Hash::make('old-password-123'),
            'must_change_password' => true,
        ]);

        $this->actingAs($owner)
            ->put(route('owner.profile.password.update'), [
                'current_password' => 'old-password-123',
                'password' => 'new-password-456',
                'password_confirmation' => 'new-password-456',
            ])
            ->assertRedirect(route('password.change'));

        $this->assertTrue($owner->fresh()->must_change_password);
    }

    public function test_non_owner_cannot_change_owner_password(): void
    {
        $outletUser = User::factory()->create([
            'role' => 'outlet',
            'password' => Hash::make('old-password-123'),
            'is_active' => true,
        ]);

        // RoleMiddleware redirects a wrong-role user to their own dashboard
        // rather than aborting, so the guard shows up as a 302 here.
        $this->actingAs($outletUser)
            ->put(route('owner.profile.password.update'), [
                'current_password' => 'old-password-123',
                'password' => 'new-password-456',
                'password_confirmation' => 'new-password-456',
            ])
            ->assertRedirect(route('outlet.dashboard'));

        $this->assertTrue(
            Hash::check('old-password-123', $outletUser->fresh()->password),
        );
    }

    public function test_guest_cannot_change_password(): void
    {
        $this->put(route('owner.profile.password.update'), [
            'current_password' => 'whatever',
            'password' => 'new-password-456',
            'password_confirmation' => 'new-password-456',
        ])->assertRedirect(route('login'));
    }
}
