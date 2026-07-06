<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GowaService
{
    private string $baseUrl;

    private string $apiKey;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.gowa.base_url'), '/');
        $this->apiKey = config('services.gowa.api_key', '');
    }

    /**
     * Send text message via GOWA.
     *
     * @param  string  $phone  Recipient phone in format 628xxxxxxxxxx
     * @param  string  $message  Message text
     * @return bool True if sent successfully
     */
    public function sendText(string $phone, string $message): bool
    {
        try {
            $response = Http::withHeaders(array_filter([
                'Authorization' => $this->apiKey ? "Bearer {$this->apiKey}" : null,
            ]))
                ->timeout(10)
                ->post("{$this->baseUrl}/send/message", [
                    'phone' => $phone,
                    'message' => $message,
                ]);

            if ($response->successful()) {
                Log::info('GOWA message sent', ['phone' => $phone]);

                return true;
            }

            Log::error('GOWA send failed', [
                'phone' => $phone,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return false;
        } catch (\Throwable $e) {
            Log::error('GOWA send exception', [
                'phone' => $phone,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Check if a phone number is reachable via WhatsApp.
     * Useful to verify user has started chat with bot.
     */
    public function isRegistered(string $phone): bool
    {
        try {
            $response = Http::withHeaders(array_filter([
                'Authorization' => $this->apiKey ? "Bearer {$this->apiKey}" : null,
            ]))
                ->timeout(10)
                ->get("{$this->baseUrl}/user/check", [
                    'phone' => $phone,
                ]);

            return $response->successful();
        } catch (\Throwable $e) {
            Log::error('GOWA check exception', ['phone' => $phone, 'error' => $e->getMessage()]);

            return false;
        }
    }
}
