<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'phone',
        'email',
        'is_registered',
        'user_id',
        'last_order_at',
    ];

    protected function casts(): array
    {
        return [
            'is_registered' => 'boolean',
            'last_order_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(CustomerAddress::class);
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(Recipient::class);
    }

    public function favorites(): HasMany
    {
        return $this->hasMany(Favorite::class);
    }

    public function isGuest(): bool
    {
        return ! $this->is_registered;
    }

    public function isRegistered(): bool
    {
        return $this->is_registered;
    }

    /**
     * Link this customer to a user account (for future OTP registration).
     */
    public function linkToUser(User $user): void
    {
        $this->update([
            'user_id' => $user->id,
            'is_registered' => true,
        ]);
    }

    /**
     * Get the default address for this customer.
     */
    public function defaultAddress(): ?CustomerAddress
    {
        return $this->addresses()->where('is_default', true)->first();
    }

    /**
     * Scope to get only guest customers.
     */
    public function scopeGuest($query)
    {
        return $query->where('is_registered', false);
    }

    /**
     * Scope to get only registered customers.
     */
    public function scopeRegistered($query)
    {
        return $query->where('is_registered', true);
    }
}
