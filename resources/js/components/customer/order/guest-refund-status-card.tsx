import {
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { GuestRefundPayload, RefundHistoryItem } from '@/types/refund';

interface Props {
    refund: GuestRefundPayload;
}

export default function GuestRefundStatusCard({ refund }: Props) {
    const [timelineOpen, setTimelineOpen] = useState(false);

    const {
        payment_status: status,
        amount,
        guidance,
        rejection,
        queue_state,
        timeline,
    } = refund;
    const fmtAmount = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(amount);

    const cardClass = 'border-0';

    if (
        status === 'refund_pending' &&
        (queue_state === 'awaiting_guest' ||
            queue_state === 'awaiting_customer')
    ) {
        return (
            <Card className={cardClass}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm text-warning-text">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-warning-bg">
                            <Clock className="h-4 w-4 text-warning" />
                        </span>
                        Informasi Refund
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <AmountBlock amount={fmtAmount} />
                    <p className="rounded-card bg-warning-bg px-4 py-3.5 text-control text-warning-text">
                        {guidance}
                    </p>
                    <TimelineToggle
                        open={timelineOpen}
                        onToggle={() => setTimelineOpen((p) => !p)}
                        items={timeline}
                    />
                </CardContent>
            </Card>
        );
    }

    if (status === 'refund_pending') {
        return (
            <Card className={cardClass}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm text-warning-text">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-warning-bg">
                            <Clock className="h-4 w-4 text-warning" />
                        </span>
                        Menunggu Diproses
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <AmountBlock amount={fmtAmount} />
                    <p className="rounded-card bg-warning-bg px-4 py-3.5 text-control text-warning-text">
                        {guidance}
                    </p>
                    <TimelineToggle
                        open={timelineOpen}
                        onToggle={() => setTimelineOpen((p) => !p)}
                        items={timeline}
                    />
                </CardContent>
            </Card>
        );
    }

    if (status === 'refund_in_progress') {
        return (
            <Card className={cardClass}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm text-info-text">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-info-bg">
                            <Clock className="h-4 w-4 text-info" />
                        </span>
                        Refund Sedang Diproses
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <AmountBlock amount={fmtAmount} />
                    <p className="rounded-card bg-surface-muted px-4 py-3.5 text-xs text-text-muted">
                        {guidance}
                    </p>
                    <TimelineToggle
                        open={timelineOpen}
                        onToggle={() => setTimelineOpen((p) => !p)}
                        items={timeline}
                    />
                </CardContent>
            </Card>
        );
    }

    if (status === 'refunded') {
        return (
            <Card className={cardClass}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm text-success-text">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success-bg">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                        </span>
                        Refund Selesai
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <AmountBlock amount={fmtAmount} variant="success" />
                    <p className="rounded-card bg-success-bg px-4 py-3.5 text-control text-success-text">
                        Silakan cek mutasi rekening/e-wallet Anda. Jika belum
                        masuk dalam 1×24 jam, hubungi CS.
                    </p>
                    <TimelineToggle
                        open={timelineOpen}
                        onToggle={() => setTimelineOpen((p) => !p)}
                        items={timeline}
                    />
                </CardContent>
            </Card>
        );
    }

    if (status === 'refund_rejected') {
        return (
            <Card className={cardClass}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm text-danger-text">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-danger-bg">
                            <XCircle className="h-4 w-4 text-danger" />
                        </span>
                        Refund Ditolak
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <AmountBlock amount={fmtAmount} />
                    <div className="space-y-1 rounded-card bg-danger-bg px-4 py-3.5 text-control text-danger-text">
                        <p className="font-medium">
                            {rejection?.label || rejection?.code}
                        </p>
                        {rejection?.note && (
                            <p className="text-danger">{rejection.note}</p>
                        )}
                    </div>
                    <p className="rounded-card bg-surface-muted px-4 py-3.5 text-xs text-text-muted">
                        Silakan hubungi customer service untuk bantuan lebih
                        lanjut.
                    </p>
                    <TimelineToggle
                        open={timelineOpen}
                        onToggle={() => setTimelineOpen((p) => !p)}
                        items={timeline}
                    />
                </CardContent>
            </Card>
        );
    }

    if (status === 'refund_failed') {
        return (
            <Card className={cardClass}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm text-danger-text">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-danger-bg">
                            <AlertCircle className="h-4 w-4 text-danger" />
                        </span>
                        Refund Gagal
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <AmountBlock amount={fmtAmount} />
                    <p className="rounded-card bg-danger-bg px-4 py-3.5 text-xs text-danger-text">
                        Refund gagal diproses. Tim kami akan menghubungi Anda.
                    </p>
                    <TimelineToggle
                        open={timelineOpen}
                        onToggle={() => setTimelineOpen((p) => !p)}
                        items={timeline}
                    />
                </CardContent>
            </Card>
        );
    }

    return null;
}

function AmountBlock({
    amount,
    variant = 'default',
}: {
    amount: string;
    variant?: 'default' | 'success';
}) {
    const textColor = variant === 'success' ? 'text-primary' : 'text-text';
    const bgColor =
        variant === 'success' ? 'bg-primary-light' : 'bg-surface-muted';

    return (
        <div className={`rounded-card ${bgColor} px-4 py-3.5`}>
            <p className="text-xs text-text-muted">Total Refund</p>
            <p className={`mt-0.5 text-xl font-bold tabular-nums ${textColor}`}>
                {amount}
            </p>
        </div>
    );
}

function TimelineToggle({
    open,
    onToggle,
    items,
}: {
    open: boolean;
    onToggle: () => void;
    items: RefundHistoryItem[];
}) {
    if (items.length === 0) {
        return null;
    }

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
                {item.note && (
                    <p className="text-caption text-text-subtle">{item.note}</p>
                )}
                <p className="text-caption text-text-subtle">
                    {item.created_at
                        ? new Date(item.created_at).toLocaleString('id-ID')
                        : ''}
                    {item.actor_type && ` · ${item.actor_type}`}
                </p>
            </div>
        </div>
    );
}
