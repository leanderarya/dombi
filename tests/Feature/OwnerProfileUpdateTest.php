<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
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

    public function test_owner_can_change_email(): void
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'email' => 'owner@example.com',
            'password' => Hash::make('current-password-123'),
        ]);

        $this->actingAs($owner)
            ->patch(route('owner.profile.email.update'), [
                'email' => 'owner-baru@example.com',
                'current_password' => 'current-password-123',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame('owner-baru@example.com', $owner->fresh()->email);
    }

    public function test_new_email_works_for_login_and_old_one_does_not(): void
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'email' => 'owner@example.com',
            'password' => Hash::make('current-password-123'),
            'is_active' => true,
        ]);

        $this->actingAs($owner)->patch(route('owner.profile.email.update'), [
            'email' => 'owner-baru@example.com',
            'current_password' => 'current-password-123',
        ]);

        $this->assertTrue(Auth::attempt([
            'email' => 'owner-baru@example.com',
            'password' => 'current-password-123',
        ]));
        Auth::logout();
        $this->assertFalse(Auth::attempt([
            'email' => 'owner@example.com',
            'password' => 'current-password-123',
        ]));
    }

    public function test_email_taken_by_another_user_is_rejected(): void
    {
        User::factory()->create(['email' => 'sudah-dipakai@example.com']);
        $owner = User::factory()->create([
            'role' => 'owner',
            'email' => 'owner@example.com',
            'password' => Hash::make('current-password-123'),
        ]);

        $this->actingAs($owner)
            ->patch(route('owner.profile.email.update'), [
                'email' => 'sudah-dipakai@example.com',
                'current_password' => 'current-password-123',
            ])
            ->assertSessionHasErrors('email');

        $this->assertSame('owner@example.com', $owner->fresh()->email);
    }

    /**
     * Rule::unique(...)->ignore($id) has to let a user keep their own address,
     * otherwise saving the form without editing the field fails.
     */
    public function test_keeping_the_same_email_succeeds(): void
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'email' => 'owner@example.com',
            'password' => Hash::make('current-password-123'),
        ]);

        $this->actingAs($owner)
            ->patch(route('owner.profile.email.update'), [
                'email' => 'owner@example.com',
                'current_password' => 'current-password-123',
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertSame('owner@example.com', $owner->fresh()->email);
    }

    public function test_wrong_current_password_blocks_email_change(): void
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'email' => 'owner@example.com',
            'password' => Hash::make('current-password-123'),
        ]);

        $this->actingAs($owner)
            ->patch(route('owner.profile.email.update'), [
                'email' => 'owner-baru@example.com',
                'current_password' => 'salah',
            ])
            ->assertSessionHasErrors('current_password');

        $this->assertSame('owner@example.com', $owner->fresh()->email);
    }

    public function test_google_link_is_dropped_when_email_changes(): void
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'email' => 'owner@example.com',
            'password' => Hash::make('current-password-123'),
            'provider' => 'google',
            'provider_id' => 'google-id-123',
        ]);
        $this->assertTrue($owner->hasGoogleAccount());

        $this->actingAs($owner)->patch(route('owner.profile.email.update'), [
            'email' => 'owner-baru@example.com',
            'current_password' => 'current-password-123',
        ]);

        $owner->refresh();
        $this->assertFalse($owner->hasGoogleAccount());
        $this->assertNull($owner->provider);
        $this->assertNull($owner->provider_id);
    }

    /**
     * The Google link is bound to the old address, but an account that still
     * has a password must never become re-linkable through a stale provider_id.
     */
    public function test_password_is_unchanged_by_email_update(): void
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'email' => 'owner@example.com',
            'password' => Hash::make('current-password-123'),
        ]);

        $this->actingAs($owner)->patch(route('owner.profile.email.update'), [
            'email' => 'owner-baru@example.com',
            'current_password' => 'current-password-123',
        ]);

        $this->assertTrue(
            Hash::check('current-password-123', $owner->fresh()->password),
        );
    }

    public function test_non_owner_cannot_change_email(): void
    {
        $outletUser = User::factory()->create([
            'role' => 'outlet',
            'email' => 'outlet@example.com',
            'password' => Hash::make('current-password-123'),
            'is_active' => true,
        ]);

        $this->actingAs($outletUser)
            ->patch(route('owner.profile.email.update'), [
                'email' => 'outlet-baru@example.com',
                'current_password' => 'current-password-123',
            ])
            ->assertRedirect(route('outlet.dashboard'));

        $this->assertSame('outlet@example.com', $outletUser->fresh()->email);
    }

    public function test_guest_cannot_change_email(): void
    {
        $this->patch(route('owner.profile.email.update'), [
            'email' => 'siapa-saja@example.com',
            'current_password' => 'whatever',
        ])->assertRedirect(route('login'));
    }
}
