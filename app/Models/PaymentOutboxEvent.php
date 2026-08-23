<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class PaymentOutboxEvent extends Model
{
    protected $fillable = [
        'event_key', 'event_type', 'aggregate_type', 'aggregate_id', 'payload',
        'status', 'attempts', 'next_attempt_at', 'last_error', 'delivered_at', 'claim_token', 'claim_expires_at', 'consumer_status', 'consumer_claim_token', 'consumer_claimed_at', 'consumer_next_attempt_at', 'consumer_last_error', 'consumer_completed_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'next_attempt_at' => 'datetime',
            'delivered_at' => 'datetime',
            'claim_expires_at' => 'datetime',
            'consumer_claimed_at' => 'datetime',
            'consumer_next_attempt_at' => 'datetime',
            'consumer_completed_at' => 'datetime',
        ];
    }

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', 'pending')
            ->where(fn (Builder $query) => $query->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', now()))
            ->where(fn (Builder $query) => $query->whereNull('claim_expires_at')->orWhere('claim_expires_at', '<=', now()));
    }

    public function claim(?string $token = null): ?string
    {
        $token ??= (string) Str::uuid();
        $claimed = static::query()->whereKey($this->id)->pending()->update([
            'claim_token' => $token,
            'claim_expires_at' => now()->addMinutes(5),
            'attempts' => $this->attempts + 1,
        ]);

        return $claimed === 1 ? $token : null;
    }

    public function claimConsumer(?string $token = null): ?string
    {
        $token ??= (string) Str::uuid();
        $claimed = static::query()->whereKey($this->id)->where(function (Builder $query): void {
            $query->where('consumer_status', 'pending')
                ->where(fn (Builder $query) => $query->whereNull('consumer_next_attempt_at')->orWhere('consumer_next_attempt_at', '<=', now()))
                ->orWhere(fn (Builder $query) => $query->where('consumer_status', 'processing')->where('consumer_claimed_at', '<=', now()->subMinutes(5)));
        })->update(['consumer_status' => 'processing', 'consumer_claim_token' => $token, 'consumer_claimed_at' => now()]);

        return $claimed === 1 ? $token : null;
    }

    public function completeConsumer(string $token): bool
    {
        return static::query()->whereKey($this->id)->where('consumer_status', 'processing')->where('consumer_claim_token', $token)->update(['consumer_status' => 'completed', 'consumer_completed_at' => now(), 'consumer_claim_token' => null]) === 1;
    }

    public function failConsumer(string $token, string $error): bool
    {
        return static::query()->whereKey($this->id)->where('consumer_status', 'processing')->where('consumer_claim_token', $token)->update(['consumer_status' => 'pending', 'consumer_claim_token' => null, 'consumer_next_attempt_at' => now()->addMinutes(min(60, 2 ** min($this->attempts, 6))), 'consumer_last_error' => $error]) === 1;
    }

    public function markDelivered(string $token): bool
    {
        return static::query()->whereKey($this->id)->where('status', 'pending')->where('claim_token', $token)->update([
            'status' => 'delivered', 'delivered_at' => now(), 'claim_token' => null, 'claim_expires_at' => null, 'last_error' => null,
        ]) === 1;
    }

    public function releaseClaim(string $token, string $error): bool
    {
        return static::query()->whereKey($this->id)->where('claim_token', $token)->update([
            'claim_token' => null, 'claim_expires_at' => null, 'next_attempt_at' => now(), 'last_error' => $error,
        ]) === 1;
    }

    public function markFailed(string $token, string $error): bool
    {
        return static::query()->whereKey($this->id)->where('status', 'pending')->where('claim_token', $token)->update([
            'next_attempt_at' => now()->addMinutes(min(60, 2 ** min($this->attempts, 6))), 'last_error' => $error, 'claim_token' => null, 'claim_expires_at' => null,
        ]) === 1;
    }
}
