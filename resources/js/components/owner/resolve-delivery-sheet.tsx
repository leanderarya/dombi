import { useForm } from '@inertiajs/react';
import { Package, TriangleAlert } from 'lucide-react';
import { useReducer } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import Dialog from '@/components/ui/dialog';
import {
    closeResolveDeliverySheet,
    initialResolveDeliveryDialogState,
    resolveDeliveryDialogReducer,
} from './resolve-delivery-state';

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
        inventoryColor: 'text-info-text',
        ctaLabel: 'Tugaskan Kurir Baru',
        destructive: false,
    },
    {
        value: 'refund',
        label: 'Refund',
        description:
            'Batalkan order dan proses refund manual via transfer bank.',
        inventoryNote:
            'Reserved stock akan dilepas. Proses refund dilakukan di luar sistem.',
        inventoryColor: 'text-warning-text',
        ctaLabel: 'Proses Refund',
        destructive: true,
    },
    {
        value: 'cancelled_and_released',
        label: 'Batalkan & Lepas Stok',
        description:
            'Batalkan order dan kembalikan stok ke inventory tanpa refund.',
        inventoryNote: 'Reserved stock akan dilepas kembali ke inventory.',
        inventoryColor: 'text-danger-text',
        ctaLabel: 'Batalkan Pesanan',
        destructive: true,
    },
];

export default function ResolveDeliverySheet({
    delivery,
    open,
    onClose,
}: Props) {
    const form = useForm({ resolution: '', resolution_notes: '' });
    const [dialogState, dispatchDialog] = useReducer(
        resolveDeliveryDialogReducer,
        initialResolveDeliveryDialogState,
    );
    const { confirmDestructive } = dialogState;

    const selectedOption = resolutionOptions.find(
        (o) => o.value === form.data.resolution,
    );
    const isDestructive = selectedOption?.destructive ?? false;

    const closeSheet = () =>
        closeResolveDeliverySheet({
            resetForm: form.reset,
            resetDialog: () => dispatchDialog({ type: 'reset' }),
            onClose,
        });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (isDestructive && !confirmDestructive) {
            dispatchDialog({ type: 'confirm-destructive' });

            return;
        }

        form.post(`/owner/deliveries/${delivery.id}/resolve`, {
            preserveScroll: true,
            onSuccess: () => {
                closeSheet();
                toast.success('Pengiriman diselesaikan');
            },
            onError: (errors) =>
                toast.error(Object.values(errors).flat().join(', ')),
        });
    }

    const order = delivery.order;

    return (
        <Dialog
            open={open}
            onClose={closeSheet}
            title="Selesaikan Pengiriman Gagal"
        >
            <p className="text-sm text-text-muted">
                Pilih tindakan operasional untuk order ini.
            </p>
            <div className="mt-4">
                {/* Incident Summary */}
                <div className="rounded-lg border border-danger-border bg-danger-bg/50 p-3">
                    <div className="text-xs font-bold tracking-wider text-danger uppercase">
                        Insiden
                    </div>
                    <div className="mt-1.5 space-y-1 text-xs">
                        <div className="flex justify-between">
                            <span className="text-text-muted">Alasan</span>
                            <span className="font-medium text-text">
                                {delivery.failed_reason ?? '-'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-muted">Kurir</span>
                            <span className="text-text">
                                {delivery.courier?.name ?? '-'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-muted">Pelanggan</span>
                            <span className="text-text">
                                {order?.customer_name ?? '-'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-muted">Outlet</span>
                            <span className="text-text">
                                {order?.outlet?.name ?? '-'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Resolution Options */}
                <form onSubmit={handleSubmit}>
                    <div className="mt-4 space-y-2">
                        {resolutionOptions.map((opt) => {
                            const isSelected =
                                form.data.resolution === opt.value;

                            return (
                                <label
                                    key={opt.value}
                                    className={`block rounded-lg border p-3 transition-all duration-150 active:opacity-80 ${
                                        isSelected
                                            ? opt.destructive
                                                ? 'border-danger bg-danger-bg/30'
                                                : 'border-success-border bg-success-bg/20'
                                            : 'border-border'
                                    }`}
                                >
                                    <div className="flex items-start gap-2.5">
                                        <div
                                            className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${isSelected ? (opt.destructive ? 'border-danger bg-danger' : 'border-primary bg-primary') : 'border-border-strong'}`}
                                        >
                                            {isSelected && (
                                                <div className="flex h-full items-center justify-center">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-surface" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold text-text">
                                                {opt.label}
                                            </div>
                                            <div className="mt-0.5 text-xs text-text-muted">
                                                {opt.description}
                                            </div>
                                        </div>
                                    </div>
                                    <input
                                        type="radio"
                                        name="resolution"
                                        value={opt.value}
                                        checked={isSelected}
                                        onChange={() => {
                                            form.setData(
                                                'resolution',
                                                opt.value,
                                            );
                                            dispatchDialog({ type: 'reset' });
                                        }}
                                        className="sr-only"
                                    />
                                </label>
                            );
                        })}
                    </div>
                    {form.errors.resolution && (
                        <p className="mt-1.5 text-xs text-danger">
                            {form.errors.resolution}
                        </p>
                    )}

                    {/* Inventory Impact */}
                    {selectedOption && (
                        <div
                            className={`mt-3 flex items-center gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-xs font-medium ${selectedOption.inventoryColor}`}
                        >
                            <Package className="h-4 w-4" />{' '}
                            {selectedOption.inventoryNote}
                        </div>
                    )}

                    {/* Notes */}
                    <div className="mt-3">
                        <textarea
                            value={form.data.resolution_notes}
                            onChange={(e) =>
                                form.setData('resolution_notes', e.target.value)
                            }
                            className="min-h-16 w-full rounded-lg border border-border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-success-border focus:ring-1 focus:ring-success-border"
                            placeholder="Tambahkan catatan operasional (wajib)..."
                            required
                        />
                        {form.errors.resolution_notes && (
                            <p className="mt-1 text-xs text-danger">
                                {form.errors.resolution_notes}
                            </p>
                        )}
                    </div>

                    {/* Destructive Confirmation */}
                    {isDestructive && confirmDestructive && (
                        <div className="mt-2 flex items-center gap-2 rounded-md border border-danger-border bg-danger-bg p-2 text-xs font-medium text-danger-text">
                            <TriangleAlert className="h-4 w-4 shrink-0" />{' '}
                            Tindakan ini akan melepas reserved stock dan
                            membatalkan order secara permanen.
                        </div>
                    )}

                    {/* Submit */}
                    <Button
                        type="submit"
                        variant={isDestructive ? 'destructive' : 'default'}
                        disabled={
                            !form.data.resolution ||
                            !form.data.resolution_notes ||
                            form.processing
                        }
                        className="mt-3 w-full"
                    >
                        {form.processing
                            ? 'Memproses...'
                            : confirmDestructive && isDestructive
                              ? 'Konfirmasi Batalkan Pesanan'
                              : (selectedOption?.ctaLabel ?? 'Pilih Tindakan')}
                    </Button>
                </form>
            </div>
        </Dialog>
    );
}
