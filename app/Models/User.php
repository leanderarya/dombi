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
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use NotificationChannels\WebPush\HasPushSubscriptions;

#[Fillable(['name', 'email', 'password', 'phone', 'provider', 'provider_id', 'avatar', 'role', 'outlet_id', 'is_active', 'latitude', 'longitude', 'location_updated_at', 'vehicle_type', 'vehicle_plate', 'photo'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasPushSubscriptions, Notifiable;

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

    public function hasActiveLocation(): bool
    {
        return $this->latitude !== null
            && $this->longitude !== null
            && $this->location_updated_at !== null
            && $this->location_updated_at->diffInMinutes(now()) <= 5;
    }

    public function activeDeliveryCount(): int
    {
        return $this->courierDeliveries()
            ->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])
            ->count();
    }

    public function canAcceptDelivery(): bool
    {
        return $this->is_online
            && $this->is_active
            && $this->hasActiveLocation()
            && $this->activeDeliveryCount() < 3;
    }
}
