import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import InventoryAdjustmentSheet from '@/components/owner/inventory-adjustment-sheet';
import OwnerBottomNav from '@/components/owner/owner-bottom-nav';
import OwnerMobileHeader, { HeaderIconButton, SearchIcon } from '@/components/owner/owner-mobile-header';
import OfflineBanner from '@/components/offline-banner';
import OwnerLayout from '@/layouts/owner-layout';

export default function InventoriesIndex({ outletSections, stats }: any) {
    return (
        <>
            <div className="hidden lg:block">
                <OwnerLayout><DesktopView outletSections={outletSections} stats={stats} /></OwnerLayout>
            </div>
            <div className="lg:hidden">
                <MobileView outletSections={outletSections} stats={stats} />
            </div>
        </>
    );
}

function MobileView({ outletSections, stats }: any) {
    const [adjustItem, setAdjustItem] = useState<any>(null);

    return (
        <div className="min-h-dvh bg-slate-50 text-slate-900">
            <Head title="Inventory" />
            <OfflineBanner />

            <OwnerMobileHeader title="Inventory" actions={<HeaderIconButton label="Search"><SearchIcon /></HeaderIconButton>} />

            <main className="px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
                {/* Global KPI */}
                <div className="grid grid-cols-4 gap-2">
                    <KpiMini label="Total SKU" value={stats.totalSku} />
                    <KpiMini label="Low Stock" value={stats.lowStock} color="amber" />
                    <KpiMini label="Reserved" value={stats.totalReserved} color="blue" />
                    <KpiMini label="Critical" value={stats.critical} color="red" />
                </div>

                {/* Outlet Sections */}
                <div className="mt-5 space-y-5">
                    {outletSections.map((section: any) => (
                        <OutletSection key={section.outlet.id} section={section} onAdjust={setAdjustItem} />
                    ))}
                </div>

                {outletSections.length === 0 && (
                    <div className="mt-8 flex flex-col items-center py-10 text-center">
                        <span className="text-3xl">📦</span>
                        <p className="mt-2 text-sm font-semibold text-slate-600">Tidak ada outlet aktif</p>
                    </div>
                )}
            </main>

            <OwnerBottomNav />
            <InventoryAdjustmentSheet item={adjustItem} open={!!adjustItem} onClose={() => setAdjustItem(null)} />
        </div>
    );
}

function DesktopView({ outletSections, stats }: any) {
    return (
        <>
            <Head title="Inventory" />
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Inventory Board</h1>
                <Link href="/owner/inventories/create" className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white">Tambah Stok</Link>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-3">
                <KpiMini label="Total SKU" value={stats.totalSku} />
                <KpiMini label="Low Stock" value={stats.lowStock} color="amber" />
                <KpiMini label="Reserved" value={stats.totalReserved} color="blue" />
                <KpiMini label="Critical" value={stats.critical} color="red" />
            </div>
            <div className="mt-5 space-y-5">
                {outletSections.map((section: any) => (
                    <OutletSection key={section.outlet.id} section={section} />
                ))}
            </div>
        </>
    );
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function OutletSection({ section, onAdjust }: { section: any; onAdjust?: (item: any) => void }) {
    const healthConfig = {
        healthy: { label: 'Healthy', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
        low_stock: { label: 'Low Stock', color: 'text-amber-700 bg-amber-50 border-amber-200' },
        critical: { label: 'Critical', color: 'text-red-700 bg-red-50 border-red-200' },
    };
    const config = healthConfig[section.health as keyof typeof healthConfig] ?? healthConfig.healthy;

    return (
        <div className="rounded-2xl border border-slate-200 bg-white">
            {/* Outlet Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                    <div className="text-sm font-bold text-slate-900">{section.outlet.name}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                        {section.totalSku} SKU · {section.totalReserved} reserved
                        {section.critical > 0 && <span className="ml-1 text-red-600">· {section.critical} critical</span>}
                    </div>
                </div>
                <span className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${config.color}`}>
                    {config.label}
                </span>
            </div>

            {/* SKU List */}
            <div className="divide-y divide-slate-50">
                {section.inventories.map((item: any) => (
                    <SkuRow key={item.id} item={item} onAdjust={onAdjust ? () => onAdjust(item) : undefined} />
                ))}
            </div>

            {/* Outlet Actions */}
            {section.inventories.length > 0 && (
                <div className="flex gap-2 border-t border-slate-100 px-4 py-2.5">
                    <Link href={`/owner/restocks?outlet_id=${section.outlet.id}`} className="flex-1 rounded-lg border border-slate-200 py-2 text-center text-[10px] font-semibold text-slate-600 transition-all duration-150 active:scale-[0.98] active:bg-slate-50">
                        Restock
                    </Link>
                    <Link href="/owner/stock-movements" className="flex-1 rounded-lg border border-slate-200 py-2 text-center text-[10px] font-semibold text-slate-600 transition-all duration-150 active:scale-[0.98] active:bg-slate-50">
                        Movements
                    </Link>
                </div>
            )}
        </div>
    );
}

function SkuRow({ item, onAdjust }: { item: any; onAdjust?: () => void }) {
    const available = item.current_stock - item.reserved_stock;
    const isLow = available <= item.minimum_stock;
    const isCritical = available <= 0;
    const isWarning = item.reserved_stock > item.current_stock * 0.5;

    return (
        <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-900">{item.product?.name ?? '-'}</div>
                <div className={`mt-0.5 text-[10px] ${isWarning ? 'text-amber-600' : 'text-slate-400'}`}>
                    {isWarning && '⚠ '}R:{item.reserved_stock} / C:{item.current_stock}
                </div>
            </div>
            <div className="text-right">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Avail</div>
                <div className={`text-lg font-bold tabular-nums ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                    {available}
                </div>
            </div>
            {onAdjust ? (
                <button onClick={onAdjust} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-all duration-150 active:scale-[0.95] active:bg-slate-50">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
            ) : (
                <Link href={`/owner/inventories/${item.id}/edit`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-all duration-150 active:scale-[0.95] active:bg-slate-50">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </Link>
            )}
        </div>
    );
}

function KpiMini({ label, value, color }: { label: string; value: number; color?: string }) {
    const textColor = color === 'red' ? 'text-red-600' : color === 'amber' ? 'text-amber-600' : color === 'blue' ? 'text-blue-600' : 'text-slate-900';
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
            <div className={`mt-0.5 text-xl font-bold tabular-nums ${textColor}`}>{value}</div>
        </div>
    );
}
