<?php

namespace App\Http\Controllers;

use App\Models\CourierInvitation;
use App\Models\CourierProfile;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class CourierInvitationController extends Controller
{
    public function show(string $token): Response|RedirectResponse
    {
        $invitation = CourierInvitation::where('token', $token)->first();

        if (! $invitation) {
            abort(404);
        }

        if ($invitation->isAccepted()) {
            return redirect()->route('courier.dashboard');
        }

        if ($invitation->isExpired()) {
            return Inertia::render('auth/invite-expired');
        }

        return Inertia::render('auth/accept-invite', [
            'invitation' => [
                'name' => $invitation->name,
                'phone' => $invitation->phone,
                'email' => $invitation->courierUser?->email,
                'token' => $invitation->token,
            ],
        ]);
    }

    public function accept(Request $request, string $token): RedirectResponse
    {
        $invitation = CourierInvitation::where('token', $token)->first();

        if (! $invitation) {
            abort(404);
        }

        if ($invitation->isAccepted()) {
            return redirect()->route('courier.dashboard');
        }

        if ($invitation->isExpired()) {
            return back()->withErrors(['token' => 'Tautan undangan sudah kadaluarsa.']);
        }

        $request->validate([
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $invitation->courierUser;
        if (! $user) {
            return back()->withErrors(['token' => 'Kurir tidak ditemukan.']);
        }

        $user->update([
            'password' => Hash::make($request->input('password')),
            'must_change_password' => false,
        ]);

        $invitation->update([
            'status' => 'accepted',
            'accepted_at' => now(),
        ]);

        CourierProfile::where('user_id', $user->id)->update([
            'invitation_status' => 'accepted',
            'accepted_at' => now(),
        ]);

        Auth::login($user);

        return redirect()->route('courier.dashboard');
    }
}
