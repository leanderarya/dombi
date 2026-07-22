import { Check, MapPin } from 'lucide-react';
import FulfillmentToggle from '@/components/customer/fulfillment-toggle';
import Dialog from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useOutlet } from '@/contexts/outlet-context';
import type { OutletOption } from '@/contexts/outlet-context';

interface Props {
    open: boolean;
    onClose: () => void;
    fulfillmentType?: 'pickup' | 'delivery';
    onFulfillmentChange?: (type: 'pickup' | 'delivery') => void;
    deliveryDisabled?: boolean;
}

export default function OutletSheet({
    open,
    onClose,
    fulfillmentType,
    onFulfillmentChange,
    deliveryDisabled,
}: Props) {
    const { selectedOutlet, selectManual, outlets, loading, error, retry } =
        useOutlet();

    const handleSelect = (outlet: OutletOption) => {
        selectManual(outlet);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} title={fulfillmentType ? 'Outlet & Method' : 'Pilih Outlet'}>
            {fulfillmentType && onFulfillmentChange && (
                <div className="-mx-5 border-b border-border px-5 pb-3 pt-1">
                    <FulfillmentToggle
                        value={fulfillmentType}
                        onChange={onFulfillmentChange}
                        deliveryDisabled={deliveryDisabled}
                        variant="white"
                    />
                    <p className="mt-2 text-center text-[11px] text-text-muted">
                        {fulfillmentType === 'pickup'
                            ? 'Ambil di outlet tanpa antre'
                            : 'Diantar ke alamat Anda'}
                    </p>
                </div>
            )}
            <div className="-mx-5 -mb-4 space-y-1">
                {/* Loading state */}
                {loading && (
                    <div className="space-y-3 px-5 py-2">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
                                <div className="flex-1 space-y-1.5">
                                    <Skeleton className="h-4 w-2/3" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                                <Skeleton className="h-4 w-12" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Error state */}
                {!loading && error && (
                    <div className="px-5 py-6 text-center">
                        <p className="mb-3 text-sm text-text-muted">{error}</p>
                        <button
                            type="button"
                            onClick={retry}
                            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white active:opacity-80"
                        >
                            Coba Lagi
                        </button>
                    </div>
                )}

                {/* Empty state */}
                {!loading && !error && outlets.length === 0 && (
                    <div className="px-5 py-6 text-center">
                        <MapPin className="mx-auto mb-2 h-8 w-8 text-text-subtle" />
                        <p className="text-sm text-text-muted">
                            Tidak ada outlet tersedia
                        </p>
                    </div>
                )}

                {/* Outlet list */}
                {!loading && !error && outlets.length > 0 && (
                    <div className="max-h-[60vh] overflow-y-auto">
                        {outlets.map((outlet) => {
                            const isSelected = selectedOutlet?.id === outlet.id;

                            return (
                                <button
                                    key={outlet.id}
                                    type="button"
                                    onClick={() => handleSelect(outlet)}
                                    disabled={outlet.is_open === false}
                                    className={`flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors active:bg-surface-muted ${
                                        isSelected ? 'bg-emerald-50' : ''
                                    } ${
                                        outlet.is_open === false
                                            ? 'cursor-not-allowed opacity-50'
                                            : ''
                                    }`}
                                >
                                    {/* Check indicator */}
                                    <div
                                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                                            isSelected
                                                ? 'border-emerald-600 bg-emerald-600'
                                                : 'border-border'
                                        }`}
                                    >
                                        {isSelected && (
                                            <Check className="h-2.5 w-2.5 text-white" />
                                        )}
                                    </div>

                                    {/* Outlet info + distance inline */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-sm font-semibold text-text">
                                                {outlet.name}
                                            </span>
                                            {outlet.distance_km !== null &&
                                                outlet.distance_km !== undefined && (
                                                    <span className="shrink-0 text-[11px] text-text-muted tabular-nums">
                                                        {outlet.distance_km.toFixed(1)} km
                                                    </span>
                                                )}
                                            <span className={`ml-auto shrink-0 text-[10px] font-semibold ${
                                                outlet.is_open === false
                                                    ? 'text-red-600'
                                                    : outlet.stock_available
                                                        ? 'text-emerald-600'
                                                        : 'text-amber-600'
                                            }`}>
                                                {outlet.is_open === false
                                                    ? 'Tutup'
                                                    : outlet.stock_available
                                                        ? 'Tersedia'
                                                        : 'Terbatas'}
                                            </span>
                                        </div>
                                        <div className="truncate text-[11px] text-text-subtle">
                                            {outlet.address}
                                        </div>
                                        {outlet.is_open === false && (
                                            <div className="mt-0.5 text-[11px] font-medium text-red-600">
                                                Tutup{outlet.next_open ? ` • Buka ${outlet.next_open}` : ''}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </Dialog>
    );
}
