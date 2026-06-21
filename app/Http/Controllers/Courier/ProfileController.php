<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('courier/profile');
    }
}
