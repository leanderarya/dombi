import { Link } from '@inertiajs/react';
import {
    AlertTriangle,
    MapPin,
    Navigation,
    Package,
    Phone,
    Store,
    UserCheck,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';

const MAPS_LINK = 'https://www.google.com/maps/dir/?api=1&destination=';
const WA_LINK = 'https://wa.me/';

interface OrderItem {
    product_name: string;
    quantity: number;
    price: number;
    subtotal: number;
    variant_name?: string;
}

interface OutletInfo {
    name: string;
    address?: string;
    phone?: string;
    latitude?: number;
    longitude?: number;
}

interface CourierInfo {
    name: string;
    phone?: string;
}

interface DeliveryInfo {
    courier?: CourierInfo;
    failed_reason?: string | null;
}

interface Props {
    items: OrderItem[];
    subtotal: number;
    deliveryFee: number;
    total: number;
    isPickup: boolean;
    paymentMethod: string;
    outlet?: OutletInfo | null;
    delivery?: DeliveryInfo | null;
    customerAddress?: string | null;
    customerAddressDetail?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    fulfillmentType?: string;
}

export default function OrderInfoCard({
    items,
    subtotal,
    deliveryFee,
    total,
    isPickup,
    paymentMethod,
    outlet,
    delivery,
    customerAddress,
    customerAddressDetail,
    latitude,
    longitude,
    fulfillmentType,
}: Props) {
    return (
        <div className="mt-4 divide-y divide-border/50 rounded-xl border border-border bg-white">
            {/* Items */}
            <div className="p-3">
                <div className="mb-2 flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-text-subtle" />
                    <span className="text-[11px] text-text-subtle">
                        Pesanan
                    </span>
                </div>
                <div className="space-y-1">
                    {items.map((item, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between text-xs"
                        >
                            <div className="min-w-0">
                                <span className="text-text">
                                    {item.product_name}
                                </span>
                                {item.variant_name && (
                                    <span className="ml-1 text-[10px] text-text-subtle">
                                        {item.variant_name}
                                    </span>
                                )}
                                <span className="ml-1 text-[10px] text-text-subtle">
                                    x{item.quantity}
                                </span>
                            </div>
                            <span className="shrink-0 font-medium text-text tabular-nums">
                                {formatCurrency(item.subtotal)}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                    <SummaryRow
                        label="Metode"
                        value={isPickup ? 'Ambil di Outlet' : 'Kirim ke Alamat'}
                    />
                    <SummaryRow label="Pembayaran" value={paymentMethod} />
                    {Number(deliveryFee) > 0 && (
                        <SummaryRow
                            label="Ongkir"
                            value={formatCurrency(deliveryFee)}
                        />
                    )}
                    <div className="flex items-center justify-between border-t border-border/50 pt-1 text-xs font-semibold text-text">
                        <span>Total</span>
                        <span className="tabular-nums">
                            {formatCurrency(total)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Outlet */}
            {outlet && (
                <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <Store className="h-3.5 w-3.5 text-text-subtle" />
                                <span className="truncate text-xs font-semibold text-text">
                                    {outlet.name}
                                </span>
                            </div>
                            {outlet.address && (
                                <div className="mt-0.5 line-clamp-1 text-[11px] text-text-muted">
                                    {outlet.address}
                                </div>
                            )}
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                            {outlet.latitude && outlet.longitude && (
                                <a
                                    href={`${MAPS_LINK}${outlet.latitude},${outlet.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-bold text-white active:opacity-80"
                                >
                                    <Navigation className="h-3 w-3" />
                                    Navigasi
                                </a>
                            )}
                            {outlet.phone && (
                                <a
                                    href={`${WA_LINK}${outlet.phone.replace(/^0/, '62')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[11px] font-semibold text-text active:opacity-80"
                                >
                                    <Phone className="h-3 w-3" />
                                    WA
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delivery address */}
            {!isPickup && customerAddress && (
                <div className="p-3">
                    <div className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-subtle" />
                        <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 text-xs text-text">
                                {customerAddress}
                            </div>
                            {customerAddressDetail && (
                                <div className="mt-0.5 text-[10px] text-text-muted">
                                    {customerAddressDetail}
                                </div>
                            )}
                            {latitude && longitude && (
                                <a
                                    href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary active:opacity-80"
                                >
                                    <MapPin className="h-3 w-3" />
                                    Buka di Maps
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Courier */}
            {delivery?.courier && (
                <div className="p-3">
                    <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-muted">
                            <UserCheck className="h-3.5 w-3.5 text-text-muted" />
                        </div>
                        <div>
                            <div className="text-[10px] text-text-subtle">
                                Kurir
                            </div>
                            <div className="text-xs font-semibold text-text">
                                {delivery.courier.name}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Failed delivery */}
            {delivery?.failed_reason && (
                <div className="bg-amber-50 p-3">
                    <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-xs font-semibold text-amber-700">
                            Pengiriman Gagal: {delivery.failed_reason}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

function SummaryRow({
    label,
    value,
    accent,
}: {
    label: string;
    value: string;
    accent?: boolean;
}) {
    return (
        <div className="flex items-center justify-between text-[10px] text-text-muted">
            <span>{label}</span>
            <span
                className={`font-medium ${accent ? 'text-emerald-600' : 'text-text'}`}
            >
                {value}
            </span>
        </div>
    );
}
