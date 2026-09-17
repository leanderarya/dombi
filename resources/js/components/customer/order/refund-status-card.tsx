import {
    AlertCircle,
    Banknote,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    ExternalLink,
    Smartphone,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CustomerRefundPayload, RefundHistoryItem } from '@/types/refund';
import RefundDestinationForm from './refund-destination-form';

interface Props {
    refund: CustomerRefundPayload;
}

export default function RefundStatusCard({ refund }: Props) {
    const [editing, setEditing] = useState(false);
    const [resubmitting, setResubmitting] = useState(false);
    const [timelineOpen, setTimelineOpen] = useState(false);

    const {
        payment_status: status,
        amount,
        destination,
        can_edit_destination,
        can_resubmit,
        rejection,
        proof_url,
        transfer_reference,
        transfer_note,
        order_id,
        timeline,
    } = refund;

    const fmtAmount = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(amount);

    const cardClass = 'border-0';

    if (status === 'refund_pending' && !destination) {
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
                    <AmountBlock amount={fmtAmount} label="Total Refund" />
                    <div className="rounded-card bg-warning-bg px-4 py-3.5 text-control text-warning-text">
                        Masukkan data tujuan transfer agar refund dapat
                        diproses.
                    </div>
                    <div className="rounded-card bg-surface-muted px-4 py-3.5">
                        <RefundDestinationForm orderId={order_id} />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (status === 'refund_pending' && destination) {
        return (
            <Card className={cardClass}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm text-warning-text">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-warning-bg">
                            <Clock className="h-4 w-4 text-warning" />
                        </span>
                        Menunggu Diproses Owner
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <AmountBlock amount={fmtAmount} label="Total Refund" />
                    <p className="text-xs text-text-muted">
                        Data tujuan sudah diterima. Owner akan memproses refund
                        dalam 1×24 jam.
                    </p>
                    <DestinationSummary dest={destination} />
                    {can_edit_destination && !editing && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditing(true)}
                            className="min-h-10 w-full"
                        >
                            Ubah Tujuan Refund
                        </Button>
                    )}
                    {editing && (
                        <div className="rounded-card bg-surface-muted px-4 py-3.5">
                            <RefundDestinationForm
                                orderId={order_id}
                                initialType={destination.type}
                                initialLabel={destination.label ?? undefined}
                                initialHolder={destination.holder ?? undefined}
                                onSaved={() => setEditing(false)}
                            />
                        </div>
                    )}
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
                    <AmountBlock amount={fmtAmount} label="Total Refund" />
                    <p className="text-xs text-text-muted">
                        Owner sedang mentransfer dana ke tujuan refund Anda.
                    </p>
                    {destination && <DestinationSummary dest={destination} />}
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
                    <AmountBlock
                        amount={fmtAmount}
                        label="Telah Ditransfer"
                        variant="success"
                    />
                    {destination && <DestinationSummary dest={destination} />}
                    {proof_url && (
                        <a
                            href={proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-control bg-primary-light text-sm font-semibold text-primary active:opacity-80"
                        >
                            <ExternalLink className="h-4 w-4" />
                            Lihat Bukti Transfer
                        </a>
                    )}
                    {(transfer_reference || transfer_note) && (
                        <div className="space-y-1 rounded-control bg-surface-muted p-3 text-xs text-text-muted">
                            {transfer_reference && (
                                <p>
                                    Referensi:{' '}
                                    <span className="font-mono font-medium text-text">
                                        {transfer_reference}
                                    </span>
                                </p>
                            )}
                            {transfer_note && <p>Catatan: {transfer_note}</p>}
                        </div>
                    )}
                    <TimelineToggle
                        open={timelineOpen}
                        onToggle={() => setTimelineOpen((p) => !p)}
                        items={timeline}
                    />
                </CardContent>
            </Card>
        );
    }

    if (status === 'refund_rejected' && can_resubmit) {
        return (
            <Card className={cardClass}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm text-danger-text">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-danger-bg">
                            <AlertCircle className="h-4 w-4 text-danger" />
                        </span>
                        Data Perlu Diperbaiki
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <AmountBlock amount={fmtAmount} label="Total Refund" />
                    <div className="space-y-1 rounded-card bg-danger-bg px-4 py-3.5 text-control text-danger-text">
                        <p className="font-medium">
                            {rejection?.label || rejection?.code}
                        </p>
                        {rejection?.note && (
                            <p className="text-danger">{rejection.note}</p>
                        )}
                    </div>
                    {!resubmitting && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setResubmitting(true)}
                            className="min-h-10 w-full"
                        >
                            Perbaiki Data Refund
                        </Button>
                    )}
                    {resubmitting && (
                        <div className="rounded-card bg-surface-muted px-4 py-3.5">
                            <RefundDestinationForm
                                orderId={order_id}
                                initialType={destination?.type}
                                initialHolder={destination?.holder ?? undefined}
                                onSaved={() => setResubmitting(false)}
                            />
                        </div>
                    )}
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
                    <AmountBlock amount={fmtAmount} label="Total Refund" />
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
                    <AmountBlock amount={fmtAmount} label="Total Refund" />
                    {destination && <DestinationSummary dest={destination} />}
                    <p className="rounded-card bg-danger-bg px-4 py-3.5 text-xs text-danger-text">
                        Refund gagal diproses. Tim kami akan menghubungi Anda
                        untuk proses ulang. Jika tidak dihubungi dalam 1×24 jam,
                        silakan hubungi CS.
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

interface DestProps {
    dest: {
        type: string;
        label: string;
        holder: string;
        masked_number: string;
    };
}

function DestinationSummary({ dest }: DestProps) {
    const Icon = dest.type === 'ewallet' ? Smartphone : Banknote;

    return (
        <div className="flex items-start gap-3 rounded-card border border-border bg-surface p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-surface-muted">
                <Icon className="h-4 w-4 text-text-muted" />
            </span>
            <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium text-text">{dest.label}</p>
                <p className="truncate text-text-muted">{dest.holder}</p>
                <p className="truncate font-mono text-control text-text-subtle">
                    {dest.masked_number}
                </p>
            </div>
        </div>
    );
}

function AmountBlock({
    amount,
    label,
    variant = 'default',
}: {
    amount: string;
    label: string;
    variant?: 'default' | 'success';
}) {
    const textColor = variant === 'success' ? 'text-primary' : 'text-text';
    const bgColor =
        variant === 'success' ? 'bg-primary-light' : 'bg-surface-muted';

    return (
        <div className={`rounded-card ${bgColor} px-4 py-3.5`}>
            <p className="text-xs text-text-muted">{label}</p>
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
