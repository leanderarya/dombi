import { router } from '@inertiajs/react';
import { useState, useRef } from 'react';
import OwnerModalShell from '@/components/owner/owner-modal-shell';
import { formatCurrency } from '@/lib/format';

interface Props {
    open: boolean;
    onClose: () => void;
    outletId: number;
    outletName: string;
    outstanding: number;
    /** 'outlet_pays_owner' (setoran) vs 'owner_pays_outlet' (payout) */
    direction?: 'outlet_pays_owner' | 'owner_pays_outlet';
    /** Target rekening outlet utk payout (owner_pays_outlet) */
    outletBank?: {
        bank_name: string;
        bank_account_number: string;
        bank_account_holder: string;
    } | null;
}

const PAYMENT_METHODS = [
    { value: 'transfer_bank', label: 'Transfer Bank' },
    { value: 'cash', label: 'Tunai' },
    { value: 'qris', label: 'QRIS' },
    { value: 'other', label: 'Lainnya' },
];

export default function PaymentModal({
    open,
    onClose,
    outletId,
    outletName,
    outstanding,
    direction = 'outlet_pays_owner',
    outletBank = null,
}: Props) {
    const isPayout = direction === 'owner_pays_outlet';
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('transfer_bank');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(amount);

        if (!amt || amt <= 0) {
            return;
        }

        setSaving(true);
        setError(null);

        const formData = new FormData();
        formData.append('amount', String(amt));
        formData.append('payment_method', paymentMethod);

        if (referenceNumber) {
            formData.append('reference_number', referenceNumber);
        }

        if (notes) {
            formData.append('notes', notes);
        }

        if (proofFile) {
            formData.append('proof_image', proofFile);
        }

        const url = isPayout
            ? `/owner/finance/settlements/${outletId}/payout`
            : `/owner/finance/settlements/${outletId}/payments`;

        router.post(url, formData, {
            onSuccess: () => {
                onClose();
                resetForm();
            },
            onError: (errors: any) => {
                setError(
                    errors?.error ??
                        (isPayout
                            ? 'Gagal mencatat payout.'
                            : 'Gagal mencatat pembayaran.'),
                );
            },
            onFinish: () => setSaving(false),
        });
    };

    const resetForm = () => {
        setAmount('');
        setPaymentMethod('transfer_bank');
        setReferenceNumber('');
        setProofFile(null);
        setNotes('');
        setError(null);
    };

    return (
        <OwnerModalShell
            open={open}
            onClose={onClose}
            title={isPayout ? 'Bayar Profit ke Outlet' : 'Catat Pembayaran'}
            maxWidth="max-w-md"
        >
            <form onSubmit={handleSubmit}>
                <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-text-muted">Outlet</span>
                        <span className="font-medium text-text">
                            {outletName}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-text-muted">
                            {isPayout
                                ? 'Owner harus bayar'
                                : 'Total Outstanding'}
                        </span>
                        <span
                            className={`font-semibold ${
                                isPayout ? 'text-success-text' : 'text-danger'
                            }`}
                        >
                            {formatCurrency(outstanding)}
                        </span>
                    </div>
                    {isPayout && outletBank?.bank_name && (
                        <div className="mt-1 rounded-lg bg-success-bg p-2">
                            <div className="text-[11px] font-semibold text-success-text uppercase">
                                Rekening Tujuan
                            </div>
                            <div className="text-sm font-medium text-text">
                                {outletBank.bank_name} ·{' '}
                                {outletBank.bank_account_number}
                            </div>
                            <div className="text-xs text-text-muted">
                                a.n. {outletBank.bank_account_holder}
                            </div>
                        </div>
                    )}
                    <p className="text-xs text-text-subtle">
                        {isPayout
                            ? 'Owner transfer ke rekening outlet, dialokasikan ke profit tertua (FIFO).'
                            : 'Pembayaran dialokasikan ke tagihan tertua terlebih dahulu (FIFO).'}
                    </p>
                </div>

                <div className="mt-4 space-y-3">
                    <label className="block">
                        <span className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                            {isPayout
                                ? 'Nominal Ditransfer'
                                : 'Nominal Diterima'}
                        </span>
                        <div className="relative mt-1">
                            <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-text-subtle">
                                Rp
                            </span>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                min={1}
                                className="w-full rounded-lg border border-border bg-surface py-2.5 pr-4 pl-10 text-sm font-bold tabular-nums focus:border-success focus:ring-1 focus:ring-success-border"
                                placeholder="0"
                                autoFocus
                                required
                            />
                        </div>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                            Metode Pembayaran
                        </span>
                        <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm focus:border-success focus:ring-1 focus:ring-success-border"
                        >
                            {PAYMENT_METHODS.map((m) => (
                                <option key={m.value} value={m.value}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                            Nomor Referensi
                        </span>
                        <input
                            type="text"
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm focus:border-success focus:ring-1 focus:ring-success-border"
                            placeholder="BUKTI-001"
                        />
                    </label>

                    {!isPayout && (
                        <label className="block">
                            <span className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                                Upload Bukti
                            </span>
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*,.pdf"
                                onChange={(e) =>
                                    setProofFile(e.target.files?.[0] ?? null)
                                }
                                className="mt-1 w-full text-sm text-text-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-text hover:file:bg-surface-muted"
                            />
                        </label>
                    )}

                    <label className="block">
                        <span className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                            Catatan (opsional)
                        </span>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm focus:border-success focus:ring-1 focus:ring-success-border"
                            placeholder="Catatan pembayaran..."
                        />
                    </label>
                </div>

                {error && (
                    <p className="mt-2 text-xs font-medium text-danger">
                        {error}
                    </p>
                )}

                <div className="mt-5 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-border bg-surface py-2.5 text-sm font-bold text-text hover:bg-surface-muted"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={saving || !amount}
                        className="flex-[2] rounded-lg bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-50"
                    >
                        {saving
                            ? 'Menyimpan...'
                            : isPayout
                              ? 'Simpan Payout'
                              : 'Simpan Pembayaran'}
                    </button>
                </div>
            </form>
        </OwnerModalShell>
    );
}
