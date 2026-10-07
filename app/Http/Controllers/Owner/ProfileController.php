<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\UpdateProfilePasswordRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('owner/profile');
    }

    public function updatePassword(UpdateProfilePasswordRequest $request): RedirectResponse
    {
        $request->user()->forceFill([
            'password' => $request->validated()['password'], // cast 'hashed'
            'must_change_password' => false,
            'remember_token' => Str::random(60), // driver agnostic, invalidates remember-me
        ])->save();

        return back()->with('success', 'Password berhasil diperbarui.');
    }
}
