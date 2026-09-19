import { useForm } from '@inertiajs/react';
import { MapPin, Truck, Phone, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';

interface NearestCourier {
    id: number;
    name: string;
    phone: string | null;
    vehicle_type: string | null;
    vehicle_plate: string | null;
    photo: string | null;
    distance: number;
    active_delivery_count: number;
}

interface Props {
    outletId: number;
    orderId: number;
    deliveryFee: number;
    open: boolean;
    onClose: () => void;
}

export default function AssignCourierSheet({
    outletId,
    orderId,
    deliveryFee,
    open,
    onClose,
}: Props) {
    const [selectedCourier, setSelectedCourier] = useState<number | null>(null);
    const [couriers, setCouriers] = useState<NearestCourier[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const form = useForm({ courier_id: '' });

    const [courierType, setCourierType] = useState<'dombi' | 'eksternal'>(
        'dombi',
    );
    const [externalName, setExternalName] = useState('');
    const [externalPhone, setExternalPhone] = useState('');
    const [externalPlate, setExternalPlate] = useState('');
    const [courierCost, setCourierCost] = useState('');

    const costNum = parseFloat(courierCost) || 0;
    const margin = deliveryFee - costNum;
    const isLoss = margin < 0;

    const fetchNearestCouriers = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/outlet/api/outlets/${outletId}/nearest-couriers`,
            );

            if (!response.ok) {
                throw new Error('Gagal memuat data kurir');
            }

            const data = await response.json();
            setCouriers(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
        } finally {
            setLoading(false);
        }
    }, [outletId]);

    useEffect(() => {
        if (open) {
            queueMicrotask(() => {
                fetchNearestCouriers();
                setSelectedCourier(null);
                form.reset();
            });
        }
    }, [open, fetchNearestCouriers, form]);

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

    function handleSubmit() {
        if (courierType === 'dombi') {
            if (!selectedCourier) {
                return;
            }

            form.transform(() => ({
                courier_id: String(selectedCourier),
                courier_type: 'dombi',
            }));
        } else {
            if (!externalName || !courierCost) {
                return;
            }

            form.transform(() => ({
                courier_type: 'eksternal',
                external_courier_name: externalName,
                external_courier_phone: externalPhone,
                external_plate_number: externalPlate,
                courier_cost: courierCost,
            }));
        }

        form.post(`/outlet/orders/${orderId}/assign-courier`, {
            onSuccess: () => onClose(),
            preserveScroll: true,
        });
    }

    function getDistanceText(distance: number): string {
        if (distance < 1) {
            return `${Math.round(distance * 1000)}m`;
        }

        return `${distance.toFixed(1)}km`;
    }

    function getVehicleIcon(type: string | null) {
        if (!type) {
            return <Truck className="h-4 w-4 text-text-subtle" />;
        }

        switch (type.toLowerCase()) {
            case 'motorcycle':
            case 'motor':
                return <Truck className="h-4 w-4 text-info" />;
            case 'car':
            case 'mobil':
                return <Truck className="h-4 w-4 text-primary" />;
            default:
                return <Truck className="h-4 w-4 text-text-subtle" />;
        }
    }

    if (!open) {
        return null;
    }

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-end justify-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-courier-title"
        >
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div
                className="relative w-full max-w-lg animate-[slideUp_200ms_ease-out] rounded-t-2xl bg-surface pb-safe"
                style={{ maxHeight: '80vh', overflowY: 'auto' }}
            >
                {/* Handle */}
                <div className="sticky top-0 z-10 flex justify-center rounded-t-2xl bg-surface pt-3 pb-2">
                    <div className="h-1 w-12 rounded-full bg-border-strong" />
                </div>

                <div className="px-4 pb-4">
                    {/* Header */}
                    <div>
                        <h2
                            id="assign-courier-title"
                            className="text-base font-bold text-text"
                        >
                            Assign Kurir
                        </h2>
                        <p className="mt-0.5 text-[11px] text-text-muted">
                            Pilih kurir terdekat untuk mengambil pesanan.
                        </p>
                    </div>

                    {/* Tab Switch */}
                    <div className="mt-3 flex rounded-lg border border-border bg-surface-muted p-0.5">
                        <button
                            type="button"
                            onClick={() => setCourierType('dombi')}
                            aria-pressed={courierType === 'dombi'}
                            className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                                courierType === 'dombi'
                                    ? 'bg-surface text-text shadow-sm'
                                    : 'text-text-muted'
                            }`}
                        >
                            Kurir Dombi
                        </button>
                        <button
                            type="button"
                            onClick={() => setCourierType('eksternal')}
                            aria-pressed={courierType === 'eksternal'}
                            className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                                courierType === 'eksternal'
                                    ? 'bg-surface text-text shadow-sm'
                                    : 'text-text-muted'
                            }`}
                        >
                            Gojek / Grab
                        </button>
                    </div>

                    {/* Content */}
                    {courierType === 'dombi' ? (
                        <div className="mt-4">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
                                    <span className="ml-2 text-sm text-text-muted">
                                        Memuat kurir...
                                    </span>
                                </div>
                            ) : error ? (
                                <div className="rounded-lg border border-danger-border bg-danger-bg p-4 text-center">
                                    <p className="text-sm text-danger">
                                        {error}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={fetchNearestCouriers}
                                        className="mt-2 text-sm font-medium text-danger-text underline"
                                    >
                                        Coba lagi
                                    </button>
                                </div>
                            ) : couriers.length === 0 ? (
                                <div className="rounded-lg border border-border bg-surface p-4 text-center">
                                    <User className="mx-auto h-8 w-8 text-text-subtle" />
                                    <p className="mt-2 text-sm text-text-muted">
                                        Tidak ada kurir tersedia di sekitar
                                        outlet.
                                    </p>
                                    <p className="mt-1 text-[11px] text-text-subtle">
                                        Pastikan kurir online dan dalam radius
                                        50km.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="text-[11px] font-bold tracking-wider text-text-subtle uppercase">
                                        Kurir Terdekat ({couriers.length})
                                    </div>
                                    <div className="mt-2 space-y-2">
                                        {couriers.map((courier) => {
                                            const isSelected =
                                                selectedCourier === courier.id;
                                            const isBusy =
                                                courier.active_delivery_count >=
                                                3;

                                            return (
                                                <button
                                                    key={courier.id}
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedCourier(
                                                            courier.id,
                                                        )
                                                    }
                                                    aria-pressed={isSelected}
                                                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all duration-150 active:opacity-80 ${
                                                        isSelected
                                                            ? 'border-primary/30 bg-primary-light/30'
                                                            : 'border-border bg-surface'
                                                    } ${isBusy ? 'opacity-60' : ''}`}
                                                >
                                                    {/* Radio */}
                                                    <div
                                                        className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? 'border-primary bg-primary' : 'border-border-strong'}`}
                                                    >
                                                        {isSelected && (
                                                            <div className="h-1.5 w-1.5 rounded-full bg-surface" />
                                                        )}
                                                    </div>

                                                    {/* Avatar */}
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                                                        {courier.photo ? (
                                                            <img
                                                                src={
                                                                    courier.photo
                                                                }
                                                                alt={
                                                                    courier.name
                                                                }
                                                                className="h-10 w-10 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <span className="text-sm font-bold text-text-muted">
                                                                {courier.name.charAt(
                                                                    0,
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Info */}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-sm font-semibold text-text">
                                                                {courier.name}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-[11px] text-text-muted">
                                                                <MapPin className="h-3 w-3" />
                                                                {getDistanceText(
                                                                    courier.distance,
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="mt-1 flex items-center gap-3 text-[11px] text-text-muted">
                                                            {courier.phone && (
                                                                <div className="flex items-center gap-1">
                                                                    <Phone className="h-3 w-3" />
                                                                    {
                                                                        courier.phone
                                                                    }
                                                                </div>
                                                            )}
                                                            {courier.vehicle_type && (
                                                                <div className="flex items-center gap-1">
                                                                    {getVehicleIcon(
                                                                        courier.vehicle_type,
                                                                    )}
                                                                    {
                                                                        courier.vehicle_type
                                                                    }
                                                                    {courier.vehicle_plate &&
                                                                        ` • ${courier.vehicle_plate}`}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="mt-1.5 flex items-center gap-2">
                                                            <span
                                                                className={`text-[11px] ${courier.active_delivery_count === 0 ? 'text-success-text' : isBusy ? 'text-warning-text' : 'text-info'}`}
                                                            >
                                                                {courier.active_delivery_count ===
                                                                0
                                                                    ? 'Tersedia'
                                                                    : `${courier.active_delivery_count} tugas aktif`}
                                                            </span>
                                                            {isBusy && (
                                                                <span className="rounded bg-warning-bg px-1 py-0.5 text-[11px] font-bold text-warning-text">
                                                                    Sibuk
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="mt-4 space-y-3">
                            <div>
                                <label className="text-xs font-semibold text-text-muted">
                                    Nama Kurir
                                </label>
                                <input
                                    type="text"
                                    value={externalName}
                                    onChange={(e) =>
                                        setExternalName(e.target.value)
                                    }
                                    className="mt-1 w-full rounded-lg border border-border p-3 text-sm"
                                    placeholder="Nama driver Gojek/Grab"
                                />
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="text-xs font-semibold text-text-muted">
                                        No. HP
                                    </label>
                                    <input
                                        type="text"
                                        value={externalPhone}
                                        onChange={(e) =>
                                            setExternalPhone(e.target.value)
                                        }
                                        className="mt-1 w-full rounded-lg border border-border p-3 text-sm"
                                        placeholder="0812..."
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-semibold text-text-muted">
                                        Plat
                                    </label>
                                    <input
                                        type="text"
                                        value={externalPlate}
                                        onChange={(e) =>
                                            setExternalPlate(e.target.value)
                                        }
                                        className="mt-1 w-full rounded-lg border border-border p-3 text-sm"
                                        placeholder="B 1234 ABC"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-text-muted">
                                    Biaya Ongkir (Gojek)
                                </label>
                                <input
                                    type="number"
                                    value={courierCost}
                                    onChange={(e) =>
                                        setCourierCost(e.target.value)
                                    }
                                    className="mt-1 w-full rounded-lg border border-border p-3 text-sm"
                                    placeholder="25000"
                                    min={0}
                                />
                            </div>

                            {costNum > 0 && (
                                <div
                                    className={`rounded-lg border p-3 ${isLoss ? 'border-danger-border bg-danger-bg' : 'border-success-border bg-success-bg'}`}
                                >
                                    <div className="flex justify-between text-sm">
                                        <span className="text-text-muted">
                                            Ongkir Customer
                                        </span>
                                        <span className="font-semibold">
                                            Rp {deliveryFee.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-text-muted">
                                            Biaya Gojek
                                        </span>
                                        <span className="font-semibold">
                                            Rp {costNum.toLocaleString()}
                                        </span>
                                    </div>
                                    <div
                                        className={`mt-1 flex justify-between border-t pt-1 text-sm font-bold ${isLoss ? 'text-danger' : 'text-success-text'}`}
                                    >
                                        <span>Selisih</span>
                                        <span>
                                            {isLoss ? '⚠️' : '✅'} Rp{' '}
                                            {Math.abs(margin).toLocaleString()}{' '}
                                            {isLoss ? 'RUGI' : 'UNTUNG'}
                                        </span>
                                    </div>
                                    {isLoss && (
                                        <p className="mt-2 text-xs text-danger">
                                            Pengiriman ini merugi. Lanjutkan?
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {form.errors.courier_id && (
                        <p className="mt-2 text-xs text-danger">
                            {form.errors.courier_id}
                        </p>
                    )}

                    {/* Actions */}
                    <div className="mt-4 flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="cta"
                            onClick={onClose}
                            className="flex-1"
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            size="cta"
                            onClick={handleSubmit}
                            disabled={
                                courierType === 'dombi'
                                    ? !selectedCourier ||
                                      form.processing ||
                                      loading
                                    : !externalName ||
                                      !courierCost ||
                                      form.processing
                            }
                            className="flex-1"
                        >
                            {form.processing ? 'Mengassign...' : 'Assign Kurir'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}
