import { Head, useForm, router } from '@inertiajs/react';
import { useState } from 'react';

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
        <>
            <Head title="Rekening Pembayaran" />

            <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                    <h1 className="text-lg font-bold text-slate-900">Rekening Pembayaran</h1>
                    <button
                        onClick={() => {
                            reset();
                            setEditingId(null);
                            setShowForm(!showForm);
                        }}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                        {showForm ? 'Batal' : 'Tambah Rekening'}
                    </button>
                </div>

                {showForm && (
                    <form onSubmit={handleSubmit} className="mb-4 rounded-xl border border-zinc-200 bg-white p-4">
                        <h2 className="mb-3 text-sm font-semibold text-slate-900">
                            {editingId ? 'Edit Rekening' : 'Tambah Rekening'}
                        </h2>

                        <div className="space-y-3">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-500">Nama Bank</label>
                                <input
                                    type="text"
                                    value={data.bank_name}
                                    onChange={(e) => setData('bank_name', e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                    placeholder="BCA, Mandiri, BRI..."
                                />
                                {errors.bank_name && <p className="mt-1 text-xs text-red-600">{errors.bank_name}</p>}
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-500">Nomor Rekening</label>
                                <input
                                    type="text"
                                    value={data.account_number}
                                    onChange={(e) => setData('account_number', e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                    placeholder="1234567890"
                                />
                                {errors.account_number && <p className="mt-1 text-xs text-red-600">{errors.account_number}</p>}
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-500">Nama Pemilik</label>
                                <input
                                    type="text"
                                    value={data.account_holder}
                                    onChange={(e) => setData('account_holder', e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
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
                                    className="h-4 w-4 rounded border-zinc-300"
                                />
                                <label htmlFor="is_active" className="text-sm text-zinc-700">Aktif</label>
                            </div>

                            <button
                                type="submit"
                                disabled={processing}
                                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {processing ? 'Menyimpan...' : editingId ? 'Perbarui' : 'Simpan'}
                            </button>
                        </div>
                    </form>
                )}

                <div className="space-y-2">
                    {accounts.length === 0 ? (
                        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
                            <p className="text-sm text-zinc-500">Belum ada rekening</p>
                        </div>
                    ) : (
                        accounts.map((account) => (
                            <div key={account.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">{account.bank_name}</div>
                                        <div className="text-xs text-zinc-500">{account.account_number}</div>
                                        <div className="text-xs text-zinc-400">a.n. {account.account_holder}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${account.is_active ? 'bg-emerald-50 text-emerald-800' : 'bg-zinc-100 text-zinc-500'}`}>
                                            {account.is_active ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-3 flex gap-2">
                                    <button
                                        onClick={() => handleEdit(account)}
                                        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(account.id)}
                                        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                                    >
                                        Hapus
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
