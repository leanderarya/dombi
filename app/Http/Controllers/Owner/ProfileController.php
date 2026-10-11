<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\UpdateProfileEmailRequest;
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

    public function updateEmail(UpdateProfileEmailRequest $request): RedirectResponse
    {
        $user = $request->user();
        $email = $request->validated()['email'];

        if ($email === $user->email) {
            return back()->with('success', 'Email tidak berubah.');
        }

        $user->forceFill([
            'email' => $email,
            // The Google link belongs to the old address; drop it so the
            // account falls back to password login instead of keeping a
            // provider_id that no longer matches the email.
            'provider' => null,
            'provider_id' => null,
        ])->save();

        return back()->with('success', 'Email akun berhasil diperbarui.');
    }
}
