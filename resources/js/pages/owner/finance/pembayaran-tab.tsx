import { router } from '@inertiajs/react';
import { toast } from 'sonner';
import { DollarSign, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import PaymentHistoryCard from '@/components/owner/finance/payment-history-card';
import PaymentProofModal from '@/components/owner/finance/payment-proof-modal';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import { SkeletonPage } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/format';

const STATUS_FILTERS = [
    { key: '', label: 'Semua' },
    { key: 'pending_verification', label: 'Pending' },
    { key: 'verified', label: 'Diverifikasi' },
    { key: 'rejected', label: 'Ditolak' },
];

export default function PembayaranTab({
    payments,
    statusFilter,
    paymentKpis,
}: any) {
    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [processing, setProcessing] = useState(false);
    const [proofUrl, setProofUrl] = useState<string | null>(null);
    const [batchVerifying, setBatchVerifying] = useState(false);
    const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
    const [verifyTargetId, setVerifyTargetId] = useState<number | null>(null);
    const [batchDialogOpen, setBatchDialogOpen] = useState(false);

    useEffect(() => {
        if (!statusFilter || statusFilter === 'all') {
            router.get(
                '/owner/finance',
                { tab: 'pembayaran', status: 'pending_verification' },
                { replace: true, preserveState: true },
            );
        }
    }, []);

    if (!payments) {
        return <SkeletonPage />;
    }

    const handleVerifyClick = (paymentId: number) => {
        setVerifyTargetId(paymentId);
        setVerifyDialogOpen(true);
    };

    const handleVerifyConfirm = () => {
        if (!verifyTargetId) {
            return;
        }

        setProcessing(true);
        setVerifyDialogOpen(false);
        router.post(
            `/owner/finance/settlement-payments/${verifyTargetId}/verify`,
            {},
            {
                onSuccess: () => {
                    toast.success('Pembayaran diverifikasi');
                },
                onError: (errors) => toast.error(Object.values(errors).flat().join(', ')),
                onFinish: () => {
                    setProcessing(false);
                    setVerifyTargetId(null);
                },
            },
        );
    };

    const handleReject = (paymentId: number) => {
        if (rejectingId === paymentId) {
            if (!rejectReason.trim()) {
                return;
            }

            setProcessing(true);
            router.post(
                `/owner/finance/settlement-payments/${paymentId}/reject`,
                {
                    rejection_reason: rejectReason,
                },
                {
                    onSuccess: () => {
                        toast.success('Pembayaran ditolak');
                        setRejectingId(null);
                        setRejectReason('');
                    },
                    onError: (errors) => toast.error(Object.values(errors).flat().join(', ')),
                    onFinish: () => setProcessing(false),
                },
            );
        } else {
            setRejectingId(paymentId);
            setRejectReason('');
        }
    };

    const handleBatchVerifyClick = () => {
        setBatchDialogOpen(true);
    };

    const handleBatchVerifyConfirm = () => {
        setBatchDialogOpen(false);
        setBatchVerifying(true);
        router.post(
            '/owner/finance/settlement-payments/bulk-verify',
            {},
            {
                onSuccess: () => toast.success('Berhasil'),
                onError: (errors) => toast.error(Object.values(errors).flat().join(', ')),
                onFinish: () => setBatchVerifying(false),
            },
        );
    };

    const pendingPayments = payments.data.filter(
        (p: any) => p.status === 'pending_verification',
    );

    const handleStatusFilterChange = (key: string) => {
        router.get(
            '/owner/finance',
            { tab: 'pembayaran', status: key || undefined },
            { preserveState: true },
        );
    };

    return (
        <>
            <OwnerKpiStrip
                items={[
                    {
                        label: 'Pending',
                        value: paymentKpis?.pending_count ?? 0,
                        sublabel:
                            (paymentKpis?.pending_count ?? 0) > 0
                                ? 'Perlu verifikasi'
                                : undefined,
                        sublabelColor: 'text-amber-600',
                    },
                    {
                        label: 'Hari Ini',
                        value: formatCurrency(paymentKpis?.verified_today ?? 0),
                    },
                    {
                        label: 'Bulan Ini',
                        value: formatCurrency(paymentKpis?.verified_month ?? 0),
                    },
                ]}
            />

            <div
                className="mb-4 flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Filter dan aksi pembayaran"
            >
                {STATUS_FILTERS.map((sf) => {
                    const isActive = (statusFilter ?? '') === sf.key;
                    const colorMap: Record<string, string> = {
                        '': 'text-text bg-surface-muted ring-border',
                        pending_verification:
                            'text-amber-600 bg-amber-50 ring-amber-200',
                        verified:
                            'text-emerald-600 bg-emerald-50 ring-emerald-200',
                        rejected: 'text-red-600 bg-red-50 ring-red-200',
                    };

                    return (
                        <button
                            key={sf.key}
                            type="button"
                            onClick={() => handleStatusFilterChange(sf.key)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                                isActive
                                    ? (colorMap[sf.key] ??
                                      'bg-primary/10 text-primary ring-primary/20')
                                    : 'hover:bg-mint-wash bg-surface text-text-muted ring-border'
                            }`}
                        >
                            {sf.label}
                        </button>
                    );
                })}
                {pendingPayments.length > 0 &&
                    statusFilter !== 'verified' &&
                    statusFilter !== 'rejected' && (
                        <Button
                            size="sm"
                            onClick={handleBatchVerifyClick}
                            disabled={batchVerifying}
                            className="ml-auto"
                        >
                            {batchVerifying ? (
                                <Loader2
                                    className="h-3.5 w-3.5 animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <CheckCircle
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                />
                            )}
                            Verifikasi Semua ({pendingPayments.length})
                        </Button>
                    )}
            </div>

            {rejectingId && (
                <div
                    className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4"
                    aria-label="Form penolakan pembayaran"
                >
                    <div className="text-sm font-semibold text-red-800">
                        Alasan Penolakan
                    </div>
                    <Textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Masukkan alasan penolakan..."
                        rows={2}
                        className="mt-2"
                    />
                    <div className="mt-3 flex gap-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleReject(rejectingId)}
                            disabled={processing || !rejectReason.trim()}
                        >
                            {processing ? 'Mengirim...' : 'Konfirmasi Tolak'}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setRejectingId(null);
                                setRejectReason('');
                            }}
                        >
                            Batal
                        </Button>
                    </div>
                </div>
            )}

            {payments.data.length === 0 ? (
                <EmptyState
                    icon={<DollarSign className="h-8 w-8" aria-hidden="true" />}
                    title="Belum ada pembayaran"
                    description="Pembayaran outlet akan muncul di sini."
                />
            ) : (
                <div className="space-y-3" aria-label="Daftar pembayaran">
                    {pendingPayments.map((payment: any) => (
                        <PaymentHistoryCard
                            key={payment.id}
                            payment={payment}
                            onVerify={handleVerifyClick}
                            onReject={(id) => {
                                setRejectingId(id);
                                setRejectReason('');
                            }}
                            onShowProof={(url) => setProofUrl(url)}
                            processing={processing}
                        />
                    ))}
                    {payments.data
                        .filter((p: any) => p.status !== 'pending_verification')
                        .map((payment: any) => (
                            <PaymentHistoryCard
                                key={payment.id}
                                payment={payment}
                                onVerify={handleVerifyClick}
                                onReject={(id) => {
                                    setRejectingId(id);
                                    setRejectReason('');
                                }}
                                onShowProof={(url) => setProofUrl(url)}
                                processing={processing}
                            />
                        ))}
                </div>
            )}

            <Pagination links={payments.links} />

            {proofUrl && (
                <PaymentProofModal
                    open={!!proofUrl}
                    onClose={() => setProofUrl(null)}
                    imageUrl={proofUrl}
                />
            )}

            <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Verifikasi Pembayaran</DialogTitle>
                        <DialogDescription>
                            Verifikasi pembayaran ini? Tindakan ini tidak dapat
                            dibatalkan.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setVerifyDialogOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleVerifyConfirm}
                            disabled={processing}
                        >
                            {processing ? 'Memverifikasi...' : 'Verifikasi'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Verifikasi Semua</DialogTitle>
                        <DialogDescription>
                            Verifikasi semua {pendingPayments.length} pembayaran
                            yang pending?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setBatchDialogOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button onClick={handleBatchVerifyConfirm}>
                            Verifikasi Semua
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
