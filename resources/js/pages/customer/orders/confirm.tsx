import { Head, Link } from '@inertiajs/react';
import { CheckCircle2, ChevronRight, Clock, Home, MapPin, Package, Truck } from 'lucide-react';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { formatCurrency } from '@/lib/format';

interface OrderItem {
    product_name: string;
    variant_name: string | null;
    quantity: number;
    subtotal: number;
}

interface Order {
    id: number;
    order_code: string;
    items: OrderItem[];
    total: number;
    fulfillment_type: string;
    recovery_token: string;
    outlet: { name: string } | null;
}

interface Props {
    order: Order;
    isLoggedIn: boolean;
}

export default function OrderConfirm({ order, isLoggedIn }: Props) {
    const isPickup = order.fulfillment_type === 'pickup';
    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const estimatedTime = isPickup ? '15-30 menit' : '30-60 menit';

    return (
        <CustomerMobileLayout hideTopBar hideCartBar hideBottomNav>
            <Head title="Pesanan Berhasil" />

            <div className="flex flex-col items-center pt-8 text-center">
                {/* Animated Checkmark */}
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 animate-[scaleIn_0.5s_ease-out]">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>

                <h1 className="mt-5 text-xl font-bold text-text">Pesanan Berhasil!</h1>

                {/* Order Code */}
                <div className="mt-3 rounded-xl bg-surface-muted px-4 py-2">
                    <span className="text-xs text-text-muted">Kode Pesanan</span>
                    <div className="mt-0.5 text-lg font-bold tabular-nums tracking-wider text-text">
                        {order.order_code}
                    </div>
                </div>

                {/* Summary Card */}
                <div className="mt-6 w-full rounded-xl border border-border bg-white p-4 text-left">
                    <div className="space-y-2.5">
                        <div className="flex items-center gap-3 text-sm">
                            <Package className="h-4 w-4 shrink-0 text-text-subtle" />
                            <span className="text-text-muted">{itemCount} Produk</span>
                            <span className="ml-auto font-semibold tabular-nums text-text">{formatCurrency(order.total)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            {isPickup ? (
                                <MapPin className="h-4 w-4 shrink-0 text-text-subtle" />
                            ) : (
                                <Truck className="h-4 w-4 shrink-0 text-text-subtle" />
                            )}
                            <span className="text-text-muted">
                                {isPickup ? 'Ambil di Outlet' : 'Kurir Dombi'}
                            </span>
                            {order.outlet && (
                                <span className="ml-auto text-xs text-text-subtle">{order.outlet.name}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <Clock className="h-4 w-4 shrink-0 text-text-subtle" />
                            <span className="text-text-muted">Estimasi</span>
                            <span className="ml-auto font-medium text-text">{estimatedTime}</span>
                        </div>
                    </div>
                </div>

                {/* CTAs */}
                <div className="mt-8 w-full space-y-3">
                    <Link
                        href={isLoggedIn ? `/customer/orders/${order.id}` : `/track/${order.recovery_token}`}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white active:opacity-80"
                    >
                        Lacak Pesanan
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                    <Link
                        href="/customer/home"
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-text active:opacity-80"
                    >
                        <Home className="h-4 w-4" />
                        Kembali ke Beranda
                    </Link>
                </div>

                {/* Helper text */}
                <p className="mt-6 px-8 text-xs leading-relaxed text-text-subtle">
                    Simpan kode pelacakan untuk cek pesanan nanti.
                </p>
            </div>
        </CustomerMobileLayout>
    );
}
