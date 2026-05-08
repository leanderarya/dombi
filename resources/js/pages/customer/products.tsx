import { Head, Link } from '@inertiajs/react';
import CustomerLayout from '../../layouts/customer-layout';

export default function Products({ products }: any) {
    return <CustomerLayout><Head title="Produk" /><div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Produk Aktif</h1><Link href="/customer/checkout" className="rounded-md bg-emerald-700 px-4 py-2 text-white">Checkout</Link></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{products.data.map((product: any) => <div key={product.id} className="rounded-lg border bg-white p-4"><div className="font-medium">{product.name}</div><div className="text-sm text-zinc-500">{product.description}</div><div className="mt-2 text-sm">{product.size} {product.unit}</div><div className="mt-3 font-semibold">Rp {Number(product.price).toLocaleString('id-ID')}</div></div>)}</div></CustomerLayout>;
}
