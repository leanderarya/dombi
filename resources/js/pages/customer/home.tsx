import { Head, Link, router, usePage } from '@inertiajs/react';
import { ChevronRight, MapPinned, MessageCircle, Milk, Package, Store, Truck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import DeliveryLoginSheet from '@/components/customer/delivery-login-sheet';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { useCustomerLocation, syncCustomerLocationDraft } from '@/lib/customer-location';

const HERO_SLIDES = [
    {
        title: 'Susu Kambing Segar',
        subtitle: 'Kualitas terbaik langsung dari Dombi',
        cta: 'Pesan Sekarang',
        ctaHref: '/customer/products',
        image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&q=80',
        gradient: 'from-emerald-600 via-emerald-500 to-teal-500',
    },
    {
        title: 'Delivery Mudah',
        subtitle: 'Pesanan dikirim langsung ke rumah Anda',
        cta: 'Pesan Sekarang',
        ctaHref: '/customer/products',
        image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
        gradient: 'from-emerald-700 via-emerald-600 to-emerald-500',
    },
    {
        title: 'Pickup Cepat',
        subtitle: 'Ambil langsung tanpa antre',
        cta: 'Pesan Sekarang',
        ctaHref: '/customer/products',
        image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=800&q=80',
        gradient: 'from-teal-600 via-emerald-500 to-emerald-400',
    },
];

export default function Home({ customerName, activeOrders }: any) {
    const { auth } = usePage<any>().props;
    const isLoggedIn = !!auth?.user;
    const [slideIndex, setSlideIndex] = useState(0);
    const [deliverySheetOpen, setDeliverySheetOpen] = useState(false);
    const [nearestOutlet, setNearestOutlet] = useState<{ name: string; distance_km: number } | null>(null);
    const [pickupLoading, setPickupLoading] = useState(false);
    const [foundOutletName, setFoundOutletName] = useState<string | null>(null);
    const [pickupError, setPickupError] = useState<string | null>(null);
    const { saveLocation } = useCustomerLocation();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [phoneBannerDismissed, setPhoneBannerDismissed] = useState(
        () => typeof window !== 'undefined' && localStorage.getItem('dombi_phone_banner_dismissed') === 'true'
    );
    const showPhoneBanner = isLoggedIn && !auth?.user?.customer?.phone && !phoneBannerDismissed;

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    // Auto-rotate hero slides (respect prefers-reduced-motion)
    useEffect(() => {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
            return;
        }

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

                    saveLocation({
                        latitude,
                        longitude,
                        timestamp: Date.now(),
                    });

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
        if (pickupLoading) {
            return;
        }

        setPickupLoading(true);
        setPickupError(null);
        setFoundOutletName(null);

        // Use cached nearest outlet if available
        if (nearestOutlet?.name) {
            setFoundOutletName(nearestOutlet.name);

            timerRef.current = setTimeout(() => {
                router.get('/customer/products');
            }, 2000);

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
            // Geolocation or fetch failed
        }

        if (!outletName) {
            outletName = 'Outlet Dombi';
        }

        setFoundOutletName(outletName);

        timerRef.current = setTimeout(() => {
            router.get('/customer/products');
        }, 2000);
    }, [nearestOutlet, pickupLoading]);

    const handleDelivery = useCallback(() => {
        if (!isLoggedIn) {
            setDeliverySheetOpen(true);
        } else {
            router.get('/customer/products');
        }
    }, [isLoggedIn]);

    return (
        <CustomerMobileLayout customerName={customerName} hideTopBar>
            <Head title="Home" />

            {/* Safe area spacer for PWA */}
            <div className="h-[env(safe-area-inset-top,0)]" />

            {/* SECTION 1 — HERO CAROUSEL */}
            <section className="-mx-4 overflow-hidden rounded-b-[2rem]">
                <div className="relative h-72 transition-all duration-700">
                    {/* Gradient fallback */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${HERO_SLIDES[slideIndex].gradient} transition-all duration-700`} />
                    {/* Image */}
                    {HERO_SLIDES[slideIndex].image && (
                        <img
                            src={HERO_SLIDES[slideIndex].image}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
                        />
                    )}
                    {/* Gradient overlay — bottom text area */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                    {/* Text — bottom left */}
                    <div className="absolute bottom-16 left-5 right-5 z-10">
                        <h1 className="text-2xl font-bold leading-tight text-white drop-shadow-md">
                            {HERO_SLIDES[slideIndex].title}
                        </h1>
                        <p className="mt-1 text-sm text-white/80 drop-shadow-sm">
                            {HERO_SLIDES[slideIndex].subtitle}
                        </p>
                        {HERO_SLIDES[slideIndex].cta && (
                            <Link
                                href={HERO_SLIDES[slideIndex].ctaHref!}
                                className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-white/20 backdrop-blur-sm px-6 text-sm font-bold text-white active:bg-white/30"
                            >
                                {HERO_SLIDES[slideIndex].cta}
                            </Link>
                        )}
                    </div>

                    {/* Dot indicators */}
                    <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-2">
                        {HERO_SLIDES.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setSlideIndex(i)}
                                className="flex min-h-11 min-w-11 items-center justify-center active:opacity-80"
                                aria-label={`Slide ${i + 1}`}
                            >
                                <span className={`block h-2 rounded-full transition-all duration-300 ${
                                    i === slideIndex ? 'w-6 bg-white' : 'w-2 bg-white/40'
                                }`} />
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Greeting Card — overlaps hero bottom */}
            <div className="relative -mt-8 z-20 mx-4 rounded-2xl bg-white px-5 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-lg font-bold text-text">
                            {isLoggedIn ? `Hai ${customerName ?? auth.user.name}!` : 'Selamat Datang di Dombi!'}
                        </div>
                        <div className="mt-1 text-xs text-text-muted">
                            {isLoggedIn ? 'Yuk pesan susu kambing segar hari ini.' : 'Masuk untuk pengalaman penuh.'}
                        </div>
                    </div>
                    {!isLoggedIn && (
                        <a
                            href="/oauth/google"
                            className="shrink-0 rounded-full border-2 border-primary px-4 py-2 text-xs font-bold text-primary active:bg-primary-light"
                        >
                            Masuk
                        </a>
                    )}
                </div>
            </div>

            {/* Phone Banner — optional, dismissible */}
            {showPhoneBanner && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-text-muted">Tambahkan nomor HP (opsional) untuk memudahkan kurir menghubungi.</p>
                    </div>
                    <a
                        href="/customer/verify-phone"
                        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white active:opacity-80"
                    >
                        Tambah
                    </a>
                    <button
                        type="button"
                        onClick={() => {
                            setPhoneBannerDismissed(true);
                            localStorage.setItem('dombi_phone_banner_dismissed', 'true');
                        }}
                        className="shrink-0 px-1 text-xs font-medium text-text-subtle active:opacity-80"
                    >
                        Nanti
                    </button>
                </div>
            )}

            {/* SECTION 2 — PESAN SEKARANG */}
            <section className="mt-6">
                <h2 className="fore-section-header">Pesan Sekarang</h2>
                <p className="mt-1 text-xs text-text-muted">Pilih cara belanja favoritmu.</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={handlePickup}
                        disabled={pickupLoading}
                        className="group flex min-h-[100px] flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-primary/30 bg-primary-light/50 p-4 transition-all active:opacity-80 active:scale-[0.98] disabled:opacity-50"
                    >
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-light">
                            <Store className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-center">
                            <div className="text-sm font-bold text-primary">Pick Up</div>
                            <div className="mt-0.5 text-[11px] text-text-muted">Ambil di outlet</div>
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={handleDelivery}
                        className="group flex min-h-[100px] flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4 transition-all active:opacity-80 active:scale-[0.98]"
                    >
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100">
                            <Truck className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="text-center">
                            <div className="text-sm font-bold text-amber-700">Delivery</div>
                            <div className="mt-0.5 text-[11px] text-text-muted">Diantar ke rumah</div>
                        </div>
                    </button>
                </div>
            </section>

            {/* SECTION 3 — ACTIVE ORDER (compact, only when active) */}
            {activeOrder && (
                <section className="mt-6">
                    <Link
                        href={`/customer/orders/${activeOrder.id}`}
                        className="group flex items-center gap-3 rounded-2xl border-2 border-primary/30 bg-white p-4 shadow-sm active:opacity-80"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light">
                            <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-text">Pesanan Aktif</span>
                                <span className="fore-badge-success">
                                    {activeOrder.status === 'preparing' ? 'Disiapkan' : activeOrder.status === 'ready_for_pickup' ? 'Siap Diambil' : 'Aktif'}
                                </span>
                            </div>
                            <div className="mt-0.5 text-xs text-text-muted">{activeOrder.order_code} · {activeOrder.outlet?.name ?? 'Outlet'}</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-text-subtle" />
                    </Link>
                </section>
            )}

            {/* SECTION 4 — YANG MENARIK DI DOMBI */}
            <section className="mt-6">
                <h2 className="fore-section-header">Jelajahi Dombi</h2>
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <Link
                        href="/customer/products"
                        className="group flex items-start gap-3 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-200 active:opacity-80"
                    >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                            <Milk className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-bold text-text">Produk Segar</div>
                            <div className="mt-0.5 text-[11px] leading-relaxed text-text-muted">Susu kambing pilihan</div>
                        </div>
                    </Link>

                    <Link
                        href="/customer/products"
                        className="group flex items-start gap-3 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-200 active:opacity-80"
                    >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                            <MapPinned className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-bold text-text">Outlet Terdekat</div>
                            <div className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
                                {nearestOutlet?.name ?? 'Cari outlet terdekat'}
                            </div>
                        </div>
                    </Link>

                    {isLoggedIn ? (
                        <Link
                            href="/customer/orders"
                            className="group flex items-start gap-3 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-200 active:opacity-80"
                        >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                                <Package className="h-4 w-4 text-amber-600" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-text">Riwayat Pesanan</div>
                                <div className="mt-0.5 text-[11px] leading-relaxed text-text-muted">Lihat pesanan sebelumnya</div>
                            </div>
                        </Link>
                    ) : (
                        <a
                            href="/oauth/google"
                            className="group flex items-start gap-3 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-200 active:opacity-80"
                        >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                                <Package className="h-4 w-4 text-amber-600" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-text">Riwayat Pesanan</div>
                                <div className="mt-0.5 text-[11px] leading-relaxed text-text-muted">Login untuk melihat</div>
                            </div>
                        </a>
                    )}

                    <a
                        href="https://wa.me/6281111111111"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-3 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-200 active:opacity-80"
                    >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-50">
                            <MessageCircle className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-bold text-text">Butuh Bantuan?</div>
                            <div className="mt-0.5 text-[11px] leading-relaxed text-text-muted">Hubungi via WhatsApp</div>
                        </div>
                    </a>
                </div>
            </section>

            {/* SECTION 6 — TRUST */}
            <section className="mt-6 mb-4">
                <div className="flex items-center justify-center gap-3 text-xs text-text-subtle">
                    <span>Sertifikasi Halal</span>
                    <span className="h-3 w-px bg-border" />
                    <span>Izin Usaha</span>
                    <span className="h-3 w-px bg-border" />
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
                <div
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-emerald-600 to-emerald-700"
                    role="dialog"
                    aria-live="polite"
                    aria-label="Ambil di Outlet"
                >
                    {pickupError ? (
                        <>
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20">
                                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-bold text-white">Gagal mendapatkan lokasi</div>
                                <div className="mt-2 text-sm text-emerald-100">Aktifkan izin lokasi atau pilih outlet secara manual.</div>
                                <div className="mt-5 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPickupError(null);
                                            setFoundOutletName(null);
                                            handlePickup();
                                        }}
                                        className="min-h-11 rounded-full bg-white/20 px-6 text-sm font-bold text-white active:opacity-80"
                                    >
                                        Coba Lagi
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPickupLoading(false);
                                            setPickupError(null);
                                            setFoundOutletName(null);
                                        }}
                                        className="min-h-11 rounded-full bg-white/10 px-6 text-sm font-medium text-white/80 active:opacity-80"
                                    >
                                        Tutup
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="mb-6 h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            <div className="text-center">
                                {foundOutletName ? (
                                    <>
                                        <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-200">Outlet Terdekat</div>
                                        <div className="mt-2 text-2xl font-bold text-white">{foundOutletName}</div>
                                        {nearestOutlet?.distance_km && (
                                            <div className="mt-1 text-sm text-emerald-200">{nearestOutlet.distance_km.toFixed(1)} km dari lokasi Anda</div>
                                        )}
                                        <div className="mt-3 text-sm text-emerald-100">Mengarahkan ke daftar produk...</div>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-sm font-medium text-emerald-100">Mencari outlet terdekat dari lokasi Anda</div>
                                        <div className="mt-2 text-xs text-emerald-200/70">Pastikan GPS aktif untuk hasil terbaik</div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </CustomerMobileLayout>
    );
}
