import { router } from '@inertiajs/react';
import { Receipt } from 'lucide-react';
import { useState } from 'react';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDate } from '@/lib/format';

interface Payment {
    id: number;
    reference_number: string;
    payment_date: string;
    amount: number;
    status: string;
    notes: string | null;
    proof_image: string | null;
    rejection_reason: string | null;
    verifier: { name: string } | null;
    verified_at: string | null;
}

interface Props {
    payments: {
        data: Payment[];
        current_page: number;
        last_page: number;
    };
}

export default function OutletSettlementPayments({ payments }: Props) {
    const [showForm, setShowForm] = useState(false);
    const [amount, setAmount] = useState('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});

        const formData = new FormData();
        formData.append('amount', amount);
        formData.append('reference_number', referenceNumber);
        formData.append('payment_date', paymentDate);

        if (notes) {
            formData.append('notes', notes);
        }

        if (proofFile) {
            formData.append('proof_image', proofFile);
        }

        router.post('/outlet/settlement-payments', formData, {
            onSuccess: () => {
                setAmount('');
                setReferenceNumber('');
                setPaymentDate(new Date().toISOString().split('T')[0]);
                setNotes('');
                setProofFile(null);
                setShowForm(false);
            },
            onError: (errs) => setErrors(errs),
            onFinish: () => setSaving(false),
        });
    };

    const statusLabels: Record<string, string> = {
        pending_verification: 'Menunggu Verifikasi',
        verified: 'Terverifikasi',
        rejected: 'Ditolak',
    };

    const statusVariants: Record<string, 'success' | 'warning' | 'danger'> = {
        pending_verification: 'warning',
        verified: 'success',
        rejected: 'danger',
    };

    return (
        <OutletLayout title="Riwayat Pembayaran" subtitle="Daftar pembayaran yang sudah dikirim">
            <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                    <h1 className="text-lg font-bold text-slate-900">Pembayaran Settlement</h1>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                        {showForm ? 'Batal' : 'Bayar'}
                    </button>
                </div>

                {/* Payment Form */}
                {showForm && (
                    <form onSubmit={handleSubmit} className="mb-4 rounded-xl border border-zinc-200 bg-white p-4">
                        <h2 className="mb-3 text-sm font-semibold text-slate-900">Submit Pembayaran</h2>

                        <div className="space-y-3">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-500">Jumlah (Rp)</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    min="1"
                                    required
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                    placeholder="1200000"
                                />
                                {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-500">Nomor Referensi</label>
                                <input
                                    type="text"
                                    value={referenceNumber}
                                    onChange={(e) => setReferenceNumber(e.target.value)}
                                    required
                                    maxLength={100}
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                    placeholder="TRF-20260605-001"
                                />
                                {errors.reference_number && <p className="mt-1 text-xs text-red-600">{errors.reference_number}</p>}
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-500">Tanggal Pembayaran</label>
                                <input
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                    required
                                    max={new Date().toISOString().split('T')[0]}
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                />
                                {errors.payment_date && <p className="mt-1 text-xs text-red-600">{errors.payment_date}</p>}
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-500">Catatan (opsional)</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    maxLength={500}
                                    rows={2}
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                    placeholder="Transfer via BCA..."
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-500">Bukti Transfer (opsional)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                />
                                {errors.proof_image && <p className="mt-1 text-xs text-red-600">{errors.proof_image}</p>}
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {saving ? 'Mengirim...' : 'Kirim Pembayaran'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Payment List */}
                <div className="space-y-2">
                    {payments.data.length === 0 ? (
                        <EmptyState
                            icon={<Receipt className="h-8 w-8 text-slate-400" />}
                            title="Belum ada pembayaran"
                            description="Riwayat pembayaran Anda akan muncul di sini"
                        />
                    ) : (
                        payments.data.map((payment) => (
                            <div key={payment.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">{formatCurrency(payment.amount)}</div>
                                        <div className="text-xs text-zinc-500">{payment.reference_number}</div>
                                        <div className="text-xs text-zinc-400">{formatDate(payment.payment_date)}</div>
                                    </div>
                                    <StatusBadge variant={statusVariants[payment.status]}>
                                        {statusLabels[payment.status]}
                                    </StatusBadge>
                                </div>
                                {payment.notes && (
                                    <div className="mt-2 text-xs text-zinc-500">{payment.notes}</div>
                                )}
                                {payment.proof_image && (
                                    <div className="mt-2">
                                        <a href={`/storage/${payment.proof_image}`} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 underline">
                                            Lihat Bukti Transfer
                                        </a>
                                    </div>
                                )}
                                {payment.rejection_reason && (
                                    <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                                        Alasan ditolak: {payment.rejection_reason}
                                    </div>
                                )}
                                {payment.verifier && (
                                    <div className="mt-2 text-xs text-zinc-400">
                                        Diverifikasi oleh {payment.verifier.name}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination */}
                {payments.last_page > 1 && (
                    <div className="mt-4 flex justify-center gap-2">
                        {Array.from({ length: payments.last_page }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                onClick={() => router.get(`/outlet/settlement-payments?page=${page}`)}
                                className={`h-8 w-8 rounded-lg text-sm ${
                                    page === payments.current_page
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-zinc-100 text-zinc-600'
                                }`}
                            >
                                {page}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </OutletLayout>
    );
}
