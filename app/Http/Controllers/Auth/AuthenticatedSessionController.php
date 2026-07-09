<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    public function create(): Response
    {
        $user = Auth::user();

        return Inertia::render('auth/login', [
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                ] : null,
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => ['required_without:phone', 'email', 'nullable'],
            'phone' => ['required_without:email', 'string', 'nullable'],
            'password' => ['required', 'string'],
        ]);

        // Try email first, then phone
        if ($request->filled('email')) {
            $credentials = ['email' => $request->input('email'), 'password' => $request->input('password')];
        } else {
            $credentials = ['phone' => $request->input('phone'), 'password' => $request->input('password')];
        }

        if (! Auth::attempt([...$credentials, 'is_active' => true], $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => 'Email/No. HP atau password tidak sesuai.',
            ]);
        }

        $request->session()->regenerate();
        $request->session()->put('login_at', now()->timestamp);
        $request->session()->put('last_activity_at', now()->timestamp);

        return redirect()->intended(route('dashboard'));
    }

    public function destroy(Request $request): RedirectResponse
    {
        $role = $request->user()?->role;

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        // Customer → home; operational → login
        if ($role === 'customer') {
            return redirect('/');
        }

        return redirect()->route('login');
    }
}
