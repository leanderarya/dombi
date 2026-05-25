import { Head, Link, router } from '@inertiajs/react';
import ProductCard from '@/components/customer/product-card';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { orderProgressIndex, orderStatusLabel } from '@/lib/customer-status';
import { formatCurrency } from '@/lib/format';

export default function Home({ products, activeOrders, lastOrder }: any) {
    const activeOrder = activeOrders?.[0] ?? null;

    return (
        <CustomerMobileLayout activeOrder={activeOrder} products={products}>
            <Head title="Home" />

            {/* Active Order */}
            {activeOrder && (
                <section>
                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Order Aktif</h2>
                    <Link href={`/customer/orders/${activeOrder.id}`} className="mt-2 block rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 active:bg-emerald-50">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900">{orderStatusLabel(activeOrder.status)}</div>
                                <div className="mt-0.5 text-xs text-slate-500">{activeOrder.outlet?.name ?? 'Outlet sedang dipilih'}</div>
                                {activeOrder.delivery?.courier && (
                                    <div className="mt-1 text-xs font-medium text-emerald-700">Kurir: {activeOrder.delivery.courier.name}</div>
                                )}
                            </div>
                            <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-emerald-700">Lacak →</span>
                        </div>
                        <TrackingBar status={activeOrder.status} />
                    </Link>
                </section>
            )}

            {/* Quick Reorder */}
            {lastOrder && (
                <section className={activeOrder ? 'mt-6' : ''}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Order Lagi</h2>
                        <Link href="/customer/orders" className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Riwayat</Link>
                    </div>
                    <div className="mt-2 rounded-xl border border-zinc-100 bg-white p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-50">
                                <span className="text-xl">🥛</span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-slate-900">
                                    {lastOrder.items?.[0]?.product_name ?? 'Susu Kambing'}
                                </div>
                                <div className="mt-0.5 text-xs text-slate-500">
                                    {lastOrder.items?.length ?? 0} item · {formatCurrency(lastOrder.total)}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => router.post(`/customer/orders/${lastOrder.id}/repeat`)}
                            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white active:scale-[0.97] active:bg-emerald-800"
                        >
                            Order Ulang
                        </button>
                    </div>
                </section>
            )}

            {/* First-time CTA */}
            {!lastOrder && !activeOrder && (
                <section>
                    <div className="rounded-xl border border-zinc-100 bg-white p-5 text-center">
                        <span className="text-3xl">🥛</span>
                        <p className="mt-2 text-sm font-semibold text-slate-900">Susu kambing segar siap diantar</p>
                        <p className="mt-1 text-xs text-slate-500">Pilih produk dan pesan langsung ke alamat kamu.</p>
                        <Link href="/customer/checkout" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-emerald-700 px-5 text-sm font-bold text-white active:bg-emerald-800">
                            Pesan Sekarang
                        </Link>
                    </div>
                </section>
            )}

            {/* Products */}
            <section className="mt-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Produk</h2>
                    <Link href="/customer/products" className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Semua</Link>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                    {products.slice(0, 6).map((product: any) => (
                        <ProductCard key={product.id} product={product} compact />
                    ))}
                </div>
            </section>
        </CustomerMobileLayout>
    );
}

function TrackingBar({ status }: { status: string }) {
    const progress = orderProgressIndex(status);

    return (
        <div className="mt-3 flex gap-1">
            {progress.steps.map((step, i) => (
                <div key={step} className={`h-1 flex-1 rounded-full ${i <= progress.index ? 'bg-emerald-500' : 'bg-emerald-200/50'}`} />
            ))}
        </div>
    );
}
