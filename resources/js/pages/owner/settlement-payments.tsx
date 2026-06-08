import { router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/format';
import OwnerPageShell from '@/components/owner/owner-page-shell';

interface Payment {
    id: number;
    outlet: { id: number; name: string };
    reference_number: string;
    payment_date: string;
    amount: number;
    status: string;
    notes: string | null;
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
    statusFilter: string;
}

export default function OwnerSettlementPayments({ payments, statusFilter }: Props) {
    const [rejectingId, setRejectingId] = useState<number | null>(null);

    const { data, setData, post, processing, errors, reset } = useForm({
        rejection_reason: '',
    });

    const handleVerify = (paymentId: number) => {
        if (confirm('Verifikasi pembayaran ini?')) {
            post(`/owner/settlement-payments/${paymentId}/verify`);
        }
    };

    const handleReject = (paymentId: number) => {
        post(`/owner/settlement-payments/${paymentId}/reject`, {
            onSuccess: () => {
                setRejectingId(null);
                reset();
            },
        });
    };

    const statusLabels: Record<string, string> = {
        pending_verification: 'Menunggu Verifikasi',
        verified: 'Terverifikasi',
        rejected: 'Ditolak',
    };

    const statusColors: Record<string, string> = {
        pending_verification: 'bg-amber-50 text-amber-800',
        verified: 'bg-emerald-50 text-emerald-800',
        rejected: 'bg-red-50 text-red-800',
    };

    const filters = [
        { key: 'all', label: 'Semua' },
        { key: 'pending_verification', label: 'Menunggu' },
        { key: 'verified', label: 'Terverifikasi' },
        { key: 'rejected', label: 'Ditolak' },
    ];

    return (
        <OwnerPageShell title="Verifikasi Pembayaran" subtitle="Kelola pembayaran settlement dari outlet" backHref="/owner/settlement">
            {/* Filters */}
            <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
                {filters.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => router.get('/owner/settlement-payments', { status: f.key }, { preserveState: true })}
                        className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                            statusFilter === f.key
                                ? 'bg-emerald-600 text-white'
                                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Payment List */}
            <div className="space-y-3">
                {payments.data.length === 0 ? (
                    <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
                        <p className="text-sm text-zinc-500">Tidak ada pembayaran</p>
                    </div>
                ) : (
                    payments.data.map((payment) => (
                        <div key={payment.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-slate-900">{payment.outlet.name}</div>
                                    <div className="text-lg font-bold text-emerald-700">{formatCurrency(payment.amount)}</div>
                                    <div className="text-xs text-zinc-500">{payment.reference_number}</div>
                                    <div className="text-xs text-zinc-400">{formatDate(payment.payment_date)}</div>
                                </div>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[payment.status]}`}>
                                    {statusLabels[payment.status]}
                                </span>
                            </div>

                            {payment.notes && (
                                <div className="mt-2 text-xs text-zinc-500">{payment.notes}</div>
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

                            {/* Actions for pending payments */}
                            {payment.status === 'pending_verification' && (
                                <div className="mt-3 flex gap-2 border-t border-zinc-100 pt-3">
                                    {rejectingId === payment.id ? (
                                        <div className="flex-1">
                                            <textarea
                                                value={data.rejection_reason}
                                                onChange={(e) => setData('rejection_reason', e.target.value)}
                                                placeholder="Alasan penolakan..."
                                                rows={2}
                                                className="mb-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                            />
                                            {errors.rejection_reason && (
                                                <p className="mb-2 text-xs text-red-600">{errors.rejection_reason}</p>
                                            )}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleReject(payment.id)}
                                                    disabled={processing}
                                                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    {processing ? 'Mengirim...' : 'Tolak'}
                                                </button>
                                                <button
                                                    onClick={() => { setRejectingId(null); reset(); }}
                                                    className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600"
                                                >
                                                    Batal
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleVerify(payment.id)}
                                                disabled={processing}
                                                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                                            >
                                                Verifikasi
                                            </button>
                                            <button
                                                onClick={() => setRejectingId(payment.id)}
                                                className="rounded-lg bg-red-50 px-4 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                                            >
                                                Tolak
                                            </button>
                                        </>
                                    )}
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
                            onClick={() => router.get(`/owner/settlement-payments?page=${page}&status=${statusFilter}`)}
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
        </OwnerPageShell>
    );
}
