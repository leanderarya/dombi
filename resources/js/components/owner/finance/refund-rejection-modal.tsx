import { FormEventHandler, useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const REASONS = [
    { value: 'invalid_destination', label: 'Data tujuan refund tidak valid' },
    { value: 'incomplete_destination', label: 'Data belum lengkap' },
    { value: 'payment_unverified', label: 'Pembayaran tidak terverifikasi' },
    { value: 'duplicate_refund', label: 'Refund duplikat' },
    { value: 'other', label: 'Lainnya' },
] as const;

interface Props {
    orderId: number;
    orderCode: string;
    open: boolean;
    canLegacyRepair: boolean;
    onClose: () => void;
}

export default function RefundRejectionModal({ orderId, orderCode, open, canLegacyRepair, onClose }: Props) {
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [legacyRepair, setLegacyRepair] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) {
            setReason('');
            setNote('');
            setLegacyRepair(false);
        }
    }, [open]);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (!reason) {
            toast.error('Pilih alasan penolakan');
            return;
        }

        setBusy(true);
        router.post(`/owner/refunds/${orderId}/reject`, {
            reason,
            note: note || undefined,
            legacy_repair: legacyRepair || undefined,
        }, {
            onSuccess: () => {
                toast.success('Refund ditolak');
                onClose();
            },
            onError: (errors) => toast.error(Object.values(errors).flat().join(', ')),
            onFinish: () => setBusy(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle id="reject-dialog-title">Tolak Refund</DialogTitle>
                    <DialogDescription id="reject-dialog-desc">Order #{orderCode}</DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} aria-labelledby="reject-dialog-title" className="space-y-4">
                    <div role="radiogroup" aria-label="Alasan Penolakan">
                        <Label>Alasan Penolakan</Label>
                        <div className="mt-1 space-y-1">
                            {REASONS.map((r) => (
                                <label key={r.value} className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                    <input
                                        type="radio"
                                        name="reason"
                                        value={r.value}
                                        checked={reason === r.value}
                                        onChange={() => setReason(r.value)}
                                        className="accent-primary"
                                    />
                                    {r.label}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="reject-note">Catatan (opsional)</Label>
                        <Textarea id="reject-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="..." rows={2} />
                    </div>
                    {canLegacyRepair && (
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="legacy_repair" checked={legacyRepair} onChange={(e) => setLegacyRepair(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
                            <Label htmlFor="legacy_repair" className="text-xs">Perbaiki data lama (legacy)</Label>
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="min-h-11">Batal</Button>
                        <Button type="submit" variant="destructive" disabled={busy || !reason} className="min-h-11">
                            {busy ? 'Memproses...' : 'Tolak Refund'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
