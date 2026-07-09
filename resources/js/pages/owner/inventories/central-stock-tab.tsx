import { router } from '@inertiajs/react';
import { useState } from 'react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';

const reasonOptions = [
    { value: 'Stok opname', label: 'Stok Opname' },
    { value: 'Produk rusak', label: 'Produk Rusak' },
    { value: 'Produk expired', label: 'Produk Expired' },
    { value: 'Penerimaan supplier', label: 'Penerimaan Supplier' },
    { value: 'Koreksi manual', label: 'Koreksi Manual' },
];

export default function CentralStockTab({ variants, stats }: { variants?: any[]; stats?: any }) {
    const [search, setSearch] = useState('');
    const [editModal, setEditModal] = useState<any>(null);
    const [newStock, setNewStock] = useState('');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    if (!variants || !stats) {
        return <div className="h-20 animate-pulse rounded-lg border border-border bg-white" />;
    }

    const filtered = variants.filter((v) => {
        if (!v) {
return false;
}

        if (search) {
            const q = search.toLowerCase();

            if (!v.name.toLowerCase().includes(q) && !(v.sku ?? '').toLowerCase().includes(q)) {
                return false;
            }
        }

        return true;
    });

    return (
        <>
            <OwnerKpiStrip items={[
                { label: 'Total Variant', value: stats.total_variants },
                { label: 'Total Stok', value: `${stats.total_stock} pcs` },
                { label: 'Stok Habis', value: stats.zero_stock, sublabel: stats.zero_stock > 0 ? 'Perlu tindakan' : undefined, sublabelColor: 'text-red-500' },
                { label: 'Stok Rendah', value: stats.low_stock, sublabel: stats.low_stock > 0 ? 'Perlu tindakan' : undefined, sublabelColor: 'text-amber-500' },
            ]} />

            <OwnerFilterCard
                collapsible
                defaultExpanded={false}
                searchPlaceholder="Cari produk atau SKU..."
                searchValue={search}
                onSearch={(val) => setSearch(val)}
            />

            {filtered.length === 0 ? (
                <EmptyState
                    title="Tidak ada produk ditemukan"
                    description="Coba ubah kata kunci pencarian"
                />
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                    <table className="w-full min-w-[600px]" aria-label="Stok Pusat">
                        <thead>
                            <tr className="bg-surface-muted">
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Produk / SKU</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Stok</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">HPP</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((v) => {
                                const isZero = v.center_stock <= 0;
                                const isLow = v.center_stock > 0 && v.center_stock <= 10;

                                return (
                                    <tr key={v.id} className="border-t border-border transition-colors hover:bg-surface-muted">
                                        <td className="px-4 py-3">
                                            {v.family_name && <span className="text-text-subtle">{v.family_name} </span>}
                                            <span className="font-bold text-text">{v.name}</span>
                                            {v.sku && <span className="ml-1 text-xs text-text-muted">{v.sku}</span>}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold tabular-nums ${isZero ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600'}`}>
                                            {v.center_stock} pcs
                                        </td>
                                        <td className="px-4 py-3 text-right text-text-muted">{formatCurrency(v.center_price)}</td>
                                        <td className="px-4 py-3">
                                            <StatusBadge variant={isZero ? 'danger' : isLow ? 'warning' : 'success'} size="sm">
                                                {isZero ? 'Habis' : isLow ? 'Rendah' : 'Aman'}
                                            </StatusBadge>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setEditModal(v);
                                                        setNewStock(String(v.center_stock));
                                                        setReason('');
                                                    }}
                                                >
                                                    Edit
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <Dialog open={!!editModal} onOpenChange={(isOpen) => {
 if (!isOpen) {
setEditModal(null);
} 
}}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Edit Stok Pusat</DialogTitle>
                        <DialogDescription>{editModal?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-text-muted">Stok Saat Ini</label>
                            <div className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-text-muted">
                                {editModal?.center_stock} pcs
                            </div>
                        </div>
                        <Input
                            label="Stok Baru"
                            type="number"
                            value={newStock}
                            onChange={(e) => setNewStock(e.target.value)}
                            min={0}
                            autoFocus
                        />
                        <Select
                            label="Alasan"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            options={reasonOptions}
                            placeholder="Pilih alasan..."
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setEditModal(null)}>
                            Batal
                        </Button>
                        <Button
                            onClick={() => {
                                if (!editModal) {
return;
}

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
                            disabled={saving || parseInt(newStock) === editModal?.center_stock}
                            loading={saving}
                        >
                            Simpan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
