import {
    AlertTriangle,
    ChevronDown,
    Copy,
    CreditCard,
    Download,
    MapPin,
    Navigation,
    Receipt,
    Store,
    UserCheck,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { copyToClipboard } from '@/lib/clipboard';
import { formatCurrency } from '@/lib/format';

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
    vehicle_plate?: string | null;
}

interface DeliveryInfo {
    courier?: CourierInfo | null;
    external_courier_name?: string | null;
    external_plate_number?: string | null;
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
    customerName?: string;
    orderCode?: string;
    status?: string;
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
    orderCode,
}: Props) {
    const [itemsOpen, setItemsOpen] = useState(false);
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [receiptOpen, setReceiptOpen] = useState(false);

    const handleCopyOrderId = async () => {
        if (!orderCode) {
            return;
        }

        await copyToClipboard(orderCode);
        toast.success('ID Pesanan berhasil disalin!');
    };

    return (
        <div className="space-y-3">
            {/* Lokasi Pengambilan / Alamat */}
            <section className="bg-surface p-4 shadow-card">
                <h2 className="mb-3 text-xs font-bold tracking-wider text-text uppercase">
                    {isPickup ? 'Lokasi Pengambilan' : 'Alamat Pengiriman'}
                </h2>
                <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5ED] text-[#006241]">
                        <Store className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-text">
                            {outlet?.name ?? 'Dombi Store'}
                        </h3>
                        <p className="mt-0.5 text-[11px] text-text-muted">
                            {isPickup
                                ? 'Dombi Store • Standalone Outlet'
                                : 'Delivery via Courier'}
                        </p>
                    </div>
                </div>
                {outlet?.address && (
                    <p className="mt-2 text-[11px] text-text-muted">
                        {outlet.address}
                    </p>
                )}
            </section>

            {/* Delivery address */}
            {!isPickup && customerAddress && (
                <section className="bg-surface p-4 shadow-card">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5ED] text-[#006241]">
                            <MapPin className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 text-sm font-bold text-text">
                                {customerAddress}
                            </div>
                            {customerAddressDetail && (
                                <div className="mt-0.5 text-[11px] text-text-muted">
                                    {customerAddressDetail}
                                </div>
                            )}
                            {latitude && longitude && (
                                <a
                                    href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#006241] active:opacity-80"
                                >
                                    <Navigation className="h-3 w-3" />
                                    Navigasi
                                </a>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* Detail Pesanan */}
            <section className="bg-surface p-4 shadow-card">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-text">
                        Detail Pesanan
                    </h2>
                    <span className="text-xs font-medium text-text-muted">
                        Total Item: {items.length}
                    </span>
                </div>

                <div className="space-y-3.5">
                    {items.map((item, i) => (
                        <div
                            key={i}
                            className="flex items-start justify-between gap-3"
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-lg">
                                    {item.product_name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="truncate text-xs font-bold text-text">
                                        {item.product_name}
                                    </h3>
                                    {item.variant_name && (
                                        <p className="mt-0.5 line-clamp-1 text-[11px] text-text-muted">
                                            {item.variant_name}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="shrink-0 text-right">
                                <span className="block text-xs font-bold text-text tabular-nums">
                                    {formatCurrency(item.subtotal)}
                                </span>
                                <span className="mt-0.5 block text-[11px] font-semibold text-text-muted">
                                    {item.quantity}x
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {itemsOpen && (
                    <div className="mt-3.5 space-y-2 border-t border-dashed border-border pt-3">
                        <PriceRow
                            label="Subtotal Produk"
                            value={formatCurrency(subtotal)}
                            strong
                        />
                        {Number(deliveryFee) > 0 && (
                            <PriceRow
                                label="Ongkir"
                                value={formatCurrency(deliveryFee)}
                            />
                        )}
                    </div>
                )}

                <div className="mt-3 border-t border-dashed border-border/70 pt-2 text-center">
                    <button
                        type="button"
                        onClick={() => setItemsOpen((v) => !v)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#006241] transition hover:underline"
                    >
                        <span>
                            {itemsOpen ? 'Sembunyikan' : 'Selengkapnya'}
                        </span>
                        <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform duration-300 ${itemsOpen ? 'rotate-180' : ''}`}
                        />
                    </button>
                </div>
            </section>

            {/* Rincian Pembayaran */}
            <section className="bg-surface p-4 shadow-card">
                <h2 className="mb-3 text-sm font-bold text-text">
                    Rincian Pembayaran
                </h2>

                <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-text">
                        Total Pembayaran
                    </span>
                    <span className="text-sm font-extrabold text-text tabular-nums">
                        {formatCurrency(total)}
                    </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                    <div className="flex h-4 w-6 items-center justify-center rounded bg-emerald-100 text-[10px] font-bold text-[#006241]">
                        <CreditCard className="h-3 w-3" />
                    </div>
                    <span className="font-medium text-text">
                        {paymentMethod}
                    </span>
                </div>

                {paymentOpen && (
                    <div className="mt-3.5 space-y-2 border-t border-dashed border-border pt-3">
                        <PriceRow
                            label="Harga Pesanan"
                            value={formatCurrency(subtotal)}
                        />
                        <PriceRow label="Biaya Layanan" value="GRATIS" accent />
                        <PriceRow label="PPN (11%)" value="Termasuk" />
                    </div>
                )}

                <div className="mt-3 border-t border-dashed border-border/70 pt-2 text-center">
                    <button
                        type="button"
                        onClick={() => setPaymentOpen((v) => !v)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#006241] transition hover:underline"
                    >
                        <span>
                            {paymentOpen ? 'Sembunyikan' : 'Selengkapnya'}
                        </span>
                        <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform duration-300 ${paymentOpen ? 'rotate-180' : ''}`}
                        />
                    </button>
                </div>
            </section>

            {/* Metadata */}
            <section className="space-y-2.5 bg-surface p-4 shadow-card">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-text-muted">
                        ID Pesanan
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="font-bold tracking-tight text-text">
                            #{orderCode}
                        </span>
                        <button
                            type="button"
                            onClick={handleCopyOrderId}
                            aria-label="Salin ID pesanan"
                            className="p-1 text-[#006241] transition active:scale-95"
                        >
                            <Copy className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-text-muted">
                        Metode Pemesanan
                    </span>
                    <span className="font-semibold text-text">
                        {isPickup ? 'Pick Up via Store' : 'Delivery'}
                    </span>
                </div>
            </section>

            {/* Courier (identity only) */}
            {(delivery?.courier?.name || delivery?.external_courier_name) && (
                <section className="bg-surface p-4 shadow-card">
                    <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-muted">
                            <UserCheck className="h-3.5 w-3.5 text-text-muted" />
                        </div>
                        <div>
                            <div className="text-[10px] text-text-subtle">
                                Kurir
                            </div>
                            <div className="text-xs font-semibold text-text">
                                {delivery?.courier?.name ??
                                    delivery?.external_courier_name}
                            </div>
                            {(delivery?.courier?.vehicle_plate ||
                                delivery?.external_plate_number) && (
                                <div className="text-[10px] text-text-muted">
                                    Plat:{' '}
                                    {delivery?.courier?.vehicle_plate ??
                                        delivery?.external_plate_number}
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* Failed delivery */}
            {delivery?.failed_reason && (
                <section className="bg-surface p-4 shadow-card">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                        <span className="text-xs font-semibold text-amber-700">
                            Pengiriman Gagal: {delivery.failed_reason}
                        </span>
                    </div>
                </section>
            )}

            {/* In-Flow E-Receipt */}
            <section className="px-4 pt-2 pb-2">
                <button
                    type="button"
                    onClick={() => setReceiptOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#006241] bg-surface py-3.5 text-xs font-extrabold text-[#006241] shadow-card transition hover:bg-[#EAF5ED] active:scale-[0.98]"
                >
                    <Receipt className="h-4 w-4" />
                    <span>Lihat E-Receipt</span>
                </button>
            </section>

            <ReceiptDialog
                open={receiptOpen}
                onClose={() => setReceiptOpen(false)}
                orderCode={orderCode ?? ''}
                items={items}
                subtotal={subtotal}
                total={total}
                outletName={outlet?.name}
                outletAddress={outlet?.address}
            />
        </div>
    );
}

function PriceRow({
    label,
    value,
    strong,
    accent,
}: {
    label: string;
    value: string;
    strong?: boolean;
    accent?: boolean;
}) {
    return (
        <div className="flex justify-between text-xs text-text-muted">
            <span>{label}</span>
            <span
                className={`${strong ? 'font-bold text-text' : ''} ${accent ? 'font-bold text-emerald-600' : ''}`}
            >
                {value}
            </span>
        </div>
    );
}

function ReceiptDialog({
    open,
    onClose,
    orderCode,
    items,
    subtotal,
    total,
    outletName,
    outletAddress,
}: {
    open: boolean;
    onClose: () => void;
    orderCode: string;
    items: OrderItem[];
    subtotal: number;
    total: number;
    outletName?: string;
    outletAddress?: string;
}) {
    const handleDownload = () => {
        onClose();
        toast.success('E-Receipt berhasil diunduh!');
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
                                D
                            </div>
                            <span>E-Receipt Dombi</span>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-3 rounded-2xl border border-dashed border-border bg-surface-muted p-4 font-mono text-xs">
                    <div className="border-b border-border pb-2 text-center">
                        <h4 className="font-sans text-sm font-extrabold text-text">
                            DOMBI COFFEE - {outletName?.toUpperCase()}
                        </h4>
                        {outletAddress && (
                            <p className="mt-0.5 font-sans text-[10px] text-text-muted">
                                {outletAddress}
                            </p>
                        )}
                        <p className="mt-0.5 font-sans text-[10px] text-text-muted">
                            #{orderCode}
                        </p>
                    </div>

                    <div className="space-y-1.5 text-text">
                        {items.map((item, i) => (
                            <div key={i}>
                                <div className="flex justify-between">
                                    <span>
                                        {item.quantity}x {item.product_name}
                                    </span>
                                    <span>
                                        {item.subtotal.toLocaleString('id-ID')}
                                    </span>
                                </div>
                                {item.variant_name && (
                                    <div className="flex justify-between pl-2 text-[11px] text-text-muted">
                                        <span>— {item.variant_name}</span>
                                        <span />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="space-y-1 border-t border-border pt-2">
                        <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>{subtotal.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between border-t border-dashed border-border pt-1 font-sans text-sm font-bold text-[#006241]">
                            <span>TOTAL PAID</span>
                            <span>{formatCurrency(total)}</span>
                        </div>
                    </div>

                    <div className="pt-2 text-center font-sans text-[10px] text-text-muted">
                        <p>Terima kasih telah menikmati Dombi Coffee!</p>
                        <p className="mt-0.5 font-bold text-[#006241]">
                            #GrindTheEssentials
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleDownload}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#006241] py-3 text-xs font-bold text-white transition hover:bg-[#004d33] active:opacity-80"
                >
                    <Download className="h-4 w-4" />
                    <span>Simpan Struk Digital</span>
                </button>
            </DialogContent>
        </Dialog>
    );
}
