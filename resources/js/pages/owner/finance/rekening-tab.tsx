import { router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';

interface PaymentAccount {
    id: number;
    bank_name: string;
    account_number: string;
    account_holder: string;
    is_active: boolean;
}

export default function RekeningTab({ accounts }: { accounts: PaymentAccount[] }) {
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

    const { data, setData, post, put, processing, errors, reset } = useForm({
        bank_name: '',
        account_number: '',
        account_holder: '',
        is_active: true,
    });

    if (accounts === undefined) {
        return <SkeletonPage />;
    }

    const activeCount = accounts.filter((a) => a.is_active).length;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            put(`/owner/finance/payment-accounts/${editingId}`, {
                onSuccess: () => {
                    reset();
                    setShowForm(false);
                    setEditingId(null);
                },
            });
        } else {
            post('/owner/finance/payment-accounts', {
                onSuccess: () => {
                    reset();
                    setShowForm(false);
                },
            });
        }
    };

    const handleEdit = (account: PaymentAccount) => {
        setEditingId(account.id);
        setData({
            bank_name: account.bank_name,
            account_number: account.account_number,
            account_holder: account.account_holder,
            is_active: account.is_active,
        });
        setShowForm(true);
    };

    const handleDeleteClick = (id: number) => {
        setDeleteTargetId(id);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (!deleteTargetId) return;
        setDeleteDialogOpen(false);
        router.delete(`/owner/finance/payment-accounts/${deleteTargetId}`, {
            onFinish: () => setDeleteTargetId(null),
        });
    };

    const handleToggle = () => {
        reset();
        setEditingId(null);
        setShowForm(!showForm);
    };

    return (
        <>
            <OwnerKpiStrip items={[
                { label: 'Total Rekening', value: accounts.length },
                { label: 'Aktif', value: activeCount },
            ]} />

            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text">Rekening Pembayaran</h2>
                <Button size="sm" onClick={handleToggle}>
                    {showForm ? 'Batal' : 'Tambah Rekening'}
                </Button>
            </div>

            {showForm && (
                <div className="mb-4 rounded-lg border border-border bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-text">
                        {editingId ? 'Edit Rekening' : 'Tambah Rekening'}
                    </h3>
                    <form onSubmit={handleSubmit}>
                        <AccountForm data={data} setData={setData} errors={errors} processing={processing} editingId={editingId} />
                    </form>
                </div>
            )}

            {accounts.length === 0 ? (
                <EmptyState
                    title="Belum ada rekening"
                    description="Tambah rekening pembayaran untuk menerima pembayaran outlet."
                    action={{ label: 'Tambah Rekening', onClick: handleToggle }}
                />
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[600px]">
                        <thead>
                            <tr className="bg-surface-muted">
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Bank</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">No. Rekening</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Pemilik</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accounts.map((account) => (
                                <tr key={account.id} className="border-t border-border transition-colors hover:bg-surface-muted">
                                    <td className="px-4 py-3 font-bold text-text">{account.bank_name}</td>
                                    <td className="px-4 py-3 tabular-nums text-text-muted">{account.account_number}</td>
                                    <td className="px-4 py-3 text-text-muted">a.n. {account.account_holder}</td>
                                    <td className="px-4 py-3">
                                        <StatusBadge variant={account.is_active ? 'success' : 'neutral'} size="sm">
                                            {account.is_active ? 'Aktif' : 'Nonaktif'}
                                        </StatusBadge>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleEdit(account)}>
                                                Edit
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(account.id)} className="text-red-600 hover:text-red-700">
                                                Hapus
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus Rekening</DialogTitle>
                        <DialogDescription>Rekening ini akan dihapus. Tindakan ini tidak dapat dibatalkan.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
                        <Button variant="destructive" onClick={handleDeleteConfirm}>Hapus</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function AccountForm({ data, setData, errors, processing, editingId }: {
    data: { bank_name: string; account_number: string; account_holder: string; is_active: boolean };
    setData: (key: string, value: any) => void;
    errors: Record<string, string>;
    processing: boolean;
    editingId: number | null;
}) {
    return (
        <div className="space-y-3">
            <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Nama Bank</label>
                <Input
                    type="text"
                    value={data.bank_name}
                    onChange={(e) => setData('bank_name', e.target.value)}
                    required
                    placeholder="BCA, Mandiri, BRI..."
                />
                {errors.bank_name && <p className="mt-1 text-xs text-red-600">{errors.bank_name}</p>}
            </div>
            <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Nomor Rekening</label>
                <Input
                    type="text"
                    value={data.account_number}
                    onChange={(e) => setData('account_number', e.target.value)}
                    required
                    placeholder="1234567890"
                />
                {errors.account_number && <p className="mt-1 text-xs text-red-600">{errors.account_number}</p>}
            </div>
            <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Nama Pemilik</label>
                <Input
                    type="text"
                    value={data.account_holder}
                    onChange={(e) => setData('account_holder', e.target.value)}
                    required
                    placeholder="PT Dombi Indonesia"
                />
                {errors.account_holder && <p className="mt-1 text-xs text-red-600">{errors.account_holder}</p>}
            </div>
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="is_active"
                    checked={data.is_active}
                    onChange={(e) => setData('is_active', e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                />
                <label htmlFor="is_active" className="text-sm text-text">Aktif</label>
            </div>
            <Button type="submit" disabled={processing} className="w-full">
                {processing ? 'Menyimpan...' : editingId ? 'Perbarui' : 'Simpan'}
            </Button>
        </div>
    );
}
