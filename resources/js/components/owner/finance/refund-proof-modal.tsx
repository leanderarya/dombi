import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { router } from '@inertiajs/react';

interface Props {
    orderId: number;
    orderCode: string;
    expectedAmount: number;
    open: boolean;
    onClose: () => void;
}

export default function RefundProofModal({ orderId, orderCode, expectedAmount, open, onClose }: Props) {
    const [amount, setAmount] = useState(String(expectedAmount));
    const [reason, setReason] = useState('');
    const [proof, setProof] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = () => {
        if (!proof) return;
        setBusy(true);
        const fd = new FormData();
        fd.append('refund_amount', amount);
        fd.append('refund_reason', reason);
        fd.append('proof', proof);
        router.post(`/owner/refunds/${orderId}/mark-refunded`, fd, {
            forceFormData: true,
            onFinish: () => { setBusy(false); onClose(); },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Refund {orderCode}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <label className="text-xs text-text-muted">Nominal refund (Rp)</label>
                    <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    <label className="text-xs text-text-muted">Alasan</label>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Sudah transfer manual" />
                    <label className="text-xs text-text-muted">Bukti transfer</label>
                    <input type="file" accept="image/*" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
                    <Button disabled={busy || !proof} onClick={submit} className="w-full">
                        {busy ? 'Menyimpan...' : 'Tandai Refund'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
