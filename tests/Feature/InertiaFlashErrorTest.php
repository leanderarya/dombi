<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InertiaFlashErrorTest extends TestCase
{
    use RefreshDatabase;

    public function test_error_flash_shared(): void
    {
        $response = $this->withSession(['error' => 'Test error message'])
            ->get('/login');

        $response->assertOk();
        $response->assertSessionHas('error', 'Test error message');
    }
}
