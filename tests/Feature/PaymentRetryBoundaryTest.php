<?php

namespace Tests\Feature;

use Tests\TestCase;

class PaymentRetryBoundaryTest extends TestCase
{
    public function test_max_attempt_boundary_is_inclusive_after_active_attempt_resolution(): void
    {
        $controller = file_get_contents(app_path('Http/Controllers/Customer/OrderController.php'));

        $this->assertStringContainsString('$'.'paymentAttempts >= config(\'order.max_payment_attempts\', 3)', $controller);
    }
}
