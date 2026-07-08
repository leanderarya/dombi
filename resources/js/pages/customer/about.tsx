import { Head, Link, usePage } from '@inertiajs/react';
import { ChevronLeft, Milk, Zap, Handshake } from 'lucide-react';
import type { ReactNode } from 'react';

export default function About() {
    const { appVersion } = usePage<any>().props;

    return (
        <div className="min-h-dvh bg-background text-text">
            <Head title="Tentang Dombi" />

            <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur pt-safe">
                <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                    <Link href="/customer/profile" className="flex h-11 w-11 items-center justify-center rounded-lg text-text active:opacity-80">
                        <ChevronLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="text-sm font-semibold text-text">Tentang Dombi</h1>
                    <div className="h-11 w-11" />
                </div>
            </header>

            <main className="mx-auto max-w-lg px-4 pt-4 pb-24">
                {/* App Identity */}
                <section className="flex flex-col items-center pt-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-700">
                        <span className="text-2xl font-bold text-white">D</span>
                    </div>
                    <h2 className="mt-3 text-lg font-bold text-text">Dombi</h2>
                    <p className="mt-0.5 text-xs text-text-subtle">Distribusi Susu Kambing</p>
                </section>

                {/* Description */}
                <section className="mt-6">
                    <div className="rounded-xl border border-border bg-white p-4">
                        <p className="text-sm leading-relaxed text-text-muted">
                            Dombi adalah aplikasi distribusi susu kambing yang membantu pelanggan melakukan pemesanan dengan cepat, mudah, dan terintegrasi dengan outlet terdekat.
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-text-muted">
                            Kami menghubungkan pelanggan langsung dengan jaringan outlet distribusi untuk memastikan produk susu kambing segar sampai ke tangan kamu dalam waktu singkat.
                        </p>
                    </div>
                </section>

                {/* Values */}
                <section className="mt-6">
                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Nilai Kami</h2>
                    <div className="mt-2 space-y-2">
                        <ValueCard icon={<Milk className="h-5 w-5 text-text-muted" />} title="Kesegaran" description="Produk susu kambing segar langsung dari peternakan terpercaya." />
                        <ValueCard icon={<Zap className="h-5 w-5 text-text-muted" />} title="Kecepatan" description="Pengiriman cepat melalui jaringan outlet dan kurir terdekat." />
                        <ValueCard icon={<Handshake className="h-5 w-5 text-text-muted" />} title="Kepercayaan" description="Transparansi penuh dari pemesanan hingga pengiriman." />
                    </div>
                </section>

                {/* App Info */}
                <section className="mt-6">
                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Informasi Aplikasi</h2>
                    <div className="mt-2 rounded-xl border border-border bg-white p-4">
                        <div className="space-y-2.5 text-sm">
                            <div className="flex justify-between"><span className="text-text-muted">Versi</span><span className="font-medium tabular-nums text-text">{appVersion ?? '1.0.0'}</span></div>
                            <div className="flex justify-between"><span className="text-text-muted">Platform</span><span className="font-medium text-text">PWA Mobile</span></div>
                            <div className="flex justify-between"><span className="text-text-muted">Developer</span><span className="font-medium text-text">Tim Dombi</span></div>
                        </div>
                    </div>
                </section>

                {/* Copyright */}
                <p className="mt-6 text-center text-[11px] text-text-subtle">© 2026 Dombi. Hak cipta dilindungi.</p>
            </main>
        </div>
    );
}

function ValueCard({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
    return (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-white p-4">
            <span className="text-text-muted">{icon}</span>
            <div>
                <div className="text-sm font-semibold text-text">{title}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-text-muted">{description}</div>
            </div>
        </div>
    );
}
