import { router, useForm } from '@inertiajs/react';
import { Edit2, GripVertical, Plus, Trash2, Truck } from 'lucide-react';
import { useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import EmptyState from '@/components/ui/empty-state';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
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
    const [deleteId, setDeleteId] = useState<number | null>(null);

    if (tiers === undefined || tiers === null) {
        return (
            <OwnerPageShell title="Pengaturan Ongkir" subtitle="Kelola tarif pengiriman berdasarkan jarak">
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    const handleDelete = () => {
        if (deleteId) {
            router.delete(`/owner/delivery-tiers/${deleteId}`, {
                onSuccess: () => setDeleteId(null),
            });
        }
    };

    return (
        <OwnerPageShell
            title="Pengaturan Ongkir"
            subtitle="Kelola tarif pengiriman berdasarkan jarak"
            headerRight={
                <Button
                    onClick={() => { setShowForm(true); setEditingId(null); }}
                >
                    <Plus className="h-4 w-4 mr-1" />
                    Tambah Tier
                </Button>
            }
        >
            {/* Add Form */}
            {showForm && !editingId && (
                <AddTierForm onCancel={() => setShowForm(false)} />
            )}

            {/* Tier List */}
            {tiers.length === 0 ? (
                <EmptyState
                    icon={<Truck className="h-8 w-8" />}
                    title="Belum ada tier ongkir"
                    description="Tambah tier untuk mengatur tarif pengiriman berdasarkan jarak"
                />
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[500px] text-sm">
                        <thead>
                            <tr className="bg-surface-muted text-xs font-semibold uppercase tracking-wide text-text-muted">
                                <th className="w-10 px-4 py-3"></th>
                                <th className="px-4 py-3 text-left">Jarak</th>
                                <th className="px-4 py-3 text-left">Tarif</th>
                                <th className="px-4 py-3 text-left">Status</th>
                                <th className="px-4 py-3 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tiers.map((tier) => (
                                <TierRow
                                    key={tier.id}
                                    tier={tier}
                                    isEditing={editingId === tier.id}
                                    onEdit={() => { setEditingId(tier.id); setShowForm(false); }}
                                    onCancel={() => { setEditingId(null); }}
                                    onDelete={() => setDeleteId(tier.id)}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Info box */}
            <div className="mt-4 rounded-lg border border-border bg-white p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Cara Kerja</h3>
                <ul className="mt-2 space-y-1.5 text-xs text-text-muted">
                    <li>Tier diurutkan berdasarkan jarak (sort_order). Sistem mencocokkan dari tier pertama.</li>
                    <li>Jika jarak pelanggan melebihi tier terakhir, pesanan dianggap di luar jangkauan.</li>
                    <li>Nonaktifkan tier untuk menonaktifkan sementara tanpa menghapus.</li>
                </ul>
            </div>

            {/* Delete Dialog */}
            <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus Tier</DialogTitle>
                        <DialogDescription>Yakin ingin menghapus tier ongkir ini? Tindakan ini tidak dapat dibatalkan.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
                        <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OwnerPageShell>
    );
}

function AddTierForm({ onCancel }: { onCancel: () => void }) {
    const form = useForm({
        min_km: '',
        max_km: '',
        fee: '',
        sort_order: '0',
    });

    const handleSubmit = () => {
        form.post('/owner/delivery-tiers', {
            onSuccess: () => onCancel(),
        });
    };

    return (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/30 p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Tambah Tier Baru</div>
            <div className="flex flex-wrap items-end gap-3">
                <div>
                    <label className="mb-1 block text-xs text-text-muted">Min KM</label>
                    <Input
                        type="number"
                        step="0.01"
                        value={form.data.min_km}
                        onChange={(e) => form.setData('min_km', e.target.value)}
                        className="w-24"
                        placeholder="0"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs text-text-muted">Max KM</label>
                    <Input
                        type="number"
                        step="0.01"
                        value={form.data.max_km}
                        onChange={(e) => form.setData('max_km', e.target.value)}
                        className="w-24"
                        placeholder="5"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs text-text-muted">Tarif (Rp)</label>
                    <Input
                        type="number"
                        step="500"
                        value={form.data.fee}
                        onChange={(e) => form.setData('fee', e.target.value)}
                        className="w-32"
                        placeholder="10000"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs text-text-muted">Urutan</label>
                    <Input
                        type="number"
                        value={form.data.sort_order}
                        onChange={(e) => form.setData('sort_order', e.target.value)}
                        className="w-20"
                        placeholder="0"
                    />
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleSubmit} disabled={form.processing}>
                        {form.processing ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                    <Button variant="outline" onClick={onCancel}>Batal</Button>
                </div>
            </div>
            {Object.keys(form.errors).length > 0 && (
                <div className="mt-2">
                    {Object.values(form.errors).map((err, i) => (
                        <p key={i} className="text-xs text-red-600">{err}</p>
                    ))}
                </div>
            )}
        </div>
    );
}

function TierRow({ tier, isEditing, onEdit, onCancel, onDelete }: { tier: DeliveryTier; isEditing: boolean; onEdit: () => void; onCancel: () => void; onDelete: () => void }) {
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

    const handleToggle = () => {
        router.patch(`/owner/delivery-tiers/${tier.id}/toggle`);
    };

    if (isEditing) {
        return (
            <tr className="border-t border-border bg-emerald-50/30">
                <td className="px-4 py-3">
                    <GripVertical className="h-4 w-4 text-text-subtle" />
                </td>
                <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            step="0.01"
                            value={form.data.min_km}
                            onChange={(e) => form.setData('min_km', e.target.value)}
                            className="w-20"
                            placeholder="Min"
                        />
                        <span className="text-xs text-text-muted">–</span>
                        <Input
                            type="number"
                            step="0.01"
                            value={form.data.max_km}
                            onChange={(e) => form.setData('max_km', e.target.value)}
                            className="w-20"
                            placeholder="Max"
                        />
                        <span className="text-xs text-text-muted">km</span>
                    </div>
                </td>
                <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-text-muted">Rp</span>
                        <Input
                            type="number"
                            step="500"
                            value={form.data.fee}
                            onChange={(e) => form.setData('fee', e.target.value)}
                            className="w-28"
                            placeholder="Tarif"
                        />
                    </div>
                </td>
                <td className="px-4 py-3">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={form.data.is_active}
                            onChange={(e) => form.setData('is_active', e.target.checked)}
                            className="h-4 w-4 rounded border-border"
                        />
                        <span className="text-xs text-text-muted">Aktif</span>
                    </label>
                </td>
                <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                        <Button size="sm" onClick={handleSave} disabled={form.processing}>
                            {form.processing ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={onCancel}>Batal</Button>
                    </div>
                    {Object.keys(form.errors).length > 0 && (
                        <div className="mt-1">
                            {Object.values(form.errors).map((err, i) => (
                                <p key={i} className="text-xs text-red-600">{err}</p>
                            ))}
                        </div>
                    )}
                </td>
            </tr>
        );
    }

    return (
        <tr className={`border-t border-border transition-colors hover:bg-surface-muted ${!tier.is_active ? 'opacity-50' : ''}`}>
            <td className="px-4 py-3">
                <GripVertical className="h-4 w-4 text-text-subtle" />
            </td>
            <td className="px-4 py-3 font-medium text-text">
                {tier.min_km} – {tier.max_km} km
            </td>
            <td className="px-4 py-3 font-bold tabular-nums text-text">
                {formatCurrency(tier.fee)}
            </td>
            <td className="px-4 py-3">
                <button
                    type="button"
                    onClick={handleToggle}
                    className="inline-flex"
                >
                    <StatusBadge variant={tier.is_active ? 'success' : 'muted'} size="sm">
                        {tier.is_active ? 'Aktif' : 'Nonaktif'}
                    </StatusBadge>
                </button>
            </td>
            <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={onEdit}>
                        <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </td>
        </tr>
    );
}
