import { Link } from '@inertiajs/react';
import { lazy, Suspense } from 'react';
import OutletStatusBadge from '@/components/owner/outlet-status-badge';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import StockLevelBadge from '@/components/stock-level-badge';
import RestockStatusBadge from '@/components/restock-status-badge';
import StatusBadge from '@/components/ui/status-badge';
import { formatDate } from '@/lib/format';

const OutletLocationMap = lazy(() => import('@/components/owner/outlet-location-map'));

export default function OutletShow({ outlet, inventoryHealth, activeDeliveriesCount, recentRestocks }: any) {
    const location = outlet.latitude && outlet.longitude ? { lat: Number(outlet.latitude), lng: Number(outlet.longitude) } : null;

    return (
        <OwnerPageShell
            title={outlet.name}
            subtitle="Detail outlet"
            backHref="/owner/outlets"
            headerRight={<Link href={`/owner/outlets/${outlet.id}/edit`} className="flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">Edit</Link>}
        >
            <div className="mx-auto max-w-5xl space-y-4">
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Detail Cabang</p>
                            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{outlet.name}</h1>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{outlet.address}</p>
                        </div>
                        <StatusBadge
                            variant={outlet.status === 'active' && Number(outlet.low_stock_count) > 0 ? 'warning' : outlet.status === 'active' ? 'success' : 'neutral'}
                        >
                            {outlet.status === 'active' && Number(outlet.low_stock_count) > 0 ? 'Stok Rendah' : outlet.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        </StatusBadge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <Metric label="Pesanan Aktif" value={outlet.active_orders_count} />
                        <Metric label="Pengiriman Aktif" value={activeDeliveriesCount} />
                        <Metric label="Stok Rendah" value={outlet.low_stock_count} warn={Number(outlet.low_stock_count) > 0} />
                        <Metric label="Pesanan Hari Ini" value={outlet.today_orders_count} />
                    </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <h2 className="text-base font-semibold text-slate-900">Lokasi</h2>
                    <p className="mt-1 text-xs text-slate-500">{outlet.kelurahan} · {outlet.kecamatan}{outlet.city ? ` · ${outlet.city}` : ''}</p>
                    <div className="mt-3">
                        <Suspense fallback={<div className="flex h-[280px] items-center justify-center rounded-xl border border-slate-300 bg-[#F8FAFC] text-xs font-semibold text-slate-500">Memuat peta...</div>}>
                            <OutletLocationMap value={location} onChange={() => undefined} readOnly />
                        </Suspense>
                    </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-base font-semibold text-slate-900">Kesehatan Inventaris</h2>
                        <Link href={`/owner/inventories?outlet_id=${outlet.id}`} className="text-xs font-semibold text-emerald-700">Inventaris</Link>
                    </div>
                    <div className="mt-3 space-y-2">
                        {inventoryHealth.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">Belum ada inventaris.</p>
                        ) : inventoryHealth.map((inventory: any) => (
                            <div key={inventory.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-[#F8FAFC] p-3">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-slate-900">{inventory.product.name}</div>
                                    <div className="mt-0.5 text-xs text-slate-500 tabular-nums">Tersedia {Number(inventory.current_stock) - Number(inventory.reserved_stock)} · Saat Ini {inventory.current_stock}</div>
                                </div>
                                <StockLevelBadge currentStock={inventory.current_stock} reservedStock={inventory.reserved_stock} minimumStock={inventory.minimum_stock} />
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-base font-semibold text-slate-900">Restock Terbaru</h2>
                        <Link href={`/owner/restocks?outlet_id=${outlet.id}`} className="text-xs font-semibold text-emerald-700">Restock</Link>
                    </div>
                    <div className="mt-3 space-y-2">
                        {recentRestocks.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">Belum ada restock.</p>
                        ) : recentRestocks.map((restock: any) => (
                            <Link key={restock.id} href={`/owner/restocks/${restock.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-[#F8FAFC] p-3">
                                <div>
                                    <div className="text-sm font-semibold text-slate-900">Restock #{restock.id}</div>
                                    <div className="mt-0.5 text-xs text-slate-500">{formatDate(restock.created_at)}</div>
                                </div>
                                <RestockStatusBadge status={restock.status} />
                            </Link>
                        ))}
                    </div>
                </section>
            </div>
        </OwnerPageShell>
    );
}

function Metric({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
    return (
        <div className={`rounded-lg border p-3 ${warn ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-[#F8FAFC] text-slate-700'}`}>
            <div className="text-lg font-semibold tabular-nums">{value ?? 0}</div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
        </div>
    );
}
