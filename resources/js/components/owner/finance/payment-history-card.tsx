import { Eye, Check, X } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/format';
import FinanceStatusBadge from './finance-status-badge';

interface Payment {
    id: number;
    outlet: { id: number; name: string };
    amount: number;
    payment_method: string;
    reference_number: string;
    payment_date: string;
    status: string;
    notes: string | null;
    rejection_reason: string | null;
    proof_image: string | null;
    verifier: { name: string } | null;
    verified_at: string | null;
    created_at: string;
}

interface Props {
    payment: Payment;
    onVerify: (id: number) => void;
    onReject: (id: number) => void;
    onShowProof: (url: string) => void;
    processing: boolean;
}

const METHOD_LABELS: Record<string, string> = {
    transfer_bank: 'Transfer Bank',
    cash: 'Tunai',
    qris: 'QRIS',
    other: 'Lainnya',
};

export default function PaymentHistoryCard({ payment, onVerify, onReject, onShowProof, processing }: Props) {
    const isPending = payment.status === 'pending_verification';

    return (
        <div className={`rounded-2xl border p-5 transition-all ${isPending ? 'border-amber-200 bg-amber-50/30 hover:shadow-sm' : 'border-slate-200 bg-white hover:shadow-sm'}`}>
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="text-base font-semibold text-slate-900">{payment.outlet.name}</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{formatCurrency(payment.amount)}</div>
                </div>
                <FinanceStatusBadge status={payment.status === 'pending_verification' ? 'pending' : payment.status} />
            </div>

            {/* Meta */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>{METHOD_LABELS[payment.payment_method] ?? payment.payment_method}</span>
                {payment.reference_number && (
                    <>
                        <span className="text-slate-300">•</span>
                        <span>Ref: {payment.reference_number}</span>
                    </>
                )}
                <span className="text-slate-300">•</span>
                <span>{formatDate(payment.payment_date)}</span>
            </div>

            {/* Notes */}
            {payment.notes && (
                <div className="mt-2 text-xs text-slate-500">{payment.notes}</div>
            )}

            {/* Rejection reason */}
            {payment.rejection_reason && (
                <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    Alasan ditolak: {payment.rejection_reason}
                </div>
            )}

            {/* Verifier info */}
            {payment.verifier && (
                <div className="mt-2 text-xs text-slate-400">
                    Diverifikasi oleh {payment.verifier.name}
                </div>
            )}

            {/* Proof indicator */}
            {payment.proof_image && (
                <button
                    type="button"
                    onClick={() => onShowProof(payment.proof_image!)}
                    className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                >
                    <Eye className="h-3.5 w-3.5" />
                    Lihat Bukti Transfer
                </button>
            )}

            {/* Actions */}
            {isPending && (
                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                    <button
                        type="button"
                        onClick={() => onVerify(payment.id)}
                        disabled={processing}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                        <Check className="h-4 w-4" />
                        Verifikasi
                    </button>
                    <button
                        type="button"
                        onClick={() => onReject(payment.id)}
                        disabled={processing}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                        <X className="h-4 w-4" />
                        Tolak
                    </button>
                </div>
            )}
        </div>
    );
}
