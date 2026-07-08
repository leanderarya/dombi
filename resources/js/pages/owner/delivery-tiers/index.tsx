import { router, useForm } from '@inertiajs/react';
import { Edit2, GripVertical, Plus, Trash2, Truck } from 'lucide-react';
import { useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { formatCurrency } from '@/lib/format';

interface DeliveryTier {
    id: number;
    min_km: number;
    max_km: number;
    fee: number;
    is_active: boolean;
    sort_order: number;
}

export default function DeliveryTiersIndex({ tiers }: { tiers: DeliveryTier[] }) {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);

    return (
        <OwnerPageShell
            title="Pengaturan Ongkir"
            subtitle="Kelola tarif pengiriman berdasarkan jarak"
            headerRight={
                <button
                    type="button"
                    onClick={() => {
 setShowForm(true); setEditingId(null); 
}}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white active:opacity-80"
                >
                    <Plus className="h-4 w-4" />
                    Tambah Tier
                </button>
            }
        >
            {/* Tier List */}
            <div className="rounded-lg border border-border bg-white">
                <div className="grid grid-cols-12 gap-4 border-b border-border px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-subtle">
                    <div className="col-span-1" />
                    <div className="col-span-3">Jarak</div>
                    <div className="col-span-3">Tarif</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-3 text-right">Aksi</div>
                </div>

                {tiers.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                        <Truck className="mx-auto h-8 w-8 text-text-subtle" />
                        <p className="mt-2 text-sm text-text-muted">Belum ada tier ongkir</p>
                        <p className="mt-1 text-xs text-text-subtle">Tambah tier untuk mengatur tarif pengiriman</p>
                    </div>
                ) : (
                    tiers.map((tier) => (
                        <TierRow
                            key={tier.id}
                            tier={tier}
                            isEditing={editingId === tier.id}
                            onEdit={() => {
 setEditingId(tier.id); setShowForm(true); 
}}
                            onCancel={() => {
 setEditingId(null); setShowForm(false); 
}}
                        />
                    ))
                )}
            </div>

            {/* Info box */}
            <div className="mt-4 rounded-lg border border-border bg-white p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Cara Kerja</h3>
                <ul className="mt-2 space-y-1.5 text-xs text-text-muted">
                    <li>Tier diurutkan berdasarkan jarak (sort_order). Sistem mencocokkan dari tier pertama.</li>
                    <li>Jika jarak pelanggan melebihi tier terakhir, pesanan dianggap di luar jangkauan.</li>
                    <li>Nonaktifkan tier untuk menonaktifkan sementara tanpa menghapus.</li>
                </ul>
            </div>
        </OwnerPageShell>
    );
}

function TierRow({ tier, isEditing, onEdit, onCancel }: { tier: DeliveryTier; isEditing: boolean; onEdit: () => void; onCancel: () => void }) {
    const form = useForm({
        min_km: String(tier.min_km),
        max_km: String(tier.max_km),
        fee: String(tier.fee),
        is_active: tier.is_active,
        sort_order: tier.sort_order,
    });

    const handleSave = () => {
        form.put(`/owner/delivery-tiers/${tier.id}`, {
            onSuccess: () => onCancel(),
        });
    };

    const handleDelete = () => {
        if (!confirm('Hapus tier ini?')) {
return;
}

        router.delete(`/owner/delivery-tiers/${tier.id}`);
    };

    const handleToggle = () => {
        router.patch(`/owner/delivery-tiers/${tier.id}/toggle`);
    };

    if (isEditing) {
        return (
            <div className="grid grid-cols-12 items-center gap-4 border-b border-border/50 bg-emerald-50/30 px-4 py-3">
                <div className="col-span-1" />
                <div className="col-span-3 flex items-center gap-2">
                    <input
                        type="number"
                        step="0.01"
                        value={form.data.min_km}
                        onChange={(e) => form.setData('min_km', e.target.value)}
                        className="w-20 rounded border border-border px-2 py-1.5 text-xs"
                        placeholder="Min"
                    />
                    <span className="text-xs text-text-muted">–</span>
                    <input
                        type="number"
                        step="0.01"
                        value={form.data.max_km}
                        onChange={(e) => form.setData('max_km', e.target.value)}
                        className="w-20 rounded border border-border px-2 py-1.5 text-xs"
                        placeholder="Max"
                    />
                    <span className="text-xs text-text-muted">km</span>
                </div>
                <div className="col-span-3">
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-text-muted">Rp</span>
                        <input
                            type="number"
                            step="500"
                            value={form.data.fee}
                            onChange={(e) => form.setData('fee', e.target.value)}
                            className="w-28 rounded border border-border px-2 py-1.5 text-xs"
                            placeholder="Tarif"
                        />
                    </div>
                </div>
                <div className="col-span-2">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={form.data.is_active}
                            onChange={(e) => form.setData('is_active', e.target.checked)}
                            className="h-4 w-4 rounded border-border"
                        />
                        <span className="text-xs text-text-muted">Aktif</span>
                    </label>
                </div>
                <div className="col-span-3 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={form.processing}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white active:opacity-80 disabled:opacity-50"
                    >
                        Simpan
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text active:opacity-80"
                    >
                        Batal
                    </button>
                </div>
                {Object.keys(form.errors).length > 0 && (
                    <div className="col-span-12 mt-1">
                        {Object.values(form.errors).map((err, i) => (
                            <p key={i} className="text-xs text-red-600">{err}</p>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`grid grid-cols-12 items-center gap-4 border-b border-border/50 px-4 py-3 transition-colors ${!tier.is_active ? 'opacity-50' : ''}`}>
            <div className="col-span-1">
                <GripVertical className="h-4 w-4 text-text-subtle" />
            </div>
            <div className="col-span-3 text-sm font-medium text-text">
                {tier.min_km} – {tier.max_km} km
            </div>
            <div className="col-span-3 text-sm font-bold tabular-nums text-text">
                {formatCurrency(tier.fee)}
            </div>
            <div className="col-span-2">
                <button
                    type="button"
                    onClick={handleToggle}
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        tier.is_active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-zinc-100 text-zinc-500'
                    }`}
                >
                    {tier.is_active ? 'Aktif' : 'Nonaktif'}
                </button>
            </div>
            <div className="col-span-3 flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={onEdit}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text active:opacity-80"
                >
                    <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={handleDelete}
                    className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-500 active:opacity-80"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}
