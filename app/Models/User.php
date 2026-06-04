<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'role', 'phone', 'is_active', 'is_online', 'shift_started_at', 'shift_ended_at', 'last_activity_at', 'outlet_id', 'must_change_password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

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

    public function outlet(): HasOne
    {
        return $this->hasOne(Outlet::class);
    }

    public function customer(): HasOne
    {
        return $this->hasOne(Customer::class);
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

    public function isOnShift(): bool
    {
        return $this->shift_started_at !== null && $this->shift_ended_at === null;
    }

    public function startShift(): void
    {
        $this->update([
            'is_online' => true,
            'shift_started_at' => now(),
            'shift_ended_at' => null,
        ]);
    }

    public function endShift(): void
    {
        $this->update([
            'is_online' => false,
            'shift_ended_at' => now(),
        ]);
    }

    public function goOnline(): void
    {
        $this->update(['is_online' => true]);
    }

    public function goOffline(): void
    {
        $this->update(['is_online' => false]);
    }

    public function recordActivity(): void
    {
        $this->update(['last_activity_at' => now()]);
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
}
