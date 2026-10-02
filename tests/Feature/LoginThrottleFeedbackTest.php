<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoginThrottleFeedbackTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Burn the five-attempt budget the `login` limiter allows per minute.
     */
    private function exhaustLoginLimit(array $headers = []): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->withHeaders($headers)->post('/login', [
                'email' => 'fake@test.com',
                'password' => 'wrong',
            ]);
        }
    }

    public function test_throttled_inertia_visit_degrades_to_a_flash_message(): void
    {
        // The login screen is the one page with no layout, so before this it had
        // no way to show a 429 at all: the response carried no X-Inertia header,
        // the client treated it as a foreign response, and the user got the
        // framework's untranslated "429 Too Many Requests" page in an iframe
        // with no way back.
        $this->get('/login');

        $this->exhaustLoginLimit(['X-Inertia' => 'true']);

        $response = $this->withHeaders(['X-Inertia' => 'true'])->post('/login', [
            'email' => 'fake@test.com',
            'password' => 'wrong',
        ]);

        $response->assertRedirect();
        $response->assertStatus(302);
        $response->assertSessionHas('error');

        $this->assertStringContainsString(
            'Terlalu banyak percobaan',
            session('error'),
        );
        // The user needs to know how long to wait, so the Retry-After value has
        // to survive into the message rather than being dropped on the floor.
        $this->assertMatchesRegularExpression('/\d+ detik/', session('error'));
    }

    public function test_plain_request_still_receives_the_framework_429(): void
    {
        // Negative control. Throttling is not bypassed for non-Inertia callers —
        // only the presentation changes, and only for Inertia visits.
        $this->exhaustLoginLimit();

        $this->post('/login', [
            'email' => 'fake@test.com',
            'password' => 'wrong',
        ])->assertStatus(429);
    }

    public function test_correct_credentials_are_not_blocked_below_the_limit(): void
    {
        // Guards against the renderable swallowing the success path.
        $owner = User::factory()->create([
            'email' => 'owner@example.com',
            'role' => 'owner',
            'is_active' => true,
        ]);

        $response = $this->post('/login', [
            'email' => $owner->email,
            'password' => 'password',
        ]);

        $response->assertRedirect(route('dashboard'));
        $this->assertAuthenticated();
    }
}
