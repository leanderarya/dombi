import { Head, Link } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';

export default function Help() {
    return (
        <div className="min-h-dvh bg-background text-text">
            <Head title="Bantuan" />

            <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur pt-safe">
                <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                    <Link href="/customer/profile" className="flex h-11 w-11 items-center justify-center rounded-lg text-text active:opacity-80">
                        <ChevronLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="text-base font-bold text-text">Bantuan</h1>
                    <div className="h-11 w-11" />
                </div>
            </header>

            <main className="mx-auto max-w-lg px-4 pt-4 pb-24">
                {/* Support Contact */}
                <section>
                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Hubungi Kami</h2>
                    <div className="mt-2 rounded-xl border border-border bg-white p-4">
                        <p className="text-sm leading-relaxed text-text-muted">
                            Butuh bantuan terkait pesanan atau pengiriman? Tim Dombi siap membantu kamu.
                        </p>
                        <div className="mt-4 space-y-2">
                            <a href="https://wa.me/6281111111111" className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white active:bg-primary-hover">
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                WhatsApp Support
                            </a>
                            <a href="mailto:support@dombi.app" className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border text-sm font-semibold text-text active:bg-zinc-50">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                Email Support
                            </a>
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section className="mt-6">
                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">FAQ</h2>
                    <div className="mt-2 space-y-2">
                        <FaqItem title="Bagaimana cara memesan?" answer="Pilih produk, tambahkan ke keranjang, pilih alamat pengiriman, lalu tap 'Pesan Sekarang'." />
                        <FaqItem title="Berapa lama pengiriman?" answer="Pengiriman biasanya memakan waktu 30–60 menit tergantung jarak outlet ke alamat kamu." />
                        <FaqItem title="Bagaimana jika pesanan gagal?" answer="Jika pengiriman gagal, tim kami akan menghubungi kamu untuk penjadwalan ulang atau pembatalan." />
                        <FaqItem title="Apakah bisa order ulang?" answer="Ya, kamu bisa tap 'Order Ulang' di halaman home untuk memesan produk yang sama seperti sebelumnya." />
                    </div>
                </section>

                {/* Operational Hours */}
                <section className="mt-6">
                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Jam Operasional</h2>
                    <div className="mt-2 rounded-xl border border-border bg-white p-4">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-text-muted">Senin – Sabtu</span><span className="font-medium text-text">07:00 – 20:00</span></div>
                            <div className="flex justify-between"><span className="text-text-muted">Minggu</span><span className="font-medium text-text">08:00 – 17:00</span></div>
                        </div>
                        <p className="mt-3 text-xs text-text-subtle">Pesanan di luar jam operasional akan diproses keesokan hari.</p>
                    </div>
                </section>
            </main>
        </div>
    );
}

function FaqItem({ title, answer }: { title: string; answer: string }) {
    return (
        <div className="rounded-xl border border-border bg-white p-4">
            <div className="text-sm font-semibold text-text">{title}</div>
            <div className="mt-1.5 text-xs leading-relaxed text-text-muted">{answer}</div>
        </div>
    );
}
