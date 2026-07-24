import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Clock, XCircle } from 'lucide-react';
import type { GuestRefundPayload, RefundHistoryItem } from '@/types/refund';

interface Props {
    refund: GuestRefundPayload;
}

export default function GuestRefundStatusCard({ refund }: Props) {
    const [timelineOpen, setTimelineOpen] = useState(false);

    const { payment_status: status, amount, guidance, rejection, queue_state, timeline } = refund;
    const fmtAmount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);

    const cardClass = 'border-0 shadow-card';

    if (status === 'refund_pending' && (queue_state === 'awaiting_guest' || queue_state === 'awaiting_customer')) {
        return (
            <Card className={cardClass}>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm text-amber-700">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100">
                            <Clock className="h-4 w-4 text-amber-600" />
                        </span>
                        Informasi Refund
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <AmountBlock amount={fmtAmount} />
                    <p className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                        {guidance}
                    </p>
                    <TimelineToggle open={timelineOpen} onToggle={() => setTimelineOpen((p) => !p)} items={timeline} />
                </CardContent>
            </Card>
        );
    }

    if (status === 'refund_pending') {
        return (
            <Card className={cardClass}>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm text-amber-700">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100">
                            <Clock className="h-4 w-4 text-amber-600" />
                        </span>
                        Menunggu Diproses
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <AmountBlock amount={fmtAmount} />
                    <p className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800">{guidance}</p>
                    <TimelineToggle open={timelineOpen} onToggle={() => setTimelineOpen((p) => !p)} items={timeline} />
                </CardContent>
            </Card>
        );
    }

    if (status === 'refund_in_progress') {
        return (
            <Card className={cardClass}>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm text-blue-700">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100">
                            <Clock className="h-4 w-4 text-blue-600" />
                        </span>
                        Refund Sedang Diproses
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <AmountBlock amount={fmtAmount} />
                    <p className="rounded-xl bg-muted px-4 py-3 text-xs text-text-muted">{guidance}</p>
                    <TimelineToggle open={timelineOpen} onToggle={() => setTimelineOpen((p) => !p)} items={timeline} />
                </CardContent>
            </Card>
        );
    }

    if (status === 'refunded') {
        return (
            <Card className={cardClass}>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm text-green-700">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </span>
                        Refund Selesai
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <AmountBlock amount={fmtAmount} variant="success" />
                    <p className="rounded-xl bg-green-50 px-4 py-3 text-[13px] text-green-800">
                        Silakan cek mutasi rekening/e-wallet Anda. Jika belum masuk dalam 1×24 jam, hubungi CS.
                    </p>
                    <TimelineToggle open={timelineOpen} onToggle={() => setTimelineOpen((p) => !p)} items={timeline} />
                </CardContent>
            </Card>
        );
    }

    if (status === 'refund_rejected') {
        return (
            <Card className={cardClass}>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm text-red-700">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100">
                            <XCircle className="h-4 w-4 text-red-600" />
                        </span>
                        Refund Ditolak
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <AmountBlock amount={fmtAmount} />
                    <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-800 space-y-1">
                        <p className="font-medium">{rejection?.label || rejection?.code}</p>
                        {rejection?.note && <p className="text-red-600">{rejection.note}</p>}
                    </div>
                    <p className="rounded-xl bg-surface-muted px-4 py-3 text-xs text-text-muted">
                        Silakan hubungi customer service untuk bantuan lebih lanjut.
                    </p>
                    <TimelineToggle open={timelineOpen} onToggle={() => setTimelineOpen((p) => !p)} items={timeline} />
                </CardContent>
            </Card>
        );
    }

    if (status === 'refund_failed') {
        return (
            <Card className={cardClass}>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm text-red-700">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                        </span>
                        Refund Gagal
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <AmountBlock amount={fmtAmount} />
                    <p className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
                        Refund gagal diproses. Tim kami akan menghubungi Anda.
                    </p>
                    <TimelineToggle open={timelineOpen} onToggle={() => setTimelineOpen((p) => !p)} items={timeline} />
                </CardContent>
            </Card>
        );
    }

    return null;
}

function AmountBlock({ amount, variant = 'default' }: { amount: string; variant?: 'default' | 'success' }) {
    const textColor = variant === 'success' ? 'text-emerald-700' : 'text-text';
    const bgColor = variant === 'success' ? 'bg-emerald-50' : 'bg-surface-muted';
    return (
        <div className={`rounded-xl ${bgColor} px-4 py-3`}>
            <p className="text-xs text-text-muted">Total Refund</p>
            <p className={`mt-0.5 text-xl font-bold tabular-nums ${textColor}`}>
                {amount}
            </p>
        </div>
    );
}

function TimelineToggle({ open, onToggle, items }: { open: boolean; onToggle: () => void; items: RefundHistoryItem[] }) {
    if (items.length === 0) return null;
    const Icon = open ? ChevronUp : ChevronDown;
    return (
        <div className="border-t border-border pt-3">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center justify-between text-xs font-medium text-text-muted active:opacity-70"
            >
                Riwayat Refund ({items.length})
                <Icon className="h-3.5 w-3.5" />
            </button>
            {open && (
                <div className="mt-3 space-y-2">
                    {items.map((item) => (
                        <TimelineItem key={item.id} item={item} />
                    ))}
                </div>
            )}
        </div>
    );
}

const EVENT_LABELS: Record<string, string> = {
    refund_requested: 'Refund diajukan',
    destination_submitted: 'Tujuan refund disimpan',
    destination_updated: 'Tujuan refund diperbarui',
    guest_destination_submitted_by_owner: 'Tujuan refund disimpan oleh owner',
    guest_destination_updated_by_owner: 'Tujuan refund diperbarui oleh owner',
    processing_started: 'Refund mulai diproses',
    processing_rolled_back: 'Refund dikembalikan ke antrean',
    refund_rejected: 'Refund ditolak',
    refund_reopened: 'Refund dibuka kembali',
    refund_completed: 'Refund selesai',
    refund_failed: 'Refund gagal',
};

function TimelineItem({ item }: { item: RefundHistoryItem }) {
    return (
        <div className="flex items-start gap-2.5">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-border" />
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-text">
                    {EVENT_LABELS[item.event] ?? item.event}
                </p>
                {item.note && <p className="text-[11px] text-text-subtle">{item.note}</p>}
                <p className="text-[11px] text-text-subtle">
                    {item.created_at ? new Date(item.created_at).toLocaleString('id-ID') : ''}
                    {item.actor_type && ` · ${item.actor_type}`}
                </p>
            </div>
        </div>
    );
}
