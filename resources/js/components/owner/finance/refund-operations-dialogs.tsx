import { useState, useEffect, FormEventHandler } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { OwnerRefundPayload, RefundDestinationType } from '@/types/refund';

interface DialogProps {
    refund: OwnerRefundPayload | null;
    open: boolean;
    onClose: () => void;
}

export function GuestRefundDestinationDialog({ refund, open, onClose }: DialogProps) {
    const [type, setType] = useState<RefundDestinationType>('bank');
    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountHolder, setAccountHolder] = useState('');
    const [ewalletProvider, setEwalletProvider] = useState('');
    const [ewalletNumber, setEwalletNumber] = useState('');
    const [ewalletHolder, setEwalletHolder] = useState('');
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!open) {
            setType('bank');
            setBankName('');
            setAccountNumber('');
            setAccountHolder('');
            setEwalletProvider('');
            setEwalletNumber('');
            setEwalletHolder('');
            setPhoneVerified(false);
            setCopied(false);
        }
    }, [open]);

    const isBank = type === 'bank';

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (!refund) return;

        setBusy(true);
        router.post(`/owner/refunds/${refund.order_id}/destination`, {
            destination_type: type,
            bank_name: isBank ? bankName : undefined,
            account_number: isBank ? accountNumber : undefined,
            account_holder: isBank ? accountHolder : undefined,
            ewallet_provider: isBank ? undefined : ewalletProvider,
            ewallet_number: isBank ? undefined : ewalletNumber,
            ewallet_holder: isBank ? undefined : ewalletHolder,
            phone_verified: phoneVerified,
        }, {
            onSuccess: () => {
                toast.success('Tujuan refund berhasil disimpan');
                onClose();
            },
            onError: (errors) => toast.error(Object.values(errors).flat().join(', ')),
            onFinish: () => setBusy(false),
        });
    };

    if (!refund) return null;

    return (
        <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle id="guest-dest-title">Tujuan Refund Guest</DialogTitle>
                    <DialogDescription id="guest-dest-desc">
                        {refund.customer_name} — {refund.customer_phone}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} aria-labelledby="guest-dest-title" className="space-y-4">
                    {refund.destination && (
                        <div className="rounded-lg border border-border bg-muted p-3 text-xs space-y-1">
                            <p className="font-semibold text-text">Tujuan saat ini:</p>
                            <p className="break-all">{refund.destination.label} — {refund.destination.holder}</p>
                            <p className="font-mono break-all">{refund.destination.number}</p>
                            <button
                                type="button"
                                className="mt-1 inline-flex items-center gap-1 text-primary underline"
                                onClick={() => {
                                    navigator.clipboard.writeText(refund.destination!.number);
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 2000);
                                }}
                                aria-label={copied ? 'Nomor berhasil disalin' : 'Salin nomor rekening'}
                            >
                                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {copied ? 'Tersalin' : 'Salin Nomor'}
                            </button>
                        </div>
                    )}
                    <p className="text-xs text-text-muted">Gunakan hanya untuk proses refund order ini.</p>
                    <div>
                        <Label>Metode Penerimaan</Label>
                        <div className="mt-1 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setType('bank')}
                                className={`min-h-11 flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${type === 'bank' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted'}`}
                            >Transfer Bank</button>
                            <button
                                type="button"
                                onClick={() => setType('ewallet')}
                                className={`min-h-11 flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${type === 'ewallet' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted'}`}
                            >E-Wallet</button>
                        </div>
                    </div>
                    {isBank ? (
                        <>
                            <div><Label htmlFor="gb_bank">Nama Bank</Label><Input id="gb_bank" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="BCA" /></div>
                            <div><Label htmlFor="gb_account">Nomor Rekening</Label><Input id="gb_account" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="1234567890" className="break-all" /></div>
                            <div><Label htmlFor="gb_holder">Nama Pemilik</Label><Input id="gb_holder" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="sesuai rekening" /></div>
                        </>
                    ) : (
                        <>
                            <div>
                                <Label htmlFor="ge_provider">Provider</Label>
                                <Select id="ge_provider" value={ewalletProvider} onChange={(e) => setEwalletProvider(e.target.value)}
                                    options={[
                                        { value: 'GoPay', label: 'GoPay' },
                                        { value: 'OVO', label: 'OVO' },
                                        { value: 'DANA', label: 'DANA' },
                                        { value: 'ShopeePay', label: 'ShopeePay' },
                                    ]}
                                    placeholder="Pilih"
                                />
                            </div>
                            <div><Label htmlFor="ge_number">Nomor Terdaftar</Label><Input id="ge_number" value={ewalletNumber} onChange={(e) => setEwalletNumber(e.target.value)} placeholder="081234567890" className="break-all" /></div>
                            <div><Label htmlFor="ge_holder">Nama Pemilik</Label><Input id="ge_holder" value={ewalletHolder} onChange={(e) => setEwalletHolder(e.target.value)} placeholder="sesuai akun" /></div>
                        </>
                    )}
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="phone_verified" checked={phoneVerified} onChange={(e) => setPhoneVerified(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
                        <Label htmlFor="phone_verified" className="text-xs">Saya sudah memverifikasi tujuan refund melalui nomor pesanan</Label>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="min-h-11">Batal</Button>
                        <Button type="submit" disabled={busy || !phoneVerified} className="min-h-11">{busy ? 'Menyimpan...' : 'Simpan Tujuan'}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function RefundRollbackDialog({ refund, open, onClose }: DialogProps) {
    const [mode, setMode] = useState<'retry' | 'fix_destination'>('retry');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) {
            setMode('retry');
            setReason('');
        }
    }, [open]);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (!refund || !reason.trim()) return;

        setBusy(true);
        router.post(`/owner/refunds/${refund.order_id}/rollback`, {
            mode,
            reason: reason.trim(),
        }, {
            onSuccess: () => {
                toast.success('Refund dikembalikan ke antrean');
                onClose();
            },
            onError: (errors) => toast.error(Object.values(errors).flat().join(', ')),
            onFinish: () => setBusy(false),
        });
    };

    if (!refund) return null;

    return (
        <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle id="rollback-dialog-title">Kembalikan Refund ke Antrean</DialogTitle>
                    <DialogDescription id="rollback-dialog-desc">
                        Order #{refund.order_code}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} aria-labelledby="rollback-dialog-title" className="space-y-4">
                    <div role="radiogroup" aria-label="Mode rollback">
                        <Label>Mode Rollback</Label>
                        <div className="mt-1 space-y-1">
                            <label className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                <input type="radio" name="mode" value="retry" checked={mode === 'retry'} onChange={() => setMode('retry')} className="accent-primary" />
                                <div><span className="font-semibold">Retry</span> — tujuan refund valid, ulangi proses</div>
                            </label>
                            <label className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                <input type="radio" name="mode" value="fix_destination" checked={mode === 'fix_destination'} onChange={() => setMode('fix_destination')} className="accent-primary" />
                                <div><span className="font-semibold">Perbaiki Tujuan</span> — tujuan refund tidak valid, minta data baru</div>
                            </label>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="rollback-reason">Alasan Rollback</Label>
                        <Textarea id="rollback-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Jelaskan alasan pengembalian..." rows={2} maxLength={500} />
                        <p className="text-[11px] text-text-muted">{reason.length}/500</p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="min-h-11">Batal</Button>
                        <Button type="submit" disabled={busy || !reason.trim()} className="min-h-11">{busy ? 'Memproses...' : 'Kembalikan ke Antrean'}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
