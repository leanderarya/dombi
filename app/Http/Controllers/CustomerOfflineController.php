<?php

namespace App\Http\Controllers;

use Inertia\Inertia;

class CustomerOfflineController extends Controller
{
    public function index()
    {
        return Inertia::render('customer/offline');
    }
}
