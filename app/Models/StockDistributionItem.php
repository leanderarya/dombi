<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockDistributionItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_distribution_id',
        'product_id',
        'product_variant_id',
        'quantity',
    ];

    public function stockDistribution(): BelongsTo
    {
        return $this->belongsTo(StockDistribution::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
