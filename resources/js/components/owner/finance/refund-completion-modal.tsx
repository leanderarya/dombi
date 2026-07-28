import { router } from '@inertiajs/react';
import { Upload } from 'lucide-react';
import type { FormEventHandler } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
    orderId: number;
    orderCode: string;
    amount: number;
    open: boolean;
    onClose: () => void;
}

export default function RefundCompletionModal({
    orderId,
    orderCode,
    amount,
    open,
    onClose,
}: Props) {
    const [proof, setProof] = useState<File | null>(null);
    const [reference, setReference] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        if (!proof) {
            toast.error('Bukti transfer wajib diunggah');

            return;
        }

        if (proof.size > 2 * 1024 * 1024) {
            toast.error('Ukuran file maksimal 2 MB');

            return;
        }

        setBusy(true);
        const fd = new FormData();
        fd.append('proof', proof);

        if (reference) {
            fd.append('transfer_reference', reference);
        }

        if (note) {
            fd.append('transfer_note', note);
        }

        router.post(`/owner/refunds/${orderId}/complete-direct`, fd, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Refund selesai');
                onClose();
            },
            onError: (errors) =>
                toast.error(Object.values(errors).flat().join(', ')),
            onFinish: () => setBusy(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
            <DialogContent>
                <DialogHeader className="space-y-1">
                    <DialogTitle id="complete-dialog-title" className="text-lg">
                        Selesaikan Refund
                    </DialogTitle>
                    <DialogDescription
                        id="complete-dialog-desc"
                        className="flex flex-wrap items-center gap-1.5"
                    >
                        <span className="font-medium text-text">
                            #{orderCode}
                        </span>
                        <span className="text-text-subtle">—</span>
                        <span className="font-semibold text-emerald-700 tabular-nums">
                            Rp{amount.toLocaleString('id-ID')}
                        </span>
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={submit}
                    aria-labelledby="complete-dialog-title"
                    className="space-y-4"
                >
                    <div>
                        <Label htmlFor="proof">Bukti Transfer</Label>
                        <p className="text-[11px] text-text-muted">
                            Maksimal 2 MB. Format: JPG, PNG, WebP
                        </p>
                        <div className="mt-1">
                            <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-4 text-sm font-medium text-text-muted hover:border-primary hover:text-primary">
                                <Upload className="h-4 w-4" />
                                {proof ? proof.name : 'Pilih file gambar'}
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(e) => {
                                        const file =
                                            e.target.files?.[0] ?? null;
                                        setProof(file);

                                        if (file) {
                                            setPreview(
                                                URL.createObjectURL(file),
                                            );
                                        } else {
                                            setPreview(null);
                                        }
                                    }}
                                    className="sr-only"
                                />
                            </label>
                        </div>
                        {preview && (
                            <div className="mt-2">
                                <img
                                    src={preview}
                                    alt="Preview bukti transfer"
                                    className="max-h-36 w-full rounded-lg border border-border bg-muted object-contain"
                                />
                            </div>
                        )}
                    </div>
                    <div>
                        <Label htmlFor="reference">Referensi Transfer</Label>
                        <Input
                            id="reference"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            placeholder="B1234567890"
                            maxLength={255}
                            className="min-h-11"
                        />
                    </div>
                    <div>
                        <Label htmlFor="note">Catatan (opsional)</Label>
                        <Textarea
                            id="note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="..."
                            rows={2}
                            maxLength={500}
                        />
                        <p className="mt-0.5 text-[11px] text-text-subtle">
                            {note.length}/500
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={busy}
                            className="min-h-11"
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={busy || !proof}
                            className="min-h-11"
                        >
                            {busy ? 'Memproses...' : 'Selesaikan Refund'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
