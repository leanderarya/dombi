import { AlertCircle, MapPin, Truck } from 'lucide-react';
import { useState } from 'react';
import LocationSheet from '@/components/customer/location-sheet';
import { useCustomerLocation } from '@/lib/customer-location';
import { formatCurrency, formatDistance } from '@/lib/format';

type ServiceStatus = {
    is_serviceable: boolean;
    outlet_name: string;
    distance_km: number;
    delivery_fee: number;
};

type Props = {
    serviceStatus?: ServiceStatus | null;
};

export default function LocationServiceBanner({ serviceStatus }: Props) {
    const { summary } = useCustomerLocation();
    const [sheetOpen, setSheetOpen] = useState(false);

    if (!summary && !serviceStatus) {
        return null;
    }

    return (
        <>
            <section>
                <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left active:bg-slate-50"
                >
                    {serviceStatus ? (
                        <>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    {serviceStatus.is_serviceable ? (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <Truck className="h-4 w-4 shrink-0 text-emerald-600" />
                                                <div className="text-sm font-semibold text-emerald-800">Kurir Dombi tersedia di lokasi Anda</div>
                                            </div>
                                            <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
                                                <span className="font-semibold text-slate-900">{serviceStatus.outlet_name}</span>
                                                <span>·</span>
                                                <span>{formatDistance(serviceStatus.distance_km)}</span>
                                                <span>·</span>
                                                <span className="font-semibold text-emerald-700">{formatCurrency(serviceStatus.delivery_fee)}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                                                <div className="text-sm font-semibold text-amber-800">Lokasi Anda di luar jangkauan Kurir Dombi</div>
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500">
                                                Outlet terdekat: {serviceStatus.outlet_name} ({formatDistance(serviceStatus.distance_km)})
                                            </div>
                                        </>
                                    )}
                                </div>
                                <span className="shrink-0 text-xs font-semibold text-slate-400">Ubah</span>
                            </div>

                            {serviceStatus.is_serviceable && (
                                <div className="mt-3 flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-emerald-700">Outlet Terdekat</span>
                                    <span className="text-xs text-slate-400">·</span>
                                    <span className="text-xs font-semibold text-slate-700">{serviceStatus.outlet_name}</span>
                                    <span className="text-xs text-slate-400">·</span>
                                    <span className="text-xs text-emerald-700">{formatDistance(serviceStatus.distance_km)}</span>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                                <div>
                                    <div className="text-sm font-semibold text-slate-900">{summary || 'Tentukan Lokasi Anda'}</div>
                                    <div className="mt-0.5 text-xs text-slate-500">Ketuk untuk mengatur lokasi pengiriman</div>
                                </div>
                            </div>
                            <span className="text-xs font-semibold text-emerald-700">Atur</span>
                        </div>
                    )}
                </button>
            </section>
            <LocationSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
        </>
    );
}
