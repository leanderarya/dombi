<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Backward compatibility alias for ProductCategory.
 * Points to new table product_categories after Task 2 refactor.
 * Will be deleted after backend migrates to ProductCategory/Product.
 */
class ProductFamily extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'product_categories';

    protected $fillable = [
        'name', 'brand', 'description', 'image', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class, 'product_category_id');
    }

    public function activeVariants(): HasMany
    {
        return $this->hasMany(ProductVariant::class, 'product_category_id')->where('is_active', true);
    }

    // Alias for new terminology
    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'product_category_id');
    }

    public function activeProducts(): HasMany
    {
        return $this->hasMany(Product::class, 'product_category_id')->where('is_active', true);
    }
}
