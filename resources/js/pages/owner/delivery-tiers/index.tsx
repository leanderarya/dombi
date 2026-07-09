import { router, useForm } from '@inertiajs/react';
import { Edit2, GripVertical, Plus, Trash2, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
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
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editingTier, setEditingTier] = useState<DeliveryTier | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const addForm = useForm({
        min_km: '',
        max_km: '',
        fee: '',
        sort_order: '0',
    });

    const editForm = useForm({
        min_km: '',
        max_km: '',
        fee: '',
        sort_order: '0',
        is_active: true,
    });

    useEffect(() => {
        if (editingTier) {
            editForm.setData({
                min_km: String(editingTier.min_km),
                max_km: String(editingTier.max_km),
                fee: String(editingTier.fee),
                sort_order: String(editingTier.sort_order),
                is_active: editingTier.is_active,
            });
        }
    }, [editingTier]);

    if (tiers === undefined || tiers === null) {
        return (
            <OwnerPageShell title="Pengaturan Ongkir" subtitle="Kelola tarif pengiriman berdasarkan jarak">
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    const handleAddSubmit = () => {
        addForm.post('/owner/delivery-tiers', {
            onSuccess: () => {
                setAddDialogOpen(false);
                addForm.reset();
            },
        });
    };

    const handleEditSubmit = () => {
        if (!editingTier) return;
        editForm.put(`/owner/delivery-tiers/${editingTier.id}`, {
            onSuccess: () => setEditingTier(null),
        });
    };

    const handleDelete = () => {
        if (deleteId) {
            router.delete(`/owner/delivery-tiers/${deleteId}`, {
                onSuccess: () => setDeleteId(null),
            });
        }
    };

    const handleToggle = (tierId: number) => {
        router.patch(`/owner/delivery-tiers/${tierId}/toggle`);
    };

    return (
        <OwnerPageShell
            title="Pengaturan Ongkir"
            subtitle="Kelola tarif pengiriman berdasarkan jarak"
            headerRight={
                <Button onClick={() => { setAddDialogOpen(true); addForm.reset(); }}>
                    <Plus className="h-4 w-4 mr-1" />
                    Tambah Tier
                </Button>
            }
        >
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
                                <tr
                                    key={tier.id}
                                    className={`border-t border-border transition-colors hover:bg-surface-muted ${!tier.is_active ? 'opacity-50' : ''}`}
                                >
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
                                            onClick={() => handleToggle(tier.id)}
                                            className="inline-flex"
                                        >
                                            <StatusBadge variant={tier.is_active ? 'success' : 'muted'} size="sm">
                                                {tier.is_active ? 'Aktif' : 'Nonaktif'}
                                            </StatusBadge>
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button size="sm" variant="ghost" onClick={() => setEditingTier(tier)}>
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => setDeleteId(tier.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="mt-4 rounded-lg border border-border bg-white p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Cara Kerja</h3>
                <ul className="mt-2 space-y-1.5 text-xs text-text-muted">
                    <li>Tier diurutkan berdasarkan jarak (sort_order). Sistem mencocokkan dari tier pertama.</li>
                    <li>Jika jarak pelanggan melebihi tier terakhir, pesanan dianggap di luar jangkauan.</li>
                    <li>Nonaktifkan tier untuk menonaktifkan sementara tanpa menghapus.</li>
                </ul>
            </div>

            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tambah Tier Baru</DialogTitle>
                        <DialogDescription>Atur tarif pengiriman berdasarkan jarak.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs text-text-muted">Min KM</label>
                            <Input
                                type="number"
                                step="0.01"
                                value={addForm.data.min_km}
                                onChange={(e) => addForm.setData('min_km', e.target.value)}
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-text-muted">Max KM</label>
                            <Input
                                type="number"
                                step="0.01"
                                value={addForm.data.max_km}
                                onChange={(e) => addForm.setData('max_km', e.target.value)}
                                placeholder="5"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-text-muted">Tarif (Rp)</label>
                            <Input
                                type="number"
                                step="500"
                                value={addForm.data.fee}
                                onChange={(e) => addForm.setData('fee', e.target.value)}
                                placeholder="10000"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-text-muted">Urutan</label>
                            <Input
                                type="number"
                                value={addForm.data.sort_order}
                                onChange={(e) => addForm.setData('sort_order', e.target.value)}
                                placeholder="0"
                            />
                        </div>
                    </div>
                    {Object.keys(addForm.errors).length > 0 && (
                        <div className="mt-2">
                            {Object.values(addForm.errors).map((err, i) => (
                                <p key={i} className="text-xs text-red-600">{err}</p>
                            ))}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleAddSubmit} disabled={addForm.processing}>
                            {addForm.processing ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={editingTier !== null} onOpenChange={(open) => { if (!open) setEditingTier(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Tier</DialogTitle>
                        <DialogDescription>Ubah tarif pengiriman.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs text-text-muted">Min KM</label>
                            <Input
                                type="number"
                                step="0.01"
                                value={editForm.data.min_km}
                                onChange={(e) => editForm.setData('min_km', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-text-muted">Max KM</label>
                            <Input
                                type="number"
                                step="0.01"
                                value={editForm.data.max_km}
                                onChange={(e) => editForm.setData('max_km', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-text-muted">Tarif (Rp)</label>
                            <Input
                                type="number"
                                step="500"
                                value={editForm.data.fee}
                                onChange={(e) => editForm.setData('fee', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-text-muted">Urutan</label>
                            <Input
                                type="number"
                                value={editForm.data.sort_order}
                                onChange={(e) => editForm.setData('sort_order', e.target.value)}
                            />
                        </div>
                    </div>
                    <label className="mt-2 flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={editForm.data.is_active}
                            onChange={(e) => editForm.setData('is_active', e.target.checked)}
                            className="h-4 w-4 rounded border-border"
                        />
                        <span className="text-xs text-text-muted">Aktif</span>
                    </label>
                    {Object.keys(editForm.errors).length > 0 && (
                        <div className="mt-2">
                            {Object.values(editForm.errors).map((err, i) => (
                                <p key={i} className="text-xs text-red-600">{err}</p>
                            ))}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingTier(null)}>Batal</Button>
                        <Button onClick={handleEditSubmit} disabled={editForm.processing}>
                            {editForm.processing ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
