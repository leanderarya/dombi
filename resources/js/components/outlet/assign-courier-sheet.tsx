import { useForm } from '@inertiajs/react';
import { MapPin, Truck, Phone, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

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
    open: boolean;
    onClose: () => void;
}

export default function AssignCourierSheet({ outletId, orderId, open, onClose }: Props) {
    const [selectedCourier, setSelectedCourier] = useState<number | null>(null);
    const [couriers, setCouriers] = useState<NearestCourier[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const form = useForm({ courier_id: '' });

    useEffect(() => {
        if (open) {
            fetchNearestCouriers();
            setSelectedCourier(null);
            form.reset();
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

    async function fetchNearestCouriers() {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/outlet/api/outlets/${outletId}/nearest-couriers`);

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
    }

    function handleSubmit() {
        if (!selectedCourier) {
return;
}

        form.transform(() => ({ courier_id: String(selectedCourier) }));
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
return <Truck className="h-4 w-4 text-slate-400" />;
}

        switch (type.toLowerCase()) {
            case 'motorcycle':
            case 'motor':
                return <Truck className="h-4 w-4 text-blue-500" />;
            case 'car':
            case 'mobil':
                return <Truck className="h-4 w-4 text-emerald-500" />;
            default:
                return <Truck className="h-4 w-4 text-slate-400" />;
        }
    }

    if (!open) {
return null;
}

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-lg animate-[slideUp_200ms_ease-out] rounded-t-2xl bg-white pb-safe" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                {/* Handle */}
                <div className="sticky top-0 z-10 flex justify-center rounded-t-2xl bg-white pt-3 pb-2">
                    <div className="h-1 w-12 rounded-full bg-slate-300" />
                </div>

                <div className="px-4 pb-4">
                    {/* Header */}
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Assign Kurir</h2>
                        <p className="mt-0.5 text-[11px] text-slate-500">Pilih kurir terdekat untuk mengambil pesanan.</p>
                    </div>

                    {/* Content */}
                    <div className="mt-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
                                <span className="ml-2 text-sm text-slate-500">Memuat kurir...</span>
                            </div>
                        ) : error ? (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                                <p className="text-sm text-red-600">{error}</p>
                                <button
                                    type="button"
                                    onClick={fetchNearestCouriers}
                                    className="mt-2 text-sm font-medium text-red-700 underline"
                                >
                                    Coba lagi
                                </button>
                            </div>
                        ) : couriers.length === 0 ? (
                            <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                                <User className="mx-auto h-8 w-8 text-slate-300" />
                                <p className="mt-2 text-sm text-slate-500">Tidak ada kurir tersedia di sekitar outlet.</p>
                                <p className="mt-1 text-[11px] text-slate-400">Pastikan kurir online dan dalam radius 50km.</p>
                            </div>
                        ) : (
                            <>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    Kurir Terdekat ({couriers.length})
                                </div>
                                <div className="mt-2 space-y-2">
                                    {couriers.map((courier) => {
                                        const isSelected = selectedCourier === courier.id;
                                        const isBusy = courier.active_delivery_count >= 3;

                                        return (
                                            <button
                                                key={courier.id}
                                                type="button"
                                                onClick={() => setSelectedCourier(courier.id)}
                                                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all duration-150 active:opacity-80 ${
                                                    isSelected ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200 bg-white'
                                                } ${isBusy ? 'opacity-60' : ''}`}
                                            >
                                                {/* Radio */}
                                                <div className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>
                                                    {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                                </div>

                                                {/* Avatar */}
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
                                                    {courier.photo ? (
                                                        <img
                                                            src={courier.photo}
                                                            alt={courier.name}
                                                            className="h-10 w-10 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-sm font-bold text-slate-600">
                                                            {courier.name.charAt(0)}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-sm font-semibold text-slate-900">{courier.name}</div>
                                                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                                            <MapPin className="h-3 w-3" />
                                                            {getDistanceText(courier.distance)}
                                                        </div>
                                                    </div>

                                                    <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                                                        {courier.phone && (
                                                            <div className="flex items-center gap-1">
                                                                <Phone className="h-3 w-3" />
                                                                {courier.phone}
                                                            </div>
                                                        )}
                                                        {courier.vehicle_type && (
                                                            <div className="flex items-center gap-1">
                                                                {getVehicleIcon(courier.vehicle_type)}
                                                                {courier.vehicle_type}
                                                                {courier.vehicle_plate && ` • ${courier.vehicle_plate}`}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="mt-1.5 flex items-center gap-2">
                                                        <span className={`text-[11px] ${courier.active_delivery_count === 0 ? 'text-emerald-600' : isBusy ? 'text-amber-600' : 'text-blue-600'}`}>
                                                            {courier.active_delivery_count === 0 ? 'Tersedia' : `${courier.active_delivery_count} tugas aktif`}
                                                        </span>
                                                        {isBusy && (
                                                            <span className="rounded bg-amber-100 px-1 py-0.5 text-[11px] font-bold text-amber-700">Sibuk</span>
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

                    {form.errors.courier_id && <p className="mt-2 text-xs text-red-600">{form.errors.courier_id}</p>}

                    {/* Actions */}
                    <div className="mt-4 flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex min-h-[48px] flex-1 items-center justify-center rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 transition-all duration-150 active:opacity-80 active:bg-slate-50"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!selectedCourier || form.processing || loading}
                            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-700 text-sm font-bold text-white transition-all duration-150 active:opacity-80 active:bg-emerald-800 disabled:bg-slate-300"
                        >
                            {form.processing ? 'Mengassign...' : 'Assign Kurir'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}