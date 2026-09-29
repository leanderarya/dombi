<?php

namespace App\Policies;

use App\Models\ExchangeRequest;
use App\Models\OfflineSale;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletAuditLog;
use App\Models\OutletInventory;
use App\Models\OutletPayable;
use App\Models\PricingAuditLog;
use App\Models\RestockRequest;
use App\Models\ReturnRequest;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use App\Models\StockMovement;
use App\Models\User;

class OutletPolicy
{
    public function viewAny(?User $user): bool
    {
        return true;
    }

    public function view(?User $user, Outlet $outlet): bool
    {
        return true;
    }

    public function create(?User $user): bool
    {
        return true;
    }

    public function update(?User $user, Outlet $outlet): bool
    {
        return true;
    }

    /**
     * Archiving is a status change, so it is always allowed.
     */
    public function delete(?User $user, Outlet $outlet): bool
    {
        return true;
    }

    /**
     * Only an outlet with nothing behind it may be erased.
     *
     * orders.outlet_id still cascades, and an order's own children follow it, so a
     * permanent delete here could take real transactions with it. The database's
     * RESTRICT rules would stop most of that, but the refusal belongs here, before
     * anything is attempted and with a message that says what is in the way.
     */
    public function forceDelete(?User $user, Outlet $outlet): bool
    {
        return $this->historyCounts($outlet) === [];
    }

    /**
     * What stands in the way of a permanent delete, as label => count. Empty means
     * the outlet has no history and can be erased.
     *
     * @return array<string, int>
     */
    public function historyCounts(Outlet $outlet): array
    {
        $sources = [
            'pesanan' => Order::where('outlet_id', $outlet->id)->count(),
            'settlement' => Settlement::where('outlet_id', $outlet->id)->count(),
            'pembayaran settlement' => SettlementPayment::where('outlet_id', $outlet->id)->count(),
            'piutang outlet' => OutletPayable::where('outlet_id', $outlet->id)->count(),
            'pergerakan stok' => StockMovement::where('outlet_id', $outlet->id)->count(),
            'log audit outlet' => OutletAuditLog::where('outlet_id', $outlet->id)->count(),
            'log audit harga' => PricingAuditLog::where('outlet_id', $outlet->id)->count(),
            'permintaan restock' => RestockRequest::where('outlet_id', $outlet->id)->count(),
            'pengajuan return' => ReturnRequest::where('outlet_id', $outlet->id)->count(),
            'pengajuan tukar' => ExchangeRequest::where('outlet_id', $outlet->id)->count(),
            'penjualan offline' => OfflineSale::where('outlet_id', $outlet->id)->count(),
            'baris inventaris' => OutletInventory::where('outlet_id', $outlet->id)->count(),
        ];

        return array_filter($sources, fn (int $count) => $count > 0);
    }
}
