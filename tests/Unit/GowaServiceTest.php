<?php

namespace Tests\Unit;

use App\Services\GowaService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GowaServiceTest extends TestCase
{
    public function test_send_text_returns_true_on_success(): void
    {
        Http::fake(['*' => Http::response(['status' => 'sent'], 200)]);

        $service = new GowaService;
        $result = $service->sendText('6281234567890', 'Test message');

        $this->assertTrue($result);
    }

    public function test_send_text_returns_false_on_failure(): void
    {
        Http::fake(['*' => Http::response(['error' => 'forbidden'], 403)]);

        $service = new GowaService;
        $result = $service->sendText('6281234567890', 'Test message');

        $this->assertFalse($result);
    }

    public function test_send_text_returns_false_on_exception(): void
    {
        Http::fake(['*' => function () {
            throw new \Exception('Connection refused');
        }]);

        $service = new GowaService;
        $result = $service->sendText('6281234567890', 'Test message');

        $this->assertFalse($result);
    }

    public function test_is_registered_returns_true_on_success(): void
    {
        Http::fake(['*' => Http::response(['registered' => true], 200)]);

        $service = new GowaService;
        $result = $service->isRegistered('6281234567890');

        $this->assertTrue($result);
    }

    public function test_is_registered_returns_false_on_failure(): void
    {
        Http::fake(['*' => Http::response(['error' => 'not found'], 404)]);

        $service = new GowaService;
        $result = $service->isRegistered('6281234567890');

        $this->assertFalse($result);
    }
}
