import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import DeliveryStatusBadge from '@/components/delivery-status-badge';
import CourierLayout from '@/layouts/courier-layout';

interface DeliveryData {
    id: number;
    status: string;
    pickup_time: string | null;
    delivered_time: string | null;
    assigned_at: string | null;
    failed_reason: string | null;
    notes: string | null;
    proof_image: string | null;
    delivered_to: string | null;
    delivery_note: string | null;
    courier: { id: number; name: string } | null;
    order: {
        id: number;
        order_code: string;
        customer_name: string;
        customer_phone: string | null;
        customer_address: string;
        customer_address_detail: string | null;
        customer_landmark: string | null;
        latitude: number | null;
        longitude: number | null;
        notes: string | null;
        total: number;
        outlet: {
            id: number;
            name: string;
            address: string;
            latitude: number | null;
            longitude: number | null;
            phone: string | null;
        } | null;
        items: Array<{
            id: number;
            product_name: string;
            quantity: number;
            price: number;
            subtotal: number;
        }>;
    };
    status_histories: Array<{
        id: number;
        from_status: string | null;
        to_status: string;
        reason: string | null;
        notes: string | null;
        created_at: string | null;
        actor: { name: string } | null;
    }>;
}

const FAILURE_REASONS = [
    'Customer Tidak Ditemukan',
    'Penerima Tidak Ada',
    'Alamat Tidak Jelas',
    'Menolak Pesanan',
    'Kendala Operasional',
    'Lainnya',
];

interface Props {
    delivery: DeliveryData;
}

export default function CourierDeliveryShow({ delivery }: Props) {
    const order = delivery.order;
    const [showFailSheet, setShowFailSheet] = useState(false);
    const [showCompleteSheet, setShowCompleteSheet] = useState(false);

    const canConfirmPickup = delivery.status === 'waiting_pickup';
    const canStartDelivery = delivery.status === 'picked_up';
    const canComplete = delivery.status === 'delivering';
    const canFail = delivery.status === 'delivering' || delivery.status === 'picked_up';

    const openMaps = () => {
        if (order.latitude && order.longitude) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`, '_blank');
        } else if (order.customer_address) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer_address)}`, '_blank');
        }
    };

    const callCustomer = () => {
        if (order.customer_phone) {
            window.open(`tel:${order.customer_phone}`, '_self');
        }
    };

    const whatsappCustomer = () => {
        if (order.customer_phone) {
            const phone = order.customer_phone.replace(/^0/, '62');
            window.open(`https://wa.me/${phone}`, '_blank');
        }
    };

    const confirmPickup = () => {
        router.post(`/courier/deliveries/${delivery.id}/confirm-pickup`, {}, { preserveScroll: true });
    };

    const startDelivery = () => {
        router.post(`/courier/deliveries/${delivery.id}/start-delivery`, {}, { preserveScroll: true });
    };

    return (
        <CourierLayout>
            <Head title={`Delivery ${order.order_code}`} />

            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">{order.order_code}</h1>
                    <p className="text-sm text-slate-500">{order.customer_name}</p>
                </div>
                <DeliveryStatusBadge status={delivery.status} />
            </div>

            {/* Customer Info Card */}
            <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900">{order.customer_name}</div>
                        <div className="mt-1 text-sm text-slate-600">{order.customer_address}</div>
                        {order.customer_address_detail && (
                            <div className="mt-0.5 text-xs text-slate-500">{order.customer_address_detail}</div>
                        )}
                        {order.customer_landmark && (
                            <div className="mt-2 text-xs font-medium text-amber-700">
                                📍 {order.customer_landmark}
                            </div>
                        )}
                        {order.notes && (
                            <div className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                                📝 {order.notes}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Contact */}
                {order.customer_phone && (
                    <div className="mt-3 flex gap-2">
                        <button
                            onClick={whatsappCustomer}
                            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors active:bg-emerald-800"
                        >
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.226 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            WhatsApp
                        </button>
                        <button
                            onClick={callCustomer}
                            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors active:bg-zinc-50"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                            Telepon
                        </button>
                    </div>
                )}
            </div>

            {/* Navigation */}
            {(order.latitude && order.longitude) && (
                <button
                    onClick={openMaps}
                    className="mb-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors active:bg-blue-100"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Buka di Google Maps
                </button>
            )}

            {/* Outlet Info */}
            {order.outlet && (
                <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Outlet</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{order.outlet.name}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{order.outlet.address}</div>
                </div>
            )}

            {/* Order Items */}
            <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pesanan</div>
                <div className="mt-3 space-y-2">
                    {order.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                            <div>
                                <span className="font-medium text-slate-900">{item.product_name}</span>
                                <span className="ml-2 text-slate-500">x{item.quantity}</span>
                            </div>
                            <span className="font-medium text-slate-700">
                                Rp {item.subtotal.toLocaleString('id-ID')}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="mt-3 border-t border-zinc-100 pt-3 text-right">
                    <span className="text-sm font-bold text-slate-900">
                        Total: Rp {order.total.toLocaleString('id-ID')}
                    </span>
                </div>
            </div>

            {/* Proof of Delivery (if completed) */}
            {delivery.status === 'completed' && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Bukti Pengiriman</div>
                    {delivery.delivered_to && (
                        <div className="mt-2 text-sm text-emerald-800">
                            <span className="font-medium">Diterima oleh:</span> {delivery.delivered_to}
                        </div>
                    )}
                    {delivery.delivery_note && (
                        <div className="mt-1 text-sm text-emerald-700">
                            <span className="font-medium">Catatan:</span> {delivery.delivery_note}
                        </div>
                    )}
                    {delivery.delivered_time && (
                        <div className="mt-1 text-xs text-emerald-600">
                            {new Date(delivery.delivered_time).toLocaleString('id-ID')}
                        </div>
                    )}
                </div>
            )}

            {/* Failure Info */}
            {delivery.status === 'failed' && delivery.failed_reason && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-red-600">Alasan Gagal</div>
                    <div className="mt-1 text-sm text-red-800">{delivery.failed_reason}</div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pb-4">
                {canConfirmPickup && (
                    <button
                        onClick={confirmPickup}
                        className="flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors active:bg-emerald-800"
                    >
                        📦 Ambil Pesanan
                    </button>
                )}

                {canStartDelivery && (
                    <button
                        onClick={startDelivery}
                        className="flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors active:bg-emerald-800"
                    >
                        🚀 Mulai Antar
                    </button>
                )}

                {canComplete && (
                    <button
                        onClick={() => setShowCompleteSheet(true)}
                        className="flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors active:bg-emerald-800"
                    >
                        ✅ Selesaikan Pengiriman
                    </button>
                )}

                {canFail && (
                    <button
                        onClick={() => setShowFailSheet(true)}
                        className="flex min-h-11 w-full items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors active:bg-red-50"
                    >
                        ❌ Gagal Antar
                    </button>
                )}
            </div>

            {/* Complete Sheet */}
            {showCompleteSheet && (
                <CompleteSheet deliveryId={delivery.id} onClose={() => setShowCompleteSheet(false)} />
            )}

            {/* Fail Sheet */}
            {showFailSheet && (
                <FailSheet deliveryId={delivery.id} onClose={() => setShowFailSheet(false)} />
            )}
        </CourierLayout>
    );
}

function CompleteSheet({ deliveryId, onClose }: { deliveryId: number; onClose: () => void }) {
    const form = useForm({
        delivered_to: '',
        delivery_note: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(`/courier/deliveries/${deliveryId}/complete`, {
            onSuccess: () => onClose(),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
            <div className="w-full max-w-lg rounded-t-2xl bg-white">
                <div className="p-4">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-900">Selesaikan Pengiriman</h2>
                        <button onClick={onClose} className="text-slate-400">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Diterima oleh</label>
                                <input
                                    type="text"
                                    value={form.data.delivered_to}
                                    onChange={(e) => form.setData('delivered_to', e.target.value)}
                                    placeholder="Nama penerima"
                                    className="mt-1 block min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700">Catatan (opsional)</label>
                                <textarea
                                    value={form.data.delivery_note}
                                    onChange={(e) => form.setData('delivery_note', e.target.value)}
                                    placeholder="Catatan pengiriman"
                                    rows={2}
                                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={form.processing}
                            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors active:bg-emerald-800 disabled:bg-zinc-300"
                        >
                            {form.processing ? 'Memproses...' : '✅ Konfirmasi Selesai'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

function FailSheet({ deliveryId, onClose }: { deliveryId: number; onClose: () => void }) {
    const form = useForm({
        failed_reason: '',
        failure_note: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(`/courier/deliveries/${deliveryId}/fail`, {
            onSuccess: () => onClose(),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
            <div className="w-full max-w-lg rounded-t-2xl bg-white">
                <div className="p-4">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-red-700">Gagal Antar</h2>
                        <button onClick={onClose} className="text-slate-400">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="space-y-2">
                            {FAILURE_REASONS.map((reason) => (
                                <label
                                    key={reason}
                                    className={`flex cursor-pointer items-center rounded-lg border p-3 transition-colors ${
                                        form.data.failed_reason === reason
                                            ? 'border-red-300 bg-red-50'
                                            : 'border-zinc-200 bg-white active:bg-zinc-50'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="failed_reason"
                                        value={reason}
                                        checked={form.data.failed_reason === reason}
                                        onChange={() => form.setData('failed_reason', reason)}
                                        className="mr-3"
                                    />
                                    <span className="text-sm font-medium text-slate-700">{reason}</span>
                                </label>
                            ))}
                        </div>

                        {form.data.failed_reason === 'Lainnya' && (
                            <div className="mt-3">
                                <textarea
                                    value={form.data.failure_note}
                                    onChange={(e) => form.setData('failure_note', e.target.value)}
                                    placeholder="Jelaskan alasan kegagalan"
                                    rows={3}
                                    className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                                />
                            </div>
                        )}

                        {form.errors.failed_reason && (
                            <p className="mt-1 text-xs text-red-600">{form.errors.failed_reason}</p>
                        )}
                        {form.errors.failure_note && (
                            <p className="mt-1 text-xs text-red-600">{form.errors.failure_note}</p>
                        )}

                        <button
                            type="submit"
                            disabled={!form.data.failed_reason || form.processing}
                            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors active:bg-red-700 disabled:bg-zinc-300"
                        >
                            {form.processing ? 'Memproses...' : '❌ Konfirmasi Gagal'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
