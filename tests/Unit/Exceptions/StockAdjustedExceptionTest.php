<?php

namespace Tests\Unit\Exceptions;

use App\Exceptions\StockAdjustedException;
use Tests\TestCase;

class StockAdjustedExceptionTest extends TestCase
{
    public function test_exception_stores_adjustments(): void
    {
        $adjustments = [
            [
                'variant_id' => 5,
                'original_qty' => 10,
                'adjusted_qty' => 3,
                'available_stock' => 3,
            ],
        ];

        $exception = new StockAdjustedException($adjustments);

        $this->assertEquals($adjustments, $exception->adjustments);
        $this->assertEquals('Stock adjusted', $exception->getMessage());
    }

    public function test_exception_with_empty_adjustments(): void
    {
        $exception = new StockAdjustedException([]);

        $this->assertEquals([], $exception->adjustments);
    }
}
