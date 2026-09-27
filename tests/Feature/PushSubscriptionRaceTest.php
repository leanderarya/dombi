<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use NotificationChannels\WebPush\PushSubscription;
use Tests\TestCase;

/**
 * Makes the next endpoint lookup miss, which is what the real race looks like:
 * the row is there, but our select ran before the other request committed.
 */
class RacingPushSubscription extends PushSubscription
{
    public static bool $missNextLookup = false;

    public static function findByEndpoint(string $endpoint): ?static
    {
        if (static::$missNextLookup) {
            static::$missNextLookup = false;

            return null;
        }

        return parent::findByEndpoint($endpoint);
    }
}

class PushSubscriptionRaceTest extends TestCase
{
    use RefreshDatabase;

    private const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/race-test-endpoint';

    protected function setUp(): void
    {
        parent::setUp();

        config(['webpush.model' => RacingPushSubscription::class]);
    }

    protected function tearDown(): void
    {
        RacingPushSubscription::$missNextLookup = false;

        parent::tearDown();
    }

    public function test_a_lost_race_does_not_throw_and_keeps_one_row(): void
    {
        $user = User::factory()->create();

        // The other request got there first.
        $user->updatePushSubscription(self::ENDPOINT, 'key-before', 'token-before', 'aesgcm');

        // Ours looked before that row was visible, so it will try to insert and
        // collide with the unique index on the endpoint.
        RacingPushSubscription::$missNextLookup = true;

        $subscription = $user->updatePushSubscription(self::ENDPOINT, 'key-after', 'token-after', 'aesgcm');

        $this->assertSame(self::ENDPOINT, $subscription->endpoint);
        $this->assertSame('key-after', $subscription->public_key);
        $this->assertSame('token-after', $subscription->auth_token);
        $this->assertSame(
            1,
            PushSubscription::where('endpoint', self::ENDPOINT)->count(),
            'The endpoint must be stored once, not duplicated.',
        );
    }

    public function test_subscribing_twice_updates_instead_of_duplicating(): void
    {
        $user = User::factory()->create();

        $user->updatePushSubscription(self::ENDPOINT, 'key-one', 'token-one', 'aesgcm');
        $user->updatePushSubscription(self::ENDPOINT, 'key-two', 'token-two', 'aesgcm');

        $this->assertSame(1, PushSubscription::where('endpoint', self::ENDPOINT)->count());
        $this->assertSame(
            'key-two',
            PushSubscription::where('endpoint', self::ENDPOINT)->value('public_key'),
        );
    }

    public function test_a_different_user_takes_over_the_endpoint(): void
    {
        $first = User::factory()->create();
        $second = User::factory()->create();

        $first->updatePushSubscription(self::ENDPOINT, 'key-one', 'token-one', 'aesgcm');
        $second->updatePushSubscription(self::ENDPOINT, 'key-two', 'token-two', 'aesgcm');

        $this->assertSame(1, PushSubscription::where('endpoint', self::ENDPOINT)->count());
        $this->assertSame(
            $second->id,
            (int) PushSubscription::where('endpoint', self::ENDPOINT)->value('subscribable_id'),
        );
    }
}
