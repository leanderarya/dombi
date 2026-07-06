<?php

namespace App\Exceptions;

use RuntimeException;

class InsufficientStockException extends RuntimeException
{
    public function __construct(
        public readonly int $outletId,
        public readonly ?int $productId,
        public readonly string $stockType,
        public readonly int $required,
        public readonly int $available,
        string $message = '',
    ) {
        parent::__construct($message ?: "Insufficient {$stockType}: required {$required}, available {$available} (outlet={$outletId}, product={$productId})");
    }
}
