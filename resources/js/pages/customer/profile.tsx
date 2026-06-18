import { Head, Link, usePage } from '@inertiajs/react';
import { HelpCircle, Info, MapPin, Package } from 'lucide-react';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';

export default function Profile({ defaultAddress }: any) {
    const { appVersion } = usePage<any>().props;

    return (
        <CustomerMobileLayout hideTopBar>
            <Head title="Pengaturan" />

            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-zinc-900">Pengaturan</h1>
            </div>

            {/* Default Address */}
            {defaultAddress && (
                <section className="mt-5">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Alamat Utama</h2>
                    <div className="mt-2 rounded-xl border border-emerald-200 bg-white p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                                <MapPin className="h-4 w-4 text-emerald-700" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-zinc-900">{defaultAddress.label || 'Alamat Utama'}</span>
                                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700">Utama</span>
                                </div>
                                <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-600">{defaultAddress.address}</div>
                            </div>
                        </div>
                        <Link href="/customer/addresses" className="mt-3 flex min-h-9 w-full items-center justify-center rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-700 active:bg-zinc-50">
                            Kelola Alamat
                        </Link>
                    </div>
                </section>
            )}

            {/* Menu */}
            <section className="mt-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Menu</h2>
                <div className="mt-2 space-y-1">
                    <MenuItem href="/customer/orders" title="Pesanan Saya" icon={<Package className="h-5 w-5 text-zinc-400" />} />
                    <MenuItem href="/customer/addresses" title="Alamat Saya" icon={<MapPin className="h-5 w-5 text-zinc-400" />} />
                    <MenuItem href="/customer/help" title="Bantuan" icon={<HelpCircle className="h-5 w-5 text-zinc-400" />} />
                    <MenuItem href="/customer/about" title="Tentang Dombi" icon={<Info className="h-5 w-5 text-zinc-400" />} />
                </div>
            </section>

            {/* Version */}
            <p className="mt-8 text-center text-xs text-zinc-400">Versi {appVersion ?? '1.0.0'}</p>
        </CustomerMobileLayout>
    );
}

function MenuItem({ href, title, icon }: { href: string; title: string; icon: React.ReactNode }) {
    return (
        <Link
            href={href}
            className="flex min-h-[52px] items-center gap-3.5 rounded-xl px-1 active:bg-zinc-50"
        >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-50">
                {icon}
            </div>
            <span className="text-sm font-medium text-zinc-900">{title}</span>
            <svg className="ml-auto h-4 w-4 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
        </Link>
    );
}
