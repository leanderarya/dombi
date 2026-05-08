import { Head, Link } from '@inertiajs/react';
import CustomerLayout from '../../../layouts/customer-layout';

export default function OrdersIndex({ orders }: any) {
    return <CustomerLayout><Head title="Order" /><h1 className="text-2xl font-semibold">Riwayat Order</h1><div className="mt-5 space-y-3">{orders.data.map((order: any) => <Link key={order.id} href={`/customer/orders/${order.id}`} className="block rounded-lg border bg-white p-4"><div className="flex items-center justify-between"><div className="font-medium">{order.order_code}</div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">{order.status}</span></div><div className="mt-1 text-sm text-zinc-500">{order.outlet?.name}</div><div className="mt-2 font-semibold">Rp {Number(order.total).toLocaleString('id-ID')}</div></Link>)}</div></CustomerLayout>;
}
