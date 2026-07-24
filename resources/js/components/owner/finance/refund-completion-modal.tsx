import { FormEventHandler, useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface Props {
    orderId: number;
    orderCode: string;
    amount: number;
    open: boolean;
    onClose: () => void;
}

export default function RefundCompletionModal({ orderId, orderCode, amount, open, onClose }: Props) {
    const [proof, setProof] = useState<File | null>(null);
    const [reference, setReference] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            setProof(null);
            setReference('');
            setNote('');
            setPreview(null);
        }
    }, [open]);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (!proof) {
            toast.error('Bukti transfer wajib diunggah');
            return;
        }

        setBusy(true);
        const fd = new FormData();
        fd.append('proof', proof);
        if (reference) fd.append('transfer_reference', reference);
        if (note) fd.append('transfer_note', note);

        router.post(`/owner/refunds/${orderId}/complete`, fd, {
            forceFormData: true,
            onSuccess: () => {
                toast.success('Refund selesai');
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
                    <DialogTitle>Selesaikan Refund</DialogTitle>
                    <DialogDescription>
                        Order #{orderCode} — Rp{amount.toLocaleString('id-ID')}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <Label htmlFor="proof">Bukti Transfer</Label>
                        <input
                            id="proof"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                setProof(file);
                                if (file) {
                                    setPreview(URL.createObjectURL(file));
                                } else {
                                    setPreview(null);
                                }
                            }}
                            className="mt-1 block w-full text-xs"
                        />
                        {preview && (
                            <img src={preview} alt="Preview" className="mt-2 max-h-32 rounded object-contain" />
                        )}
                    </div>
                    <div>
                        <Label htmlFor="reference">Referensi Transfer (opsional)</Label>
                        <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="B1234567890" />
                    </div>
                    <div>
                        <Label htmlFor="note">Catatan (opsional)</Label>
                            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="..." rows={2} />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Batal</Button>
                        <Button type="submit" disabled={busy || !proof}>{busy ? 'Memproses...' : 'Selesaikan Refund'}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
