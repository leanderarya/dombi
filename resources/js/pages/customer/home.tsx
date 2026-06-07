import { Head, Link } from '@inertiajs/react';
import { Package } from 'lucide-react';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { orderProgressIndex, orderStatusLabel } from '@/lib/customer-status';
import { formatCurrency } from '@/lib/format';

interface Variant {
    id: number;
    name: string;
    flavor: string | null;
    size: string | null;
    selling_price: number;
    is_active: boolean;
}

interface Family {
    id: number;
    name: string;
    brand: string | null;
    description: string | null;
    variants: Variant[];
}

export default function Home({ families, activeOrders, lastOrder }: any) {
    const activeOrder = activeOrders?.[0] ?? null;

    return (
        <CustomerMobileLayout activeOrder={activeOrder}>
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
                                <Package className="h-6 w-6 text-slate-400" />
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
                        <Link
                            href={`/customer/orders/${lastOrder.id}/restore-cart`}
                            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white active:scale-[0.97] active:bg-emerald-800"
                        >
                            Order Ulang
                        </Link>
                    </div>
                </section>
            )}

            {/* First-time CTA */}
            {!lastOrder && !activeOrder && (
                <section>
                    <div className="rounded-xl border border-zinc-100 bg-white p-5 text-center">
                        <Package className="mx-auto h-10 w-10 text-slate-400" />
                        <p className="mt-2 text-sm font-semibold text-slate-900">Susu kambing segar siap diantar</p>
                        <p className="mt-1 text-xs text-slate-500">Pilih produk dan pesan langsung ke alamat kamu.</p>
                        <Link href="/customer/products" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-emerald-700 px-5 text-sm font-bold text-white active:bg-emerald-800">
                            Pesan Sekarang
                        </Link>
                    </div>
                </section>
            )}

            {/* Featured Products */}
            <section className="mt-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Produk</h2>
                    <Link href="/customer/products" className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Semua</Link>
                </div>
                <div className="mt-2 divide-y divide-zinc-100">
                    {(() => {
                        const rows: Array<{ key: string; familyId: number; label: string; description: string | null; lowestPrice: number }> = [];
                        for (const family of (families ?? [])) {
                            const activeVariants = (family.variants ?? []).filter((v: Variant) => v.is_active);
                            if (activeVariants.length === 0) continue;

                            const flavorMap = new Map<string | null, Variant[]>();
                            for (const v of activeVariants) {
                                const k = v.flavor ?? '__no_flavor__';
                                if (!flavorMap.has(k)) flavorMap.set(k, []);
                                flavorMap.get(k)!.push(v);
                            }

                            for (const [k, vars] of flavorMap) {
                                const flavor = k === '__no_flavor__' ? null : k;
                                const lowest = Math.min(...vars.map((v) => v.selling_price));
                                rows.push({
                                    key: `${family.id}-${flavor ?? 'default'}`,
                                    familyId: family.id,
                                    label: flavor ? `${family.name} ${flavor}` : family.name,
                                    description: family.description,
                                    lowestPrice: lowest,
                                });
                            }
                        }
                        return rows.slice(0, 6);
                    })().map((row) => (
                        <Link
                            key={row.key}
                            href={`/customer/products/${row.familyId}`}
                            className="flex items-center gap-3.5 bg-white py-3 active:bg-zinc-50"
                        >
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-zinc-50">
                                <span className="text-3xl">&#129371;</span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-slate-900 leading-tight">
                                    {row.label}
                                </div>
                                <div className="mt-0.5 text-xs text-zinc-500 truncate">
                                    {row.description || row.label}
                                </div>
                                <div className="mt-1 text-sm font-bold tabular-nums text-emerald-700">
                                    Mulai {formatCurrency(row.lowestPrice)}
                                </div>
                            </div>
                        </Link>
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
