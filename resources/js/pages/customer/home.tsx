import { Head, Link, router, usePage } from '@inertiajs/react';
import { ChevronRight, MapPinned, MessageCircle, Milk, Package, Store, Truck, User } from 'lucide-react';
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
        if (pickupLoading) return;

        setPickupLoading(true);
        setPickupError(null);
        setFoundOutletName(null);

        // Use cached nearest outlet if available
        if (nearestOutlet?.name) {
            setFoundOutletName(nearestOutlet.name);

            // Keep overlay visible for at least 2 seconds before navigating
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
            // Fallback to default outlet name
            outletName = 'Outlet Dombi';
        }

        setFoundOutletName(outletName);

        // Keep overlay visible for at least 2 seconds before navigating
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
        <CustomerMobileLayout>
            <Head title="Home" />

            {/* SECTION 1 — HERO CAROUSEL */}
            <section className="-mx-4 -mt-5 overflow-hidden rounded-b-[2rem]">
                <div
                    className="relative flex h-65 items-center justify-center transition-all duration-700"
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
                                className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-white/20 backdrop-blur-sm px-6 text-sm font-bold text-white active:bg-white/30"
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
                                className={`flex min-h-11 min-w-11 items-center justify-center active:opacity-80`}
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

            {/* Phone Banner — optional, dismissible */}
            {showPhoneBanner && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-text-muted">Tambahkan nomor HP (opsional) untuk memudahkan kurir menghubungi.</p>
                    </div>
                    <a
                        href="/customer/verify-phone"
                        className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white active:opacity-80"
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
                <h2 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Pesan Sekarang</h2>
                <p className="mt-1 text-xs text-text-muted">Pilih cara belanja. Untuk pickup, kami rekomendasikan outlet terdekat.</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={handlePickup}
                        disabled={pickupLoading}
                        className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-emerald-50 p-4 transition-all duration-200 hover:shadow-sm active:opacity-80 active:bg-emerald-100 disabled:opacity-50 disabled:active:bg-emerald-50"
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
                        className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-emerald-50 p-4 transition-all duration-200 hover:shadow-sm active:opacity-80 active:bg-emerald-100"
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
                        className="group flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 transition-all duration-200 hover:shadow-sm active:opacity-80"
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
                        <ChevronRight className="h-4 w-4 text-text-subtle" />
                    </Link>
                ) : (
                    <div className="rounded-xl border border-border bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-text">Masuk untuk pengalaman penuh</div>
                                <div className="mt-0.5 text-xs text-text-muted">Lacak pesanan, simpan alamat.</div>
                            </div>
                            <a
                                href="/oauth/google"
                                className="flex min-h-11 shrink-0 items-center rounded-lg bg-primary px-4 text-xs font-bold text-white active:opacity-80"
                            >
                                Masuk Google
                            </a>
                        </div>
                    </div>
                )}
            </section>

            {/* SECTION 4 — YANG MENARIK DI DOMBI */}
            <section className="mt-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Yang Menarik di Dombi</h2>
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <Link
                        href="/customer/products"
                        className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm active:opacity-80"
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
                        className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm active:opacity-80"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 transition-transform duration-200 group-hover:scale-105">
                            <MapPinned className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-text">Outlet Terdekat</div>
                            <div className="mt-0.5 text-xs leading-relaxed text-text-muted">
                                {nearestOutlet?.name ? nearestOutlet.name : 'Pesanan diproses dari outlet terbaik'}
                            </div>
                        </div>
                    </Link>

                    {isLoggedIn ? (
                        <Link
                            href={activeOrder ? `/customer/orders/${activeOrder.id}` : '/customer/orders'}
                            className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm active:opacity-80"
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 transition-transform duration-200 group-hover:scale-105">
                                <Package className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-text">{activeOrder ? 'Pesanan Aktif' : 'Riwayat Pesanan'}</div>
                                <div className="mt-0.5 text-xs leading-relaxed text-text-muted">
                                    {activeOrder ? activeOrder.order_code : 'Lihat pesanan sebelumnya'}
                                </div>
                            </div>
                        </Link>
                    ) : (
                        <a
                            href="/oauth/google"
                            className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm active:opacity-80"
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

                    <a
                        href="https://wa.me/6281111111111"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm active:opacity-80"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 transition-transform duration-200 group-hover:scale-105">
                            <MessageCircle className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-text">Butuh Bantuan?</div>
                            <div className="mt-0.5 text-xs leading-relaxed text-text-muted">Hubungi tim Dombi via WhatsApp</div>
                        </div>
                    </a>
                </div>
            </section>

            {/* SECTION 5 — TRUST */}
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
