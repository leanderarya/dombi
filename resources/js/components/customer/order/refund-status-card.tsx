import { useState } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import RefundDestinationForm from './refund-destination-form';
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface Destination {
    type: string;
    label: string | null;
    holder: string | null;
    masked_number: string | null;
}

interface Rejection {
    reason: string;
    note: string | null;
}

interface RefundData {
    payment_status: string;
    amount: number;
    destination: Destination | null;
    can_edit_destination: boolean;
    can_resubmit: boolean;
    rejection: Rejection | null;
    proof_url: string | null;
    transfer_reference: string | null;
    transfer_note: string | null;
    submitted_at: string | null;
    started_at: string | null;
    completed_at: string | null;
}

interface Props {
    refund: RefundData;
}

export default function RefundStatusCard({ refund }: Props) {
    const [editing, setEditing] = useState(false);
    const [resubmitting, setResubmitting] = useState(false);

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
    } = refund;

    const fmtAmount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);

    if (status === 'refund_pending' && !destination) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-amber-500" />
                        Informasi Refund
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p className="text-xs text-text-muted">
                        Refund sebesar <strong>{fmtAmount}</strong> menunggu data tujuan transfer Anda.
                    </p>
                    <RefundDestinationForm orderId={refund.payment_status ? 0 : 0} />
                </CardContent>
            </Card>
        );
    }

    if (status === 'refund_pending' && destination) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-amber-500" />
                        Menunggu Diproses
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p className="text-xs text-text-muted">Refund sebesar <strong>{fmtAmount}</strong> akan segera diproses.</p>
                    <DestinationSummary dest={destination} />
                    {can_edit_destination && !editing && (
                        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Ubah Tujuan</Button>
                    )}
                    {editing && (
                        <RefundDestinationForm
                            orderId={0}
                            initialType={destination.type as 'bank' | 'ewallet'}
                            initialLabel={destination.label ?? undefined}
                            initialHolder={destination.holder ?? undefined}
                            onSaved={() => setEditing(false)}
                        />
                    )}
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
                    <p className="text-xs text-text-muted">Refund sebesar <strong>{fmtAmount}</strong> sedang diproses oleh owner.</p>
                    {destination && <DestinationSummary dest={destination} />}
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
                    <p className="text-xs text-text-muted">
                        Refund sebesar <strong>{fmtAmount}</strong> telah ditransfer.
                    </p>
                    {proof_url && (
                        <a href={proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                            Lihat Bukti Transfer
                        </a>
                    )}
                    {transfer_reference && (
                        <p className="text-xs text-text-muted">Referensi: {transfer_reference}</p>
                    )}
                    {transfer_note && (
                        <p className="text-xs text-text-muted">Catatan: {transfer_note}</p>
                    )}
                </CardContent>
            </Card>
        );
    }

    if (status === 'refund_rejected' && can_resubmit) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        Data Perlu Diperbaiki
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p className="text-xs text-red-600">{rejection?.reason}</p>
                    {rejection?.note && <p className="text-xs text-text-muted">{rejection.note}</p>}
                    {!resubmitting && (
                        <Button variant="outline" size="sm" onClick={() => setResubmitting(true)}>Perbaiki Data</Button>
                    )}
                    {resubmitting && (
                        <RefundDestinationForm
                            orderId={0}
                            initialType={destination?.type as 'bank' | 'ewallet' | undefined}
                            initialHolder={destination?.holder ?? undefined}
                            onSaved={() => setResubmitting(false)}
                        />
                    )}
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
                    <p className="text-xs text-red-600">{rejection?.reason}</p>
                    {rejection?.note && <p className="text-xs text-text-muted">{rejection.note}</p>}
                    <p className="text-xs text-text-muted">Silakan hubungi customer service untuk bantuan lebih lanjut.</p>
                </CardContent>
            </Card>
        );
    }

    return null;
}

function DestinationSummary({ dest }: { dest: Destination }) {
    return (
        <div className="rounded-lg bg-muted p-2 text-xs text-text-muted">
            <p>{dest.label} — {dest.holder}</p>
            <p className="font-mono">{dest.masked_number}</p>
        </div>
    );
}
