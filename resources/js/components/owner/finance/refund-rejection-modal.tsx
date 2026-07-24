import { FormEventHandler, useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
    onClose: () => void;
}

export default function RefundRejectionModal({ orderId, orderCode, open, onClose }: Props) {
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) {
            setReason('');
            setNote('');
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
                    <DialogTitle>Tolak Refund</DialogTitle>
                    <DialogDescription>Order #{orderCode}</DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <div>
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
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Batal</Button>
                        <Button type="submit" variant="destructive" disabled={busy || !reason}>
                            {busy ? 'Memproses...' : 'Tolak Refund'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
