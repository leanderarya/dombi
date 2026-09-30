<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\PaymentAccount;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class PaymentAccountController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'bank_name' => ['required', 'string', 'max:100'],
            'account_number' => ['required', 'string', 'max:50'],
            'account_holder' => ['required', 'string', 'max:100'],
        ]);

        PaymentAccount::create($validated);

        return redirect()->route('owner.finance.dashboard', ['tab' => 'rekening'])
            ->with('success', 'Rekening berhasil ditambahkan.');
    }

    public function update(Request $request, PaymentAccount $account): RedirectResponse
    {
        $validated = $request->validate([
            'bank_name' => ['required', 'string', 'max:100'],
            'account_number' => ['required', 'string', 'max:50'],
            'account_holder' => ['required', 'string', 'max:100'],
            'is_active' => ['boolean'],
        ]);

        $account->update($validated);

        return redirect()->route('owner.finance.dashboard', ['tab' => 'rekening'])
            ->with('success', 'Rekening berhasil diperbarui.');
    }

    public function destroy(PaymentAccount $account): RedirectResponse
    {
        $account->delete();

        return redirect()->route('owner.finance.dashboard', ['tab' => 'rekening'])
            ->with('success', 'Rekening berhasil dihapus.');
    }
}
