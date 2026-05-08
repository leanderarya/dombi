import { Head, Link, router } from '@inertiajs/react';
import DeliveryStatusBadge from '../../../components/delivery-status-badge';
import CourierLayout from '../../../layouts/courier-layout';

const statuses = ['waiting_pickup', 'picked_up', 'delivering', 'completed', 'failed'];

export default function CourierDeliveriesIndex({ deliveries, filters }: any) {
    return (
        <CourierLayout>
            <Head title="My Deliveries" />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-semibold">My Deliveries</h1>
                <select defaultValue={filters.status ?? ''} onChange={(e) => router.get('/courier/deliveries', { status: e.target.value }, { preserveState: true })} className="rounded-md border px-3 py-2 text-sm">
                    <option value="">Semua status</option>
                    {statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                </select>
            </div>
            <div className="mt-5 space-y-3">
                {deliveries.data.map((delivery: any) => (
                    <Link key={delivery.id} href={`/courier/deliveries/${delivery.id}`} className="block rounded-lg border bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="font-medium">{delivery.order.order_code}</div>
                                <div className="text-sm text-zinc-500">{delivery.order.outlet?.name ?? '-'}</div>
                                <div className="mt-2 text-sm">{delivery.order.customer_name}</div>
                                <div className="text-sm text-zinc-600">{delivery.order.customer_address}</div>
                            </div>
                            <DeliveryStatusBadge status={delivery.status} />
                        </div>
                    </Link>
                ))}
            </div>
        </CourierLayout>
    );
}
