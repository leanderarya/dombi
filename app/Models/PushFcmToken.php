<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PushFcmToken extends Model
{
    protected $fillable = [
        'user_id',
        'customer_id',
        'fcm_token',
        'device_type',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
