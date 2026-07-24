import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import type { GuestRefundPayload } from '@/types/refund';

interface Props {
    refund: GuestRefundPayload;
}

export default function GuestRefundStatusCard({ refund }: Props) {
    const { payment_status: status, amount, guidance, rejection, queue_state } = refund;
    const fmtAmount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);

    if (status === 'refund_pending' && (queue_state === 'awaiting_guest' || queue_state === 'awaiting_customer')) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-amber-500" />
                        Informasi Refund
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p className="text-xs text-text-muted" role="status">
                        Refund sebesar <strong>{fmtAmount}</strong> akan diproses.
                    </p>
                    <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{guidance}</p>
                </CardContent>
            </Card>
        );
    }

    if (status === 'refund_pending') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-amber-500" />
                        Menunggu Diproses
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p className="text-xs text-text-muted" role="status">Refund sebesar <strong>{fmtAmount}</strong> akan segera diproses.</p>
                    <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{guidance}</p>
                </CardContent>
            </Card>
        );
    }

    if (status === 'refund_in_progress') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-blue-500" />
                        Refund Sedang Diproses
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p className="text-xs text-text-muted" role="status">Refund sebesar <strong>{fmtAmount}</strong> sedang diproses oleh owner.</p>
                    <p className="rounded-lg bg-muted p-2 text-xs text-text-muted">{guidance}</p>
                </CardContent>
            </Card>
        );
    }

    if (status === 'refunded') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Refund Selesai
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p className="text-xs text-text-muted" role="status">Refund sebesar <strong>{fmtAmount}</strong> telah diproses.</p>
                    <p className="rounded-lg bg-green-50 p-2 text-xs text-green-800">Silakan cek mutasi rekening/e-wallet Anda. Jika belum masuk, hubungi CS.</p>
                </CardContent>
            </Card>
        );
    }

    if (status === 'refund_rejected') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-500" />
                        Refund Ditolak
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p className="text-xs text-red-600" role="alert">{rejection?.label || rejection?.code}</p>
                    {rejection?.note && <p className="text-xs text-text-muted">{rejection.note}</p>}
                </CardContent>
            </Card>
        );
    }

    if (status === 'refund_failed') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        Refund Gagal
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p className="text-xs text-text-muted">Refund sebesar <strong>{fmtAmount}</strong> gagal diproses. Tim kami akan menghubungi Anda.</p>
                </CardContent>
            </Card>
        );
    }

    return null;
}
