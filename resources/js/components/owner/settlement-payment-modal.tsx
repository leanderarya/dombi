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
}: Props) {
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

        router.post(
            `/owner/finance/settlements/${outletId}/payments`,
            formData,
            {
                onSuccess: () => {
                    onClose();
                    resetForm();
                },
                onError: (errors: any) => {
                    setError(errors?.error ?? 'Gagal mencatat pembayaran.');
                },
                onFinish: () => setSaving(false),
            },
        );
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
            title="Catat Pembayaran"
            maxWidth="max-w-md"
        >
            <form onSubmit={handleSubmit}>
                <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Outlet</span>
                        <span className="font-medium text-slate-900">
                            {outletName}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">
                            Total Outstanding
                        </span>
                        <span className="font-semibold text-red-600">
                            {formatCurrency(outstanding)}
                        </span>
                    </div>
                    <p className="text-xs text-slate-400">
                        Pembayaran dialokasikan ke tagihan tertua terlebih
                        dahulu (FIFO).
                    </p>
                </div>

                <div className="mt-4 space-y-3">
                    <label className="block">
                        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            Nominal Diterima
                        </span>
                        <div className="relative mt-1">
                            <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-400">
                                Rp
                            </span>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                min={1}
                                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm font-bold tabular-nums focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                                placeholder="0"
                                autoFocus
                                required
                            />
                        </div>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            Metode Pembayaran
                        </span>
                        <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                        >
                            {PAYMENT_METHODS.map((m) => (
                                <option key={m.value} value={m.value}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            Nomor Referensi
                        </span>
                        <input
                            type="text"
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                            placeholder="BUKTI-001"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            Upload Bukti
                        </span>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) =>
                                setProofFile(e.target.files?.[0] ?? null)
                            }
                            className="mt-1 w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            Catatan (opsional)
                        </span>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                            placeholder="Catatan pembayaran..."
                        />
                    </label>
                </div>

                {error && (
                    <p className="mt-2 text-xs font-medium text-red-600">
                        {error}
                    </p>
                )}

                <div className="mt-5 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={saving || !amount}
                        className="flex-[2] rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {saving ? 'Menyimpan...' : 'Simpan Pembayaran'}
                    </button>
                </div>
            </form>
        </OwnerModalShell>
    );
}
