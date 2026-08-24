<?php

namespace App\Services;

use RuntimeException;

class DokuConfigurationGuard
{
    public function validate(): void
    {
        if (config('app.env') !== 'production') {
            return;
        }

        $clientId = trim((string) config('doku.client_id'));
        $apiKey = trim((string) config('doku.api_key'));
        config(['doku.client_id' => $clientId, 'doku.api_key' => $apiKey]);
        $baseUrl = (string) config('doku.base_url');
        $callback = (string) config('doku.callback_url');
        $sandbox = (bool) config('doku.sandbox');

        if ($clientId === '' || $apiKey === '') {
            throw new RuntimeException('Production DOKU credentials are required.');
        }
        if ($sandbox || $baseUrl !== 'https://api.doku.com') {
            throw new RuntimeException('Production DOKU must use production endpoint.');
        }
        $appUrl = parse_url((string) config('app.url'));
        if (($appUrl['scheme'] ?? null) !== 'https' || in_array(strtolower($appUrl['host'] ?? ''), ['localhost', '127.0.0.1', '::1'], true)) {
            throw new RuntimeException('Production application URL must use public HTTPS.');
        }
        $callbackUrl = parse_url($callback);
        if (($callbackUrl['scheme'] ?? null) !== 'https' || in_array(strtolower($callbackUrl['host'] ?? ''), ['localhost', '127.0.0.1', '::1'], true)) {
            throw new RuntimeException('Production DOKU callback must use public HTTPS.');
        }
        if (strtolower((string) ($callbackUrl['host'] ?? '')) !== strtolower((string) parse_url((string) config('app.url'), PHP_URL_HOST))) {
            throw new RuntimeException('Production DOKU callback domain must match application domain.');
        }
    }
}
