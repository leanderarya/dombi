import { Head, Link, router, usePage } from '@inertiajs/react';
import { MapPinned, MessageCircle, Milk, Package, ShieldCheck, Store, Truck, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import DeliveryLoginSheet from '@/components/customer/delivery-login-sheet';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { useCustomerLocation, syncCustomerLocationDraft } from '@/lib/customer-location';

const HERO_SLIDES = [
    {
        title: 'Susu Kambing Segar',
        subtitle: 'Kualitas terbaik langsung dari Dombi',
        cta: 'Pesan Sekarang',
        ctaHref: '/customer/products',
        gradient: 'from-emerald-600 via-emerald-500 to-teal-500',
    },
    {
        title: 'Delivery Mudah',
        subtitle: 'Pesanan dikirim langsung ke rumah Anda',
        cta: 'Pesan Sekarang',
        ctaHref: '/customer/products',
        gradient: 'from-emerald-700 via-emerald-600 to-emerald-500',
    },
    {
        title: 'Pickup Cepat',
        subtitle: 'Ambil langsung tanpa antre',
        cta: 'Pesan Sekarang',
        ctaHref: '/customer/products',
        gradient: 'from-teal-600 via-emerald-500 to-emerald-400',
    },
];

export default function Home({ customerName, activeOrders }: any) {
    const { auth } = usePage<any>().props;
    const isLoggedIn = !!auth?.user;
    const hasLinkedCustomer = !!auth?.user?.customer;
    const [slideIndex, setSlideIndex] = useState(0);
    const [deliverySheetOpen, setDeliverySheetOpen] = useState(false);
    const [nearestOutlet, setNearestOutlet] = useState<{ name: string; distance_km: number } | null>(null);
    const [pickupLoading, setPickupLoading] = useState(false);
    const [pickupOutletName, setPickupOutletName] = useState<string | null>(null);
    const { saveLocation } = useCustomerLocation();

    // Auto-rotate hero slides
    useEffect(() => {
        const timer = setInterval(() => {
            setSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
        }, 5000);

        return () => clearInterval(timer);
    }, []);

    // Auto-detect location and fetch nearest outlet
    useEffect(() => {
        if (!navigator.geolocation) {
return;
}

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;

                    // Save location to localStorage
                    saveLocation({
                        latitude,
                        longitude,
                        timestamp: Date.now(),
                    });

                    // Sync location to server session for checkout
                    syncCustomerLocationDraft({
                        latitude,
                        longitude,
                        timestamp: Date.now(),
                    });

                    const response = await fetch(`/customer/checkout/pickup-outlets?latitude=${latitude}&longitude=${longitude}`);
                    const data = await response.json();

                    if (data.recommended) {
                        setNearestOutlet({
                            name: data.recommended.name,
                            distance_km: data.recommended.distance_km,
                        });
                    }
                } catch {
                    // Silently fail - not critical
                }
            },
            () => {
                // Permission denied or error - not critical
            },
            { enableHighAccuracy: false, timeout: 5000 }
        );
    }, [saveLocation]);

    const activeOrder = activeOrders?.[0] ?? null;

    const handlePickup = useCallback(async () => {
        setPickupLoading(true);
        setPickupOutletName(null);

        // Use cached nearest outlet if available
        if (nearestOutlet?.name) {
            setPickupOutletName(nearestOutlet.name);
            setTimeout(() => {
                router.get('/customer/products');
            }, 3000);

            return;
        }

        // Otherwise fetch from API
        let outletName: string | null = null;

        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            const response = await fetch(`/customer/checkout/pickup-outlets?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}`);
            const data = await response.json();
            outletName = data.recommended?.name ?? null;
        } catch {
            // Geolocation failed
        }

        setPickupOutletName(outletName ?? 'Outlet Dombi');

        setTimeout(() => {
            router.get('/customer/products');
        }, 3000);
    }, [nearestOutlet]);

    const handleDelivery = useCallback(() => {
        if (!isLoggedIn || !hasLinkedCustomer) {
            setDeliverySheetOpen(true);
        } else {
            router.get('/customer/products');
        }
    }, [isLoggedIn, hasLinkedCustomer]);

    return (
        <CustomerMobileLayout>
            <Head title="Home" />

            {/* SECTION 1 — HERO CAROUSEL */}
            <section className="-mx-4 -mt-5 overflow-hidden rounded-b-[2rem]">
                <div
                    className="relative flex h-[320px] items-center justify-center transition-all duration-700"
                    style={{ backgroundImage: 'none' }}
                >
                    <div className={`absolute inset-0 bg-gradient-to-br ${HERO_SLIDES[slideIndex].gradient} transition-all duration-700`} />
                    {/* Decorative circles */}
                    <div className="absolute inset-0 overflow-hidden opacity-10">
                        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white" />
                        <div className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-white" />
                        <div className="absolute bottom-8 right-8 h-32 w-32 rounded-full bg-white" />
                    </div>

                    <div className="relative z-10 flex flex-col items-center px-8 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                            <span className="text-3xl font-bold text-white">D</span>
                        </div>
                        <h1 className="mt-5 text-2xl font-bold leading-tight text-white">
                            {HERO_SLIDES[slideIndex].title}
                        </h1>
                        <p className="mt-2 text-sm text-white/80">
                            {HERO_SLIDES[slideIndex].subtitle}
                        </p>
                        {HERO_SLIDES[slideIndex].cta && (
                            <Link
                                href={HERO_SLIDES[slideIndex].ctaHref!}
                                className="mt-5 min-h-[44px] rounded-full bg-white px-6 py-2.5 text-sm font-bold text-emerald-700 shadow-lg transition-all active:scale-95"
                            >
                                {HERO_SLIDES[slideIndex].cta}
                            </Link>
                        )}
                    </div>

                    {/* Dot indicators */}
                    <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
                        {HERO_SLIDES.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setSlideIndex(i)}
                                className={`h-2 rounded-full transition-all duration-300 ${
                                    i === slideIndex ? 'w-6 bg-white' : 'w-2 bg-white/40'
                                }`}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 2 — PESAN SEKARANG */}
            <section className="mt-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Pesan Sekarang</h2>
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={handlePickup}
                        className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-emerald-50 p-4 transition-all duration-200 hover:shadow-sm active:scale-[0.98] active:bg-emerald-100"
                    >
                        <div className="transition-transform duration-200 group-hover:scale-105">
                            <Store className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div className="text-sm font-bold text-emerald-700">Ambil di Outlet</div>
                        <div className="text-xs text-emerald-600">Tanpa antre</div>
                    </button>
                    <button
                        type="button"
                        onClick={handleDelivery}
                        className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-emerald-50 p-4 transition-all duration-200 hover:shadow-sm active:scale-[0.98] active:bg-emerald-100"
                    >
                        <div className="transition-transform duration-200 group-hover:scale-105">
                            <Truck className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div className="text-sm font-bold text-emerald-700">Kurir Dombi</div>
                        <div className="text-xs text-emerald-600">Diantar ke rumah</div>
                    </button>
                </div>
            </section>

            {/* SECTION 3 — ACCOUNT SUMMARY */}
            <section className="mt-6">
                {isLoggedIn ? (
                    <Link
                        href={activeOrder ? `/customer/orders/${activeOrder.id}` : '/customer/orders'}
                        className="group flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 transition-transform duration-200 group-hover:scale-105">
                            <User className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-text">
                                Halo, {customerName ?? auth.user.name}
                            </div>
                            <div className="mt-0.5 text-xs text-text-muted">
                                {activeOrder
                                    ? `Pesanan Aktif · ${activeOrder.order_code}`
                                    : 'Belum Ada Pesanan Aktif'}
                            </div>
                        </div>
                        <svg className="h-4 w-4 text-text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                ) : (
                    <div className="rounded-xl border border-border bg-emerald-50/50 px-4 py-3">
                        <div className="text-sm font-semibold text-text">Masuk untuk fitur penuh</div>
                        <div className="mt-0.5 text-xs text-text-muted">Lacak pesanan, simpan alamat, dan lebih banyak lagi.</div>
                        <a
                            href="/auth/google"
                            className="mt-3 flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary text-xs font-bold text-white transition-all active:scale-[0.98] active:bg-primary-hover"
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Masuk dengan Google
                        </a>
                    </div>
                )}
            </section>

            {/* SECTION 4 — YANG MENARIK DI DOMBI */}
            <section className="mt-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Yang Menarik di Dombi</h2>
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <Link
                        href="/customer/products"
                        className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 transition-transform duration-200 group-hover:scale-105">
                            <Milk className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-text">Produk Segar</div>
                            <div className="mt-0.5 text-xs leading-relaxed text-text-muted">Susu kambing pilihan setiap hari</div>
                        </div>
                    </Link>

                    <Link
                        href="/customer/products"
                        className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 transition-transform duration-200 group-hover:scale-105">
                            <MapPinned className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-text">Outlet Terdekat</div>
                            <div className="mt-0.5 text-xs leading-relaxed text-text-muted">Pesanan diproses dari outlet terbaik</div>
                        </div>
                    </Link>

                    {isLoggedIn ? (
                        <Link
                            href="/customer/orders"
                            className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 transition-transform duration-200 group-hover:scale-105">
                                <Package className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-text">Riwayat Pesanan</div>
                                <div className="mt-0.5 text-xs leading-relaxed text-text-muted">Lihat pesanan sebelumnya</div>
                            </div>
                        </Link>
                    ) : (
                        <a
                            href="/auth/google"
                            className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 transition-transform duration-200 group-hover:scale-105">
                                <Package className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-text">Riwayat Pesanan</div>
                                <div className="mt-0.5 text-xs leading-relaxed text-text-muted">Login untuk melihat pesanan</div>
                            </div>
                        </a>
                    )}

                    <div className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50">
                            <ShieldCheck className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-text">Kualitas Terjamin</div>
                            <div className="mt-0.5 text-xs leading-relaxed text-text-muted">Diproses dengan standar kualitas Dombi</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 5 — BANTUAN */}
            <section className="mt-6">
                <a
                    href="https://wa.me/6281111111111"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 rounded-2xl border border-border bg-white px-4 py-4 transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 transition-transform duration-200 group-hover:scale-105">
                        <MessageCircle className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-text">Butuh Bantuan?</div>
                        <div className="mt-0.5 text-xs text-text-muted">Hubungi tim Dombi via WhatsApp</div>
                    </div>
                    <svg className="h-4 w-4 shrink-0 text-text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </a>
            </section>

            {/* SECTION 6 — TRUST */}
            <section className="mt-6 mb-4">
                <div className="flex items-center justify-center gap-3 text-xs text-zinc-400">
                    <span>Sertifikasi Halal</span>
                    <span className="h-3 w-px bg-zinc-200" />
                    <span>Izin Usaha</span>
                    <span className="h-3 w-px bg-zinc-200" />
                    <span>Dombi 2024</span>
                </div>
            </section>

            {/* Delivery Login Sheet */}
            <DeliveryLoginSheet
                open={deliverySheetOpen}
                onClose={() => setDeliverySheetOpen(false)}
            />

            {/* Pickup Loading Overlay */}
            {pickupLoading && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-emerald-600 to-emerald-700">
                    <div className="mb-6 h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {pickupOutletName ? (
                        <div className="text-center">
                            <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-200">Outlet Terdekat</div>
                            <div className="mt-2 text-2xl font-bold text-white">{pickupOutletName}</div>
                            <div className="mt-3 text-sm text-emerald-100">Menuju produk...</div>
                        </div>
                    ) : (
                        <div className="text-center">
                            <div className="text-sm font-medium text-emerald-100">Mencari outlet terdekat dari lokasi Anda</div>
                        </div>
                    )}
                </div>
            )}
        </CustomerMobileLayout>
    );
}
