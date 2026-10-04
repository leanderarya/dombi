<?php

namespace Tests;

use Illuminate\Support\Facades\Http;

/**
 * Answers DOKU's payment-creation call inside the test process.
 *
 * DokuService::createPayment() posts to the real gateway, and the class of
 * response it receives changes what the checkout endpoint does: a 4xx marks the
 * attempt failed and releases the stock reservation, while a 5xx is ambiguous,
 * keeps the reservation, and leaves the attempt awaiting reconciliation. A test
 * with no fake therefore asserts against whichever answer the sandbox happened
 * to give that minute.
 */
trait FakesDokuPayment
{
    protected function fakeDokuPayment(): void
    {
        Http::fake([
            '*/checkout/v1/payment' => Http::response([
                'response' => [
                    'order' => ['session_id' => 'sess-test'],
                    'payment' => ['url' => 'https://sandbox.doku.com/pay/test'],
                ],
            ]),
        ]);
    }
}
