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
            'app.url' => 'https://example.com',
            'doku.callback_url' => 'https://example.com/payment/doku/notify',
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
            'app.url' => 'https://example.com',
            'doku.callback_url' => 'https://example.com/payment/doku/notify',
        ]);

        app(DokuConfigurationGuard::class)->validate();

        $this->assertSame('client', config('doku.client_id'));
        $this->assertSame('secret', config('doku.api_key'));
    }

    public function test_production_doku_configuration_accepts_callback_host_case_difference(): void
    {
        config([
            'app.env' => 'production', 'doku.client_id' => 'client', 'doku.api_key' => 'secret',
            'doku.sandbox' => false, 'doku.base_url' => 'https://api.doku.com',
            'app.url' => 'https://Example.com', 'doku.callback_url' => 'https://example.com/payment/doku/notify',
        ]);

        app(DokuConfigurationGuard::class)->validate();
        $this->assertTrue(true);
    }

    public function test_production_doku_configuration_rejects_insecure_application_url_independently_of_callback(): void
    {
        config([
            'app.env' => 'production',
            'doku.client_id' => 'client',
            'doku.api_key' => 'secret',
            'doku.sandbox' => false,
            'doku.base_url' => 'https://api.doku.com',
            'app.url' => 'http://shop.example.com',
            'doku.callback_url' => 'https://shop.example.com/payment/doku/notify',
        ]);

        $this->expectException(\RuntimeException::class);
        app(DokuConfigurationGuard::class)->validate();
    }

    public function test_production_doku_configuration_rejects_local_application_url_independently_of_callback(): void
    {
        config([
            'app.env' => 'production',
            'doku.client_id' => 'client',
            'doku.api_key' => 'secret',
            'doku.sandbox' => false,
            'doku.base_url' => 'https://api.doku.com',
            'app.url' => 'https://localhost',
            'doku.callback_url' => 'https://localhost/payment/doku/notify',
        ]);

        $this->expectException(\RuntimeException::class);
        app(DokuConfigurationGuard::class)->validate();
    }

    public function test_production_doku_configuration_rejects_reserved_application_hosts(): void
    {
        foreach (['localhost', 'localhost.', '127.0.0.1', '[::1]', '192.168.1.10', '169.254.10.20', '[fc00::1]'] as $host) {
            config([
                'app.env' => 'production',
                'doku.client_id' => 'client',
                'doku.api_key' => 'secret',
                'doku.sandbox' => false,
                'doku.base_url' => 'https://api.doku.com',
                'app.url' => "https://{$host}",
                'doku.callback_url' => "https://{$host}/payment/doku/notify",
            ]);

            try {
                app(DokuConfigurationGuard::class)->validate();
                $this->fail("Expected reserved host {$host} to be rejected.");
            } catch (\RuntimeException) {
                $this->assertTrue(true);
            }
        }
    }

    public function test_non_production_configuration_is_not_blocked(): void
    {
        config(['app.env' => 'testing', 'doku.client_id' => null, 'doku.api_key' => null]);

        app(DokuConfigurationGuard::class)->validate();
        $this->assertTrue(true);
    }
}
