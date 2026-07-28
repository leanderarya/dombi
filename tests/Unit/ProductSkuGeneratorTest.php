<?php

namespace Tests\Unit;

use Tests\TestCase;

class ProductSkuGeneratorTest extends TestCase
{
    public function test_generates_deterministic_sku(): void
    {
        $gen = app(\App\Services\ProductSkuGenerator::class);
        $cat = (object) ['name' => 'Biogoat'];
        $sku = $gen->generate($cat, 'Original 1L', 'Original', '1L', 1);
        $this->assertEquals('BIO-ORI-1L-001', $sku);
        $sku2 = $gen->generate($cat, 'Chocolate 1L', 'Chocolate', '1L', 2);
        $this->assertEquals('BIO-CHO-1L-002', $sku2);
    }
}
