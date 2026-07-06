<?php

namespace App\Exceptions;

use Exception;

class StockAdjustedException extends Exception
{
    public array $adjustments;

    public function __construct(array $adjustments)
    {
        $this->adjustments = $adjustments;
        parent::__construct('Stock adjusted');
    }
}
