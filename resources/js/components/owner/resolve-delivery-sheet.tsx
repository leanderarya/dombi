import { useForm } from '@inertiajs/react';
import { Package, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/format';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface Props {
    delivery: any;
    open: boolean;
    onClose: () => void;
}

const resolutionOptions = [
    {
        value: 'retry_delivery',
        label: 'Kirim Ulang',
        description: 'Assign courier baru dan lanjutkan pengiriman.',
        inventoryNote: 'Reserved stock tetap aktif.',
        inventoryColor: 'text-blue-700',
        ctaLabel: 'Tugaskan Kurir Baru',
        destructive: false,
    },
    {
        value: 'refund',
        label: 'Refund',
        description: 'Batalkan order dan proses refund manual via transfer bank.',
        inventoryNote: 'Reserved stock akan dilepas. Proses refund dilakukan di luar sistem.',
        inventoryColor: 'text-amber-700',
        ctaLabel: 'Proses Refund',
        destructive: true,
    },
    {
        value: 'cancelled_and_released',
        label: 'Batalkan & Lepas Stok',
        description: 'Batalkan order dan kembalikan stok ke inventory tanpa refund.',
        inventoryNote: 'Reserved stock akan dilepas kembali ke inventory.',
        inventoryColor: 'text-red-700',
        ctaLabel: 'Batalkan Pesanan',
        destructive: true,
    },
];

export default function ResolveDeliverySheet({ delivery, open, onClose }: Props) {
    const form = useForm({ resolution: '', resolution_notes: '' });
    const [confirmDestructive, setConfirmDestructive] = useState(false);

    const selectedOption = resolutionOptions.find((o) => o.value === form.data.resolution);
    const isDestructive = selectedOption?.destructive ?? false;

    // Reset state when sheet opens/closes
    useEffect(() => {
        if (!open) {
            form.reset();
            setConfirmDestructive(false);
        }
    }, [open]);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (isDestructive && !confirmDestructive) {
            setConfirmDestructive(true);

            return;
        }

        form.post(`/owner/deliveries/${delivery.id}/resolve`, {
            onSuccess: () => onClose(),
        });
    }

    const order = delivery.order;

    return (
        <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <SheetContent side="bottom">
                <SheetHeader>
                    <SheetTitle>Selesaikan Pengiriman Gagal</SheetTitle>
                    <SheetDescription>Pilih tindakan operasional untuk order ini.</SheetDescription>
                </SheetHeader>
                <div className="mt-4 px-4 pb-4">
                    {/* Incident Summary */}
                    <div className="rounded-lg border border-red-100 bg-red-50/50 p-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-red-600">Insiden</div>
                        <div className="mt-1.5 space-y-1 text-xs">
                            <div className="flex justify-between"><span className="text-slate-500">Alasan</span><span className="font-medium text-slate-900">{delivery.failed_reason ?? '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Kurir</span><span className="text-slate-700">{delivery.courier?.name ?? '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Pelanggan</span><span className="text-slate-700">{order?.customer_name ?? '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Outlet</span><span className="text-slate-700">{order?.outlet?.name ?? '-'}</span></div>
                        </div>
                    </div>

                    {/* Resolution Options */}
                    <form onSubmit={handleSubmit}>
                        <div className="mt-4 space-y-2">
                            {resolutionOptions.map((opt) => {
                                const isSelected = form.data.resolution === opt.value;

                                return (
                                    <label
                                        key={opt.value}
                                        className={`block rounded-lg border p-3 transition-all duration-150 active:opacity-80 ${
                                            isSelected
                                                ? opt.destructive ? 'border-red-300 bg-red-50/30' : 'border-emerald-300 bg-emerald-50/20'
                                                : 'border-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${isSelected ? opt.destructive ? 'border-red-600 bg-red-600' : 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>
                                                {isSelected && <div className="flex h-full items-center justify-center"><div className="h-1.5 w-1.5 rounded-full bg-white" /></div>}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-semibold text-slate-900">{opt.label}</div>
                                                <div className="mt-0.5 text-xs text-slate-500">{opt.description}</div>
                                            </div>
                                        </div>
                                        <input type="radio" name="resolution" value={opt.value} checked={isSelected} onChange={() => {
 form.setData('resolution', opt.value); setConfirmDestructive(false); 
 }} className="sr-only" />
                                    </label>
                                );
                            })}
                        </div>
                        {form.errors.resolution && <p className="mt-1.5 text-xs text-red-600">{form.errors.resolution}</p>}

                        {/* Inventory Impact */}
                        {selectedOption && (
                            <div className={`mt-3 flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium ${selectedOption.inventoryColor}`}>
                                <Package className="h-4 w-4" /> {selectedOption.inventoryNote}
                            </div>
                        )}

                        {/* Notes */}
                        <div className="mt-3">
                            <textarea
                                value={form.data.resolution_notes}
                                onChange={(e) => form.setData('resolution_notes', e.target.value)}
                                className="min-h-16 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                                placeholder="Tambahkan catatan operasional (wajib)..."
                                required
                            />
                            {form.errors.resolution_notes && <p className="mt-1 text-xs text-red-600">{form.errors.resolution_notes}</p>}
                        </div>

                        {/* Destructive Confirmation */}
                        {isDestructive && confirmDestructive && (
                            <div className="mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-800">
                                <TriangleAlert className="h-4 w-4 shrink-0" /> Tindakan ini akan melepas reserved stock dan membatalkan order secara permanen.
                            </div>
                        )}

                        {/* Submit */}
                        <Button
                            type="submit"
                            variant={isDestructive ? "destructive" : "default"}
                            disabled={!form.data.resolution || !form.data.resolution_notes || form.processing}
                            className="mt-3 w-full"
                        >
                            {form.processing ? 'Memproses...' : (confirmDestructive && isDestructive) ? 'Konfirmasi Batalkan Pesanan' : selectedOption?.ctaLabel ?? 'Pilih Tindakan'}
                        </Button>
                    </form>
                </div>
            </SheetContent>
        </Sheet>
    );
}
