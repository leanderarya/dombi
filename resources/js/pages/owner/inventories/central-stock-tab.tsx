import { router } from '@inertiajs/react';
import { useState } from 'react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerModalShell from '@/components/owner/owner-modal-shell';
import { formatCurrency } from '@/lib/format';

export default function CentralStockTab({ variants, stats }: { variants?: any[]; stats?: any }) {
    const [search, setSearch] = useState('');
    const [stockFilter, setStockFilter] = useState<'all' | 'zero' | 'low'>('all');
    const [editModal, setEditModal] = useState<any>(null);
    const [newStock, setNewStock] = useState('');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    if (!variants || !stats) {
        return <div className="h-20 animate-pulse rounded-lg border border-border bg-white" />;
    }

    const filtered = variants.filter((v) => {
        if (search) {
            const q = search.toLowerCase();

            if (!v.name.toLowerCase().includes(q) && !(v.sku ?? '').toLowerCase().includes(q)) {
                return false;
            }
        }

        if (stockFilter === 'zero' && v.center_stock > 0) {
 return false;
}

        if (stockFilter === 'low' && (v.center_stock <= 0 || v.center_stock > 10)) {
 return false;
}

        return true;
    });

    return (
        <>
            {/* Filter controls */}
            <OwnerFilterCard
                searchPlaceholder="Cari produk atau SKU..."
                searchValue={search}
                onSearch={(val) => setSearch(val)}
            />

            {/* KPI Strip */}
            <OwnerKpiStrip items={[
                { label: 'Total Variant', value: stats.total_variants },
                { label: 'Total Stok', value: `${stats.total_stock} pcs` },
                { label: 'Stok Habis', value: stats.zero_stock, sublabel: stats.zero_stock > 0 ? 'Perlu tindakan' : undefined, sublabelColor: 'text-red-500' },
                { label: 'Stok Rendah', value: stats.low_stock, sublabel: stats.low_stock > 0 ? 'Perlu tindakan' : undefined, sublabelColor: 'text-amber-500' },
            ]} />

            {/* Table */}
            {filtered.length === 0 ? (
                <div className="rounded-lg border border-border bg-white py-10 text-center text-xs text-text-muted">
                    Tidak ada produk ditemukan
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                    <div className="grid grid-cols-[1fr_80px_100px_80px] items-center gap-3 bg-[#fafafa] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                        <span>Produk / SKU</span><span className="text-right">Stok</span><span className="text-right">HPP</span><span />
                    </div>
                    {filtered.map((v) => {
                        const isZero = v.center_stock <= 0;
                        const isLow = v.center_stock > 0 && v.center_stock <= 10;

                        return (
                            <div key={v.id}
                                className="grid grid-cols-[1fr_80px_100px_80px] items-center gap-3 border-t border-[#f0f0f0] px-3 py-2 text-sm transition-colors last:border-t-0 hover:bg-surface-muted">
                                <span className="truncate">
                                    {v.family_name && <span className="text-text-subtle">{v.family_name} </span>}
                                    <span className="font-bold text-text">{v.name}</span>
                                    {v.sku && <span className="ml-1 text-xs text-text-muted">{v.sku}</span>}
                                </span>
                                <span className={`text-right font-bold tabular-nums ${isZero ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {v.center_stock} pcs
                                </span>
                                <span className="text-right text-text-muted">{formatCurrency(v.center_price)}</span>
                                <div className="flex items-center gap-1 justify-end">
                                    <button type="button" onClick={() => {
 setEditModal(v); setNewStock(String(v.center_stock)); setReason(''); 
}}
                                        className="rounded-md px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary-light">
                                        Edit
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Edit Modal */}
            <OwnerModalShell
                open={!!editModal}
                onClose={() => setEditModal(null)}
                title="Edit Stok Pusat"
                subtitle={editModal?.name}
                maxWidth="max-w-sm"
            >
                <div className="space-y-3">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-text-muted">Stok Saat Ini</label>
                        <div className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-text-muted">
                            {editModal?.center_stock} pcs
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-text-muted">Stok Baru</label>
                        <input
                            type="number"
                            value={newStock}
                            onChange={(e) => setNewStock(e.target.value)}
                            min="0"
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-text-muted">Alasan</label>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                        >
                            <option value="">Pilih alasan...</option>
                            <option value="Stok opname">Stok Opname</option>
                            <option value="Produk rusak">Produk Rusak</option>
                            <option value="Produk expired">Produk Expired</option>
                            <option value="Penerimaan supplier">Penerimaan Supplier</option>
                            <option value="Koreksi manual">Koreksi Manual</option>
                        </select>
                    </div>
                </div>

                <div className="mt-6 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setEditModal(null)}
                        className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text hover:bg-surface-muted"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setSaving(true);
                            router.patch(`/owner/inventories/central-stock/${editModal.id}`, {
                                center_stock: parseInt(newStock),
                                reason: reason || undefined,
                            }, {
                                onFinish: () => {
                                    setSaving(false);
                                    setEditModal(null);
                                },
                            });
                        }}
                        disabled={saving || parseInt(newStock) === editModal.center_stock}
                        className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                        {saving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                </div>
            </OwnerModalShell>
        </>
    );
}
