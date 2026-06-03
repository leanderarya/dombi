import { Head, Link, router, usePage } from '@inertiajs/react';
import { MapPin } from 'lucide-react';
import CourierCard from '@/components/customer/courier-card';
import OrderSummaryCard from '@/components/customer/order-summary-card';
import OutletFulfillmentCard from '@/components/customer/outlet-fulfillment-card';
import StatusTimeline from '@/components/customer/status-timeline';
import StickyOrderActions from '@/components/customer/sticky-order-actions';
import OfflineBanner from '@/components/offline-banner';
import { activeOrderStatuses } from '@/lib/customer-status';

export default function OrderShow({ order }: any) {
    const isActive = activeOrderStatuses.includes(order.status);
    const isTerminal = ['completed', 'cancelled', 'failed'].includes(order.status);

    return (
        <div className="min-h-dvh bg-[#fbf9f7] text-slate-950">
            <OfflineBanner />

            {/* Sticky Header */}
            <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/95 backdrop-blur">
                <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                    <Link href="/customer/orders" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-zinc-100">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <div className="text-sm font-semibold text-slate-900">{order.order_code}</div>
                    <div className="h-10 w-10" /> {/* Spacer for centering */}
                </div>
            </header>

            {/* Content */}
            <main className={`mx-auto max-w-lg px-4 pt-4 ${isTerminal ? 'pb-[calc(7rem+env(safe-area-inset-bottom))]' : 'pb-[calc(7rem+env(safe-area-inset-bottom))]'}`}>
                <Head title={order.order_code} />

                {/* Status Hero Card */}
                <OutletFulfillmentCard
                    status={order.status}
                    outletName={order.outlet?.name}
                />

                {/* Courier Card */}
                {order.delivery?.courier && (
                    <div className="mt-3">
                        <CourierCard courier={order.delivery.courier} />
                    </div>
                )}

                {/* Failed Delivery Reason */}
                {order.delivery?.failed_reason && (
                    <div className="mt-3 rounded-lg border border-red-100 bg-red-50 p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-red-600">Alasan gagal</div>
                        <div className="mt-1 text-sm text-red-800">{order.delivery.failed_reason}</div>
                    </div>
                )}

                {/* Timeline */}
                <div className="mt-4">
                    <StatusTimeline
                        histories={order.status_histories}
                        currentStatus={order.status}
                    />
                </div>

                {/* Order Summary */}
                <div className="mt-4">
                    <OrderSummaryCard
                        items={order.items}
                        subtotal={order.subtotal}
                        deliveryFee={order.delivery_fee}
                        total={order.total}
                    />
                </div>

                {/* Delivery Address */}
                <div className="mt-4 rounded-lg border border-zinc-100 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Alamat Pengiriman</div>
                    <div className="mt-2 text-sm font-medium text-slate-900">{order.customer_name}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{order.customer_phone}</div>
                    <div className="mt-1.5 text-xs leading-relaxed text-slate-600">{order.customer_address}</div>
                    {order.customer_address_detail && (
                        <div className="mt-1 text-xs text-slate-600"><span className="font-medium text-slate-500">Detail: </span>{order.customer_address_detail}</div>
                    )}
                    {order.customer_landmark && (
                        <div className="mt-1 text-xs text-slate-600"><span className="font-medium text-slate-500">Patokan: </span>{order.customer_landmark}</div>
                    )}
                    {order.latitude && order.longitude && (
                        <a
                            href={`https://www.google.com/maps?q=${order.latitude},${order.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 active:bg-emerald-100"
                        >
                            <MapPin className="h-3.5 w-3.5" />
                            Buka di Maps
                        </a>
                    )}
                </div>
            </main>

            {/* Sticky Bottom Actions */}
            <StickyOrderActions orderId={order.id} showReorder={isTerminal} />
        </div>
    );
}
