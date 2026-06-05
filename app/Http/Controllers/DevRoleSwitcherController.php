<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class DevRoleSwitcherController extends Controller
{
    public function switchToOwner(Request $request): RedirectResponse
    {
        $user = User::where('role', 'owner')->where('is_active', true)->first();

        if (! $user) {
            return redirect()->back()->with('error', 'No owner user found.');
        }

        return $this->loginAs($request, $user);
    }

    public function switchToOutlet(Request $request): RedirectResponse
    {
        $user = User::where('role', 'outlet')->where('is_active', true)->first();

        if (! $user) {
            return redirect()->back()->with('error', 'No outlet user found.');
        }

        return $this->loginAs($request, $user);
    }

    public function switchToCourier(Request $request): RedirectResponse
    {
        $user = User::where('role', 'courier')->where('is_active', true)->first();

        if (! $user) {
            return redirect()->back()->with('error', 'No courier user found.');
        }

        return $this->loginAs($request, $user);
    }

    public function switchToCustomer(Request $request): RedirectResponse
    {
        $user = User::where('role', 'customer')->where('is_active', true)->first();

        if (! $user) {
            return redirect()->back()->with('error', 'No customer user found.');
        }

        return $this->loginAs($request, $user);
    }

    public function switchToGuest(Request $request): RedirectResponse
    {
        auth()->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/')->with('success', 'Switched to guest.');
    }

    private function loginAs(Request $request, User $user): RedirectResponse
    {
        auth()->login($user);
        $request->session()->regenerate();

        return redirect()->route('dashboard')->with('success', "Switched to {$user->role} ({$user->name}).");
    }
}
