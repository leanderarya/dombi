import { useForm, router } from '@inertiajs/react';
import { useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';

interface PaymentAccount {
    id: number;
    bank_name: string;
    account_number: string;
    account_holder: string;
    is_active: boolean;
}

interface Props {
    accounts: PaymentAccount[];
}

export default function PaymentAccounts({ accounts }: Props) {
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const { data, setData, post, put, processing, errors, reset } = useForm({
        bank_name: '',
        account_number: '',
        account_holder: '',
        is_active: true,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingId) {
            put(`/owner/payment-accounts/${editingId}`, {
                onSuccess: () => {
                    reset();
                    setShowForm(false);
                    setEditingId(null);
                },
            });
        } else {
            post('/owner/payment-accounts', {
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

    const handleDelete = (id: number) => {
        if (confirm('Hapus rekening ini?')) {
            router.delete(`/owner/payment-accounts/${id}`);
        }
    };

    return (
        <OwnerPageShell title="Rekening Pembayaran" subtitle="Kelola rekening bank untuk setoran outlet">
            <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-5">
                {/* Left: account list */}
                <div>
                    <div className="mb-4 flex items-center justify-between">
                        <h1 className="text-lg font-bold text-text">Rekening Pembayaran</h1>
                        <button
                            onClick={() => {
                                reset();
                                setEditingId(null);
                                setShowForm(!showForm);
                            }}
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-primary/90 active:opacity-80 lg:hidden"
                        >
                            {showForm ? 'Batal' : 'Tambah Rekening'}
                        </button>
                    </div>

                    {/* Mobile form */}
                    {showForm && (
                        <form onSubmit={handleSubmit} className="mb-4 rounded-xl border border-border bg-white p-4 lg:hidden">
                            <h2 className="mb-3 text-sm font-semibold text-text">
                                {editingId ? 'Edit Rekening' : 'Tambah Rekening'}
                            </h2>
                            <AccountForm data={data} setData={setData} errors={errors} processing={processing} editingId={editingId} />
                        </form>
                    )}

                    <div className="space-y-2">
                        {accounts.length === 0 ? (
                            <div className="rounded-xl border border-border bg-white p-8 text-center">
                                <p className="text-sm text-text-muted">Belum ada rekening</p>
                            </div>
                        ) : (
                            accounts.map((account) => (
                                <div key={account.id} className="rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm hover:border-border/60">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="text-sm font-semibold text-text">{account.bank_name}</div>
                                            <div className="text-xs text-text-muted">{account.account_number}</div>
                                            <div className="text-xs text-text-subtle">a.n. {account.account_holder}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${account.is_active ? 'bg-primary-light text-primary' : 'bg-surface-muted text-text-muted'}`}>
                                                {account.is_active ? 'Aktif' : 'Nonaktif'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex gap-2">
                                        <button
                                            onClick={() => handleEdit(account)}
                                            className="rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-muted/80"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(account.id)}
                                            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                                        >
                                            Hapus
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right: add/edit form (desktop only, sticky) */}
                <div className="hidden lg:block">
                    <div className="sticky top-4">
                        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-white p-4 transition-shadow hover:shadow-sm">
                            <h2 className="mb-3 text-sm font-semibold text-text">
                                {editingId ? 'Edit Rekening' : 'Tambah Rekening'}
                            </h2>
                            <AccountForm data={data} setData={setData} errors={errors} processing={processing} editingId={editingId} />
                        </form>
                    </div>
                </div>
            </div>
        </OwnerPageShell>
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
                <input
                    type="text"
                    value={data.bank_name}
                    onChange={(e) => setData('bank_name', e.target.value)}
                    required
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
                    placeholder="BCA, Mandiri, BRI..."
                />
                {errors.bank_name && <p className="mt-1 text-xs text-red-600">{errors.bank_name}</p>}
            </div>

            <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Nomor Rekening</label>
                <input
                    type="text"
                    value={data.account_number}
                    onChange={(e) => setData('account_number', e.target.value)}
                    required
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
                    placeholder="1234567890"
                />
                {errors.account_number && <p className="mt-1 text-xs text-red-600">{errors.account_number}</p>}
            </div>

            <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Nama Pemilik</label>
                <input
                    type="text"
                    value={data.account_holder}
                    onChange={(e) => setData('account_holder', e.target.value)}
                    required
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
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

            <button
                type="submit"
                disabled={processing}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-primary/90 active:opacity-80 disabled:opacity-50"
            >
                {processing ? 'Menyimpan...' : editingId ? 'Perbarui' : 'Simpan'}
            </button>
        </div>
    );
}
