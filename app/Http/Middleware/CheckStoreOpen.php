<?php

namespace App\Http\Middleware;

use App\Models\Outlet;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckStoreOpen
{
    public function handle(Request $request, Closure $next): Response
    {
        $outletId = session('checkout.fulfillment.selected_outlet_id')
            ?? session('checkout.selected_outlet_id')
            ?? $request->input('outlet_id');

        if (! $outletId) {
            return $this->reject($request, 'Pilih outlet terlebih dahulu.');
        }

        $outlet = Outlet::find($outletId);

        if (! $outlet || ! $outlet->isOpen()) {
            return $this->reject($request, 'Toko sedang tutup. Silakan kembali saat jam operasional.');
        }

        return $next($request);
    }

    private function reject(Request $request, string $message): Response
    {
        // Raw fetch/AJAX (cart API) → 409 JSON
        if ($request->expectsJson()) {
            return response()->json([
                'error' => 'outlet_closed',
                'message' => $message,
            ], 409);
        }

        // Inertia XHR & full page nav → 302 redirect with errors bag
        return redirect()->back()->withErrors(['outlet_closed' => $message]);
    }
}