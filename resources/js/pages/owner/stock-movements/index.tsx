import { router } from '@inertiajs/react';
import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import FilterSheet from '@/components/owner/filter-sheet';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { HeaderIconButton, FilterIcon } from '@/components/owner/header-icon-utils';
import Pagination from '@/components/pagination';
import { formatDate } from '@/lib/format';

const typeLabels: Record<string, string> = { initial_stock: 'Stok Awal', stock_adjustment: 'Penyesuaian', order_reserved: 'Direservasi', order_completed: 'Selesai', order_cancelled: 'Dibatalkan', restock_in: 'Restock Masuk', delivery_returned: 'Dikembalikan' };
const typeColors: Record<string, string> = { initial_stock: 'text-slate-600', stock_adjustment: 'text-amber-700', order_reserved: 'text-blue-700', order_completed: 'text-emerald-700', order_cancelled: 'text-red-700', restock_in: 'text-emerald-700', delivery_returned: 'text-purple-700' };
const typeOptions = Object.entries(typeLabels).map(([k, v]) => ({ value: k, label: v }));

export default function StockMovementsIndex({ movements, outlets, products, filters }: any) {
    const [filterOpen, setFilterOpen] = useState(false);
    const activeFilterCount = [filters.outlet_id, filters.product_id, filters.type].filter(Boolean).length;

    const handleFilterApply = (f: Record<string, string>) => {
        router.get('/owner/stock-movements', { outlet_id: f.outlet_id || undefined, product_id: f.product_id || undefined, type: f.type || undefined, date_from: filters.date_from, date_to: filters.date_to }, { preserveState: true, replace: true });
    };

    return (
        <OwnerPageShell
            title="Riwayat Perubahan Stok"
            headerRight={
                <div className="relative">
                    <HeaderIconButton label="Filter" onClick={() => setFilterOpen(true)}><FilterIcon /></HeaderIconButton>
                    {activeFilterCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-0.5 text-[9px] font-bold text-white">{activeFilterCount}</span>}
                </div>
            }
        >
            {movements.data.length === 0 ? (
                <EmptyState icon={<ClipboardList className="h-8 w-8 text-slate-400" />} title="Belum ada movement" description="Perubahan stok akan tercatat di sini." />
            ) : (
                <div className="space-y-1.5">
                    {movements.data.map((m: any) => (
                        <div key={m.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                            <div className={`shrink-0 text-xs font-bold tabular-nums ${m.quantity >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                {m.quantity >= 0 ? '+' : ''}{m.quantity}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-xs font-semibold text-slate-900">{m.product?.name ?? '-'}</div>
                                <div className="mt-0.5 text-[10px] text-slate-400">{m.outlet?.name} · <span className={typeColors[m.type] ?? 'text-slate-500'}>{typeLabels[m.type] ?? m.type}</span></div>
                            </div>
                            <div className="shrink-0 text-right">
                                <div className="text-[10px] tabular-nums text-slate-500">{m.before_stock}→{m.after_stock}</div>
                                <div className="text-[9px] tabular-nums text-slate-400">{formatDate(m.created_at)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <Pagination links={movements.links} />

            <FilterSheet
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                sections={[
                    { key: 'outlet_id', label: 'Outlet', options: outlets.map((o: any) => ({ value: String(o.id), label: o.name })), value: filters.outlet_id ? String(filters.outlet_id) : '' },
                    { key: 'product_id', label: 'Produk', options: products.map((p: any) => ({ value: String(p.id), label: p.name })), value: filters.product_id ? String(filters.product_id) : '' },
                    { key: 'type', label: 'Tipe', options: typeOptions, value: filters.type ?? '' },
                ]}
                onApply={handleFilterApply}
            />
        </OwnerPageShell>
    );
}
