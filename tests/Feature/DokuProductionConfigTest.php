<?php

namespace Tests\Feature;

use App\Services\DokuConfigurationGuard;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DokuProductionConfigTest extends TestCase
{
    use RefreshDatabase;

    public function test_production_doku_configuration_rejects_missing_credentials(): void
    {
        config(['app.env' => 'production', 'doku.client_id' => null, 'doku.api_key' => null]);

        $this->expectException(\RuntimeException::class);
        app(DokuConfigurationGuard::class)->validate();
    }

    public function test_production_doku_configuration_rejects_whitespace_credentials(): void
    {
        config([
            'app.env' => 'production',
            'doku.client_id' => "  \t",
            'doku.api_key' => "\n ",
            'doku.sandbox' => false,
            'doku.base_url' => 'https://api.doku.com',
            'app.url' => 'https://shop.example.com',
            'doku.callback_url' => 'https://shop.example.com/payment/doku/notify',
        ]);

        $this->expectException(\RuntimeException::class);
        app(DokuConfigurationGuard::class)->validate();
    }

    public function test_production_doku_configuration_normalizes_surrounding_credential_whitespace(): void
    {
        config([
            'app.env' => 'production',
            'doku.client_id' => '  client  ',
            'doku.api_key' => "\tsecret\n",
            'doku.sandbox' => false,
            'doku.base_url' => 'https://api.doku.com',
            'app.url' => 'https://shop.example.com',
            'doku.callback_url' => 'https://shop.example.com/payment/doku/notify',
        ]);

        app(DokuConfigurationGuard::class)->validate();

        $this->assertSame('client', config('doku.client_id'));
        $this->assertSame('secret', config('doku.api_key'));
    }

    public function test_production_doku_configuration_rejects_http_callback_and_localhost(): void
    {
        config([
            'app.env' => 'production',
            'doku.client_id' => 'client',
            'doku.api_key' => 'secret',
            'doku.sandbox' => false,
            'doku.base_url' => 'https://api.doku.com',
            'app.url' => 'https://shop.example.com',
            'doku.callback_url' => 'http://localhost/payment/doku/notify',
        ]);

        $this->expectException(\RuntimeException::class);
        app(DokuConfigurationGuard::class)->validate();
    }

    public function test_non_production_configuration_is_not_blocked(): void
    {
        config(['app.env' => 'testing', 'doku.client_id' => null, 'doku.api_key' => null]);

        app(DokuConfigurationGuard::class)->validate();
        $this->assertTrue(true);
    }
}
