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

export default function DeliveryQuoteCard({
    outlet,
    distance_km,
    delivery_fee,
    is_serviceable,
}: Props) {
    if (!is_serviceable) {
        return (
            <div className="rounded-thumb border border-danger-border bg-danger-bg p-4">
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-danger-text" />
                    <div className="text-sm font-semibold text-danger-text">
                        Lokasi berada di luar jangkauan Kurir Dombi
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-thumb border border-primary/20 bg-primary-light p-4">
            <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 shrink-0 text-primary" />
                <div className="text-sm font-semibold text-primary">
                    Kurir Dombi
                </div>
            </div>
            <div className="mt-2 text-sm text-primary">{outlet.name}</div>
            <div className="mt-1 text-xs text-primary">
                {formatDistance(distance_km)}
            </div>
            <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-primary">Ongkir</span>
                <span className="text-base font-bold text-primary tabular-nums">
                    {formatCurrency(delivery_fee)}
                </span>
            </div>
        </div>
    );
}
