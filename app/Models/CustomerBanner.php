<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerBanner extends Model
{
    protected $fillable = [
        'name',
        'alt_text',
        'image_path',
        'target_path',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }
}
