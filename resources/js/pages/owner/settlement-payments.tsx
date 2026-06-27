import { router } from '@inertiajs/react';
import { DollarSign, Clock, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import FinanceFilterTabs from '@/components/owner/finance/finance-filter-tabs';
import FinanceKpiCard from '@/components/owner/finance/finance-kpi-card';
import PaymentHistoryCard from '@/components/owner/finance/payment-history-card';
import PaymentProofModal from '@/components/owner/finance/payment-proof-modal';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { formatCurrency } from '@/lib/format';

const FILTER_TABS = [
    { key: 'all', label: 'Semua' },
    { key: 'pending_verification', label: 'Pending' },
    { key: 'verified', label: 'Diverifikasi' },
    { key: 'rejected', label: 'Ditolak' },
];

export default function OwnerSettlementPayments({ payments, statusFilter, kpis }: any) {
    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [processing, setProcessing] = useState(false);
    const [proofUrl, setProofUrl] = useState<string | null>(null);
    const [batchVerifying, setBatchVerifying] = useState(false);

    // P2: Default to pending_verification if no statusFilter
    useEffect(() => {
        if (!statusFilter || statusFilter === 'all') {
            router.get('/owner/settlement-payments', { status: 'pending_verification' }, { replace: true, preserveState: true });
        }
    }, []);

    const handleVerify = (paymentId: number) => {
        if (!confirm('Verifikasi pembayaran ini?')) {
return;
}

        setProcessing(true);
        router.post(`/owner/settlement-payments/${paymentId}/verify`, {}, {
            onFinish: () => setProcessing(false),
        });
    };

    const handleReject = (paymentId: number) => {
        if (rejectingId === paymentId) {
            if (!rejectReason.trim()) {
                return;
            }

            setProcessing(true);
            router.post(`/owner/settlement-payments/${paymentId}/reject`, {
                rejection_reason: rejectReason,
            }, {
                onSuccess: () => {
                    setRejectingId(null);
                    setRejectReason('');
                },
                onFinish: () => setProcessing(false),
            });
        } else {
            setRejectingId(paymentId);
            setRejectReason('');
        }
    };

    const handleBatchVerify = () => {
        if (!confirm(`Verifikasi semua ${pendingPayments.length} pembayaran yang pending?`)) {
            return;
        }
        setBatchVerifying(true);
        router.post('/owner/settlement-payments/bulk-verify', {}, {
            onFinish: () => setBatchVerifying(false),
        });
    };

    const pendingPayments = payments.data.filter((p: any) => p.status === 'pending_verification');
    const otherPayments = payments.data.filter((p: any) => p.status !== 'pending_verification');

    return (
        <OwnerPageShell title="Riwayat Pembayaran" subtitle="Kelola pembayaran settlement dari seluruh outlet">
            {/* KPI Strip */}
            <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <FinanceKpiCard
                    label="Pending Verifikasi"
                    value={`${kpis?.pending_count ?? 0}`}
                    accent="amber"
                    icon={<Clock className="h-4 w-4" />}
                    subtext="Pembayaran menunggu persetujuan"
                />
                <FinanceKpiCard
                    label="Pembayaran Hari Ini"
                    value={formatCurrency(kpis?.verified_today ?? 0)}
                    accent="emerald"
                    icon={<CheckCircle className="h-4 w-4" />}
                    subtext="Diverifikasi hari ini"
                />
                <FinanceKpiCard
                    label="Total Bulan Ini"
                    value={formatCurrency(kpis?.verified_month ?? 0)}
                    accent="blue"
                    icon={<DollarSign className="h-4 w-4" />}
                    subtext="Total pembayaran bulan ini"
                />
            </section>

            {/* Sticky Filter */}
            <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-surface/80 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <FinanceFilterTabs
                        tabs={FILTER_TABS}
                        active={statusFilter}
                        onChange={(key) => router.get('/owner/settlement-payments', { status: key }, { preserveState: true })}
                    />
                    {pendingPayments.length > 0 && statusFilter !== 'verified' && statusFilter !== 'rejected' && (
                        <button
                            type="button"
                            onClick={handleBatchVerify}
                            disabled={batchVerifying}
                            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {batchVerifying ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <CheckCircle className="h-3.5 w-3.5" />
                            )}
                            Verifikasi Semua ({pendingPayments.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Reject reason input */}
            {rejectingId && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                    <div className="text-sm font-semibold text-red-800">Alasan Penolakan</div>
                    <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Masukkan alasan penolakan..."
                        rows={2}
                        className="mt-2 w-full rounded-lg border border-red-200 bg-surface px-3 py-2 text-sm focus:border-red-400 focus:ring-1 focus:ring-red-200"
                    />
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={() => handleReject(rejectingId)}
                            disabled={processing || !rejectReason.trim()}
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                            {processing ? 'Mengirim...' : 'Konfirmasi Tolak'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
 setRejectingId(null); setRejectReason(''); 
}}
                            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text hover:bg-surface-muted"
                        >
                            Batal
                        </button>
                    </div>
                </div>
            )}

            {/* Payment Cards */}
            <section className="mt-4">
                {payments.data.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-surface py-16 text-center">
                        <DollarSign className="mx-auto h-10 w-10 text-text-subtle" />
                        <p className="mt-3 text-sm font-medium text-text-muted">Belum ada pembayaran</p>
                        <p className="mt-1 text-xs text-text-subtle">Pembayaran outlet akan muncul di sini.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Pending first — visually dominant */}
                        {pendingPayments.map((payment: any) => (
                            <PaymentHistoryCard
                                key={payment.id}
                                payment={payment}
                                onVerify={handleVerify}
                                onReject={(id) => {
 setRejectingId(id); setRejectReason(''); 
}}
                                onShowProof={(url) => setProofUrl(url)}
                                processing={processing}
                            />
                        ))}
                        {/* Then others */}
                        {otherPayments.map((payment: any) => (
                            <PaymentHistoryCard
                                key={payment.id}
                                payment={payment}
                                onVerify={handleVerify}
                                onReject={(id) => {
 setRejectingId(id); setRejectReason(''); 
}}
                                onShowProof={(url) => setProofUrl(url)}
                                processing={processing}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* Pagination */}
            {payments.last_page > 1 && (
                <>
                    {/* Desktop: number pagination */}
                    <div className="mt-6 hidden justify-center gap-2 sm:flex">
                        {Array.from({ length: payments.last_page }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                onClick={() => router.get(`/owner/settlement-payments?page=${page}&status=${statusFilter}`)}
                                className={`h-9 w-9 rounded-full text-sm font-medium transition-colors ${
                                    page === payments.current_page
                                        ? 'bg-primary text-white shadow-sm'
                                        : 'bg-surface-muted text-text-muted hover:bg-surface-muted'
                                }`}
                            >
                                {page}
                            </button>
                        ))}
                    </div>
                    {/* Mobile: Load More */}
                    {payments.current_page < payments.last_page && (
                        <div className="mt-6 flex justify-center sm:hidden">
                            <button
                                type="button"
                                onClick={() => router.get(`/owner/settlement-payments?page=${payments.current_page + 1}&status=${statusFilter}`, {}, { preserveState: true })}
                                className="rounded-full border border-border bg-surface px-6 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-surface-muted"
                            >
                                Muat Lebih Banyak
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Proof Modal */}
            {proofUrl && (
                <PaymentProofModal open={!!proofUrl} onClose={() => setProofUrl(null)} imageUrl={proofUrl} />
            )}
        </OwnerPageShell>
    );
}
