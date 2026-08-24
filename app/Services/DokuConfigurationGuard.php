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
        if (($appUrl['scheme'] ?? null) !== 'https' || ! $this->isPublicHost($appUrl['host'] ?? null)) {
            throw new RuntimeException('Production application URL must use public HTTPS.');
        }
        $callbackUrl = parse_url($callback);
        if (($callbackUrl['scheme'] ?? null) !== 'https' || ! $this->isPublicHost($callbackUrl['host'] ?? null)) {
            throw new RuntimeException('Production DOKU callback must use public HTTPS.');
        }
        if (strtolower((string) ($callbackUrl['host'] ?? '')) !== strtolower((string) parse_url((string) config('app.url'), PHP_URL_HOST))) {
            throw new RuntimeException('Production DOKU callback domain must match application domain.');
        }
    }

    private function isPublicHost(mixed $host): bool
    {
        if (! is_string($host) || $host === '') {
            return false;
        }

        $host = strtolower(rtrim($host, '.'));
        if ($host === 'localhost' || str_ends_with($host, '.localhost')) {
            return false;
        }

        $ip = filter_var(trim($host, '[]'), FILTER_VALIDATE_IP);
        if ($ip !== false) {
            return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
        }

        $records = dns_get_record($host, DNS_A | DNS_AAAA);
        if ($records === false || $records === []) {
            return false;
        }

        foreach ($records as $record) {
            $address = $record['ip'] ?? $record['ipv6'] ?? null;
            if (! is_string($address) || filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
                return false;
            }
        }

        return true;
    }
}
