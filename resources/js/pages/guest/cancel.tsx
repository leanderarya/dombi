import { router, usePage } from '@inertiajs/react';
import { Head } from '@inertiajs/react';
import { useState } from 'react';

interface OrderItem {
    product_name: string;
    quantity: number;
    price: number;
    subtotal: number;
}

interface CancelPageProps {
    order: {
        id: number;
        order_code: string;
        status: string;
        total: number;
        items: OrderItem[];
        outlet_name: string;
        fulfillment_type: string;
    };
    token: string;
}

export default function GuestCancelPage() {
    const { order, token } = usePage<CancelPageProps>().props;
    const [submitting, setSubmitting] = useState(false);
    const [reason, setReason] = useState('Salah Pesan');
    const [note, setNote] = useState('');

    const reasons = [
        'Salah Pesan',
        'Ganti Pikiran',
        'Harga Terlalu Mahal',
        'Lainnya',
    ];

    const handleCancel = () => {
        if (!confirm('Apakah Anda yakin ingin membatalkan pesanan ini? Tindakan ini tidak dapat dibatalkan.')) return;
        setSubmitting(true);
        router.post(route('guest.orders.cancel', { order: order.id, token }), {
            reason,
            note: reason === 'Lainnya' ? note : undefined,
        }, {
            preserveScroll: true,
            onFinish: () => setSubmitting(false),
        });
    };

    return (
        <>
            <Head title="Batalkan Pesanan" />
            <div className="mx-auto max-w-lg px-4 py-8">
                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
                    <h1 className="text-lg font-bold text-red-800">Batalkan Pesanan</h1>
                    <p className="mt-1 text-sm text-red-600">
                        Anda akan membatalkan pesanan <strong>{order.order_code}</strong>.
                        Tindakan ini tidak dapat dibatalkan.
                    </p>
                </div>

                <div className="mb-6 space-y-3">
                    <h2 className="font-semibold">Ringkasan Pesanan</h2>
                    {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                            <span>{item.product_name} x{item.quantity}</span>
                            <span>{item.subtotal.toLocaleString('id-ID')}</span>
                        </div>
                    ))}
                    <div className="flex justify-between border-t pt-2 font-bold">
                        <span>Total</span>
                        <span>{order.total.toLocaleString('id-ID')}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                        {order.outlet_name} · {order.fulfillment_type === 'pickup' ? 'Ambil di Outlet' : 'Diantar'}
                    </p>
                </div>

                <div className="mb-6 space-y-3">
                    <label className="font-semibold">Alasan Pembatalan</label>
                    {reasons.map((r) => (
                        <label key={r} className="flex items-center gap-2 text-sm">
                            <input
                                type="radio"
                                name="reason"
                                value={r}
                                checked={reason === r}
                                onChange={(e) => setReason(e.target.value)}
                                className="accent-red-600"
                            />
                            {r}
                        </label>
                    ))}
                    {reason === 'Lainnya' && (
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Tulis alasan..."
                            className="w-full rounded border p-2 text-sm"
                            rows={3}
                        />
                    )}
                </div>

                <button
                    onClick={handleCancel}
                    disabled={submitting || (reason === 'Lainnya' && !note)}
                    className="w-full rounded-lg bg-red-600 py-3 font-bold text-white disabled:opacity-50"
                >
                    {submitting ? 'Memproses...' : 'Ya, Batalkan Pesanan Saya'}
                </button>
            </div>
        </>
    );
}
