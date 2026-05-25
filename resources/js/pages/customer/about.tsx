import { Head, Link, usePage } from '@inertiajs/react';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';

export default function About() {
    const { appVersion } = usePage<any>().props;

    return (
        <CustomerMobileLayout hideTopBar>
            <Head title="Tentang Dombi" />

            {/* Header */}
            <header className="sticky top-0 z-30 -mx-4 -mt-5 mb-5 border-b border-zinc-100 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                    <Link href="/customer/profile" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-zinc-100">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <h1 className="text-base font-semibold text-slate-900">Tentang Dombi</h1>
                </div>
            </header>

            {/* App Identity */}
            <section className="flex flex-col items-center pt-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-700">
                    <span className="text-2xl font-bold text-white">D</span>
                </div>
                <h2 className="mt-3 text-lg font-bold text-slate-900">Dombi</h2>
                <p className="mt-0.5 text-xs text-slate-400">Distribusi Susu Kambing</p>
            </section>

            {/* Description */}
            <section className="mt-6">
                <div className="rounded-xl border border-zinc-100 bg-white p-4">
                    <p className="text-sm leading-relaxed text-slate-600">
                        Dombi adalah aplikasi distribusi susu kambing yang membantu pelanggan melakukan pemesanan dengan cepat, mudah, dan terintegrasi dengan outlet terdekat.
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                        Kami menghubungkan pelanggan langsung dengan jaringan outlet distribusi untuk memastikan produk susu kambing segar sampai ke tangan kamu dalam waktu singkat.
                    </p>
                </div>
            </section>

            {/* Values */}
            <section className="mt-6">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Nilai Kami</h2>
                <div className="mt-2 space-y-2">
                    <ValueCard icon="🥛" title="Kesegaran" description="Produk susu kambing segar langsung dari peternakan terpercaya." />
                    <ValueCard icon="⚡" title="Kecepatan" description="Pengiriman cepat melalui jaringan outlet dan kurir terdekat." />
                    <ValueCard icon="🤝" title="Kepercayaan" description="Transparansi penuh dari pemesanan hingga pengiriman." />
                </div>
            </section>

            {/* App Info */}
            <section className="mt-6">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Informasi Aplikasi</h2>
                <div className="mt-2 rounded-xl border border-zinc-100 bg-white p-4">
                    <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">Versi</span><span className="font-medium tabular-nums text-slate-900">{appVersion ?? '1.0.0'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Platform</span><span className="font-medium text-slate-900">PWA Mobile</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Developer</span><span className="font-medium text-slate-900">Tim Dombi</span></div>
                    </div>
                </div>
            </section>

            {/* Copyright */}
            <p className="mt-6 text-center text-[11px] text-slate-400">© 2026 Dombi. Hak cipta dilindungi.</p>
        </CustomerMobileLayout>
    );
}

function ValueCard({ icon, title, description }: { icon: string; title: string; description: string }) {
    return (
        <div className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-white p-4">
            <span className="text-lg">{icon}</span>
            <div>
                <div className="text-sm font-semibold text-slate-900">{title}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</div>
            </div>
        </div>
    );
}
