import { Head, Link } from '@inertiajs/react';
import ProductCard from '@/components/customer/product-card';
import Pagination from '@/components/pagination';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';

export default function Products({ products }: any) {
    return (
        <CustomerMobileLayout products={products.data}>
            <Head title="Produk" />
            <div>
                <p className="text-sm text-slate-500">Produk aktif</p>
                <h1 className="mt-1 text-[24px] font-bold leading-8 text-slate-950">Pilih produk</h1>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
                {products.data.map((product: any) => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>
            <Pagination links={products.links} />
        </CustomerMobileLayout>
    );
}
