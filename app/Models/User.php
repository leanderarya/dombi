<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Minishlink\WebPush\ContentEncoding;
use NotificationChannels\WebPush\HasPushSubscriptions;
use NotificationChannels\WebPush\PushSubscription;

#[Fillable(['name', 'email', 'password', 'phone', 'provider', 'provider_id', 'avatar', 'role', 'outlet_id', 'is_active', 'latitude', 'longitude', 'location_updated_at', 'vehicle_type', 'vehicle_plate', 'photo'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    use HasPushSubscriptions {
        updatePushSubscription as private updatePushSubscriptionUnguarded;
    }

    /**
     * The package looks the endpoint up and only then creates it, so two requests
     * racing for the same endpoint collide with the unique index on
     * push_subscriptions.endpoint and the second one fails with a duplicate entry
     * error. Retrying is enough: by then the row exists and the package takes its
     * update path instead.
     */
    public function updatePushSubscription(string $endpoint, ?string $key = null, ?string $token = null, ContentEncoding|string|null $contentEncoding = null): PushSubscription
    {
        try {
            return $this->updatePushSubscriptionUnguarded($endpoint, $key, $token, $contentEncoding);
        } catch (UniqueConstraintViolationException) {
            return $this->updatePushSubscriptionUnguarded($endpoint, $key, $token, $contentEncoding);
        }
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'is_online' => 'boolean',
            'must_change_password' => 'boolean',
            'shift_started_at' => 'datetime',
            'shift_ended_at' => 'datetime',
            'last_activity_at' => 'datetime',
            'location_updated_at' => 'datetime',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
        ];
    }

    public function courierDeliveries(): HasMany
    {
        return $this->hasMany(Delivery::class, 'courier_id');
    }

    public function restockRequests(): HasMany
    {
        return $this->hasMany(RestockRequest::class, 'requested_by');
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function customer(): HasOne
    {
        return $this->hasOne(Customer::class);
    }

    /**
     * Get the Customer record, creating one if it doesn't exist.
     * Guaranteed to never return null for authenticated users.
     */
    public function getCustomerOrCreate(): Customer
    {
        return $this->customer ?? Customer::firstOrCreate(
            ['user_id' => $this->id],
            ['name' => $this->name, 'email' => $this->email, 'is_registered' => true],
        );
    }

    public function isOwner(): bool
    {
        return $this->role === 'owner';
    }

    public function isCustomer(): bool
    {
        return $this->role === 'customer';
    }

    public function isOutlet(): bool
    {
        return $this->role === 'outlet';
    }

    public function isCourier(): bool
    {
        return $this->role === 'courier';
    }

    public function hasGoogleAccount(): bool
    {
        return $this->provider === 'google' && $this->provider_id !== null;
    }

    public function needsPhoneVerification(): bool
    {
        return $this->isCustomer() && $this->customer === null;
    }

    public function goOnline(): void
    {
        $this->forceFill(['is_online' => true])->save();
    }

    public function goOffline(): void
    {
        $this->forceFill(['is_online' => false])->save();
    }

    public function recordActivity(): void
    {
        $this->forceFill(['last_activity_at' => now()])->save();
    }

    public function hasActiveDeliveries(): bool
    {
        return $this->activeDeliveries()->exists();
    }

    public function activeDeliveries(): HasMany
    {
        return $this->hasMany(Delivery::class, 'courier_id')
            ->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering']);
    }

    public function courierProfile(): HasOne
    {
        return $this->hasOne(CourierProfile::class);
    }

    public function courierInvitations(): HasMany
    {
        return $this->hasMany(CourierInvitation::class, 'invited_by');
    }

    public function receivedCourierInvitations(): HasMany
    {
        return $this->hasMany(CourierInvitation::class, 'courier_user_id');
    }

    public function activeDeliveryCount(): int
    {
        return $this->courierDeliveries()
            ->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])
            ->count();
    }
}
