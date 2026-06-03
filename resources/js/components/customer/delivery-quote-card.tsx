import { AlertCircle, Truck } from 'lucide-react';
import { formatCurrency, formatDistance } from '@/lib/format';

type Props = {
    outlet: {
        name: string;
    };
    distance_km: number;
    delivery_fee: number;
    is_serviceable: boolean;
};

export default function DeliveryQuoteCard({ outlet, distance_km, delivery_fee, is_serviceable }: Props) {
    if (!is_serviceable) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                    <div className="text-sm font-semibold text-red-800">Lokasi berada di luar jangkauan Kurir Dombi</div>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 shrink-0 text-emerald-600" />
                <div className="text-sm font-semibold text-emerald-900">Kurir Dombi</div>
            </div>
            <div className="mt-2 text-sm text-emerald-800">{outlet.name}</div>
            <div className="mt-1 text-xs text-emerald-700">{formatDistance(distance_km)}</div>
            <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-emerald-700">Ongkir</span>
                <span className="text-base font-bold tabular-nums text-emerald-900">{formatCurrency(delivery_fee)}</span>
            </div>
        </div>
    );
}
