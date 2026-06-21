import { useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/format';

interface Courier {
    id: number;
    name: string;
    active_deliveries?: number;
}

interface Props {
    order: any;
    couriers: Courier[];
    open: boolean;
    onClose: () => void;
    /** URL to POST the courier assignment to. Must include {orderId} placeholder or be pre-formatted. */
    assignUrl?: string;
}

export default function AssignCourierSheet({ order, couriers, open, onClose, assignUrl }: Props) {
    const [selectedCourier, setSelectedCourier] = useState<number | null>(null);
    const form = useForm({ courier_id: '' });

    useEffect(() => {
        if (!open) {
 setSelectedCourier(null); form.reset(); 
}
    }, [open]);

    useEffect(() => {
        if (open) {
document.body.style.overflow = 'hidden';
} else {
document.body.style.overflow = '';
}

        return () => {
 document.body.style.overflow = ''; 
};
    }, [open]);

    useEffect(() => {
        if (!open) {
return;
}

        const handler = (e: KeyboardEvent) => {
 if (e.key === 'Escape') {
onClose();
} 
};
        document.addEventListener('keydown', handler);

        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open || !order) {
return null;
}

    const submitUrl = assignUrl ?? `/owner/orders/${order.id}/assign-courier`;

    function handleSubmit() {
        if (!selectedCourier) {
return;
}

        form.transform(() => ({ courier_id: String(selectedCourier) }));
        form.post(submitUrl, {
            onSuccess: () => onClose(),
            preserveScroll: true,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-lg animate-[slideUp_200ms_ease-out] rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                {/* Handle */}
                <div className="sticky top-0 z-10 flex justify-center rounded-t-2xl bg-white pt-3 pb-2">
                    <div className="h-1 w-12 rounded-full bg-slate-300" />
                </div>

                <div className="px-4 pb-4">
                    {/* Header */}
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Assign Courier</h2>
                        <p className="mt-0.5 text-[11px] text-slate-500">Pilih kurir untuk melanjutkan pengiriman.</p>
                    </div>

                    {/* Order Summary */}
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold tabular-nums text-slate-900">{order.order_code}</span>
                            <span className="text-xs tabular-nums text-slate-500">{formatCurrency(order.total)}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">{order.customer_name} · {order.outlet?.name ?? '-'}</div>
                    </div>

                    {/* Courier List */}
                    <div className="mt-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Available Couriers</div>
                        <div className="mt-2 space-y-1.5">
                            {couriers.length === 0 ? (
                                <div className="rounded-lg border border-slate-200 bg-white p-4 text-center text-xs text-slate-500">
                                    Tidak ada kurir aktif tersedia.
                                </div>
                            ) : (
                                couriers.map((courier) => {
                                    const isSelected = selectedCourier === courier.id;
                                    const activeCount = courier.active_deliveries ?? 0;
                                    const isBusy = activeCount >= 3;

                                    return (
                                        <button
                                            key={courier.id}
                                            type="button"
                                            onClick={() => setSelectedCourier(courier.id)}
                                            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all duration-150 active:opacity-80 ${
                                                isSelected ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200 bg-white'
                                            } ${isBusy ? 'opacity-60' : ''}`}
                                        >
                                            <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>
                                                {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                            </div>
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                                                {courier.name.charAt(0)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-semibold text-slate-900">{courier.name}</div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[11px] ${activeCount === 0 ? 'text-emerald-600' : isBusy ? 'text-amber-600' : 'text-blue-600'}`}>
                                                        {activeCount === 0 ? 'Tersedia' : `${activeCount} tugas aktif`}
                                                    </span>
                                                    {isBusy && (
                                                        <span className="rounded bg-amber-100 px-1 py-0.5 text-[11px] font-bold text-amber-700">Sibuk</span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {form.errors.courier_id && <p className="mt-2 text-xs text-red-600">{form.errors.courier_id}</p>}

                    {/* Actions */}
                    <div className="mt-4 flex gap-2">
                        <button type="button" onClick={onClose} className="flex min-h-[48px] flex-1 items-center justify-center rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 transition-all duration-150 active:opacity-80 active:bg-slate-50">
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!selectedCourier || form.processing}
                            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-700 text-sm font-bold text-white transition-all duration-150 active:opacity-80 active:bg-emerald-800 disabled:bg-slate-300"
                        >
                            {form.processing ? 'Assigning...' : 'Assign Courier'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
