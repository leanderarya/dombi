<?php

namespace App\Exceptions;

use Exception;

class StockAdjustedException extends Exception
{
    /**
     * @var array<int, array{variant_id: int, original_qty: int, adjusted_qty: int, available_stock: int}>
     */
    public readonly array $adjustments;

    public function __construct(array $adjustments)
    {
        $this->adjustments = $adjustments;
        parent::__construct('Stock adjusted');
    }
}
