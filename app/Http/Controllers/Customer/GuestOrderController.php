<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;

class GuestOrderController extends Controller
{
    public function showCancelPage(): never
    {
        abort(404);
    }

    public function cancel(): never
    {
        abort(403, 'Guest tidak dapat membatalkan pesanan.');
    }
}
