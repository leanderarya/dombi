import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    BadgeCheck,
    ChevronRight,
    Coffee,
    Coins,
    Crown,
    Gift,
    Leaf,
    Percent,
    Store,
    Wine,
} from 'lucide-react';
import { useState } from 'react';
import DeliveryLoginSheet from '@/components/customer/delivery-login-sheet';
import { gridCols } from '@/components/customer/responsive-layout-helpers';
import NotificationBell from '@/components/shared/notification-bell';
import NotificationSheet from '@/components/shared/notification-sheet';
import PushBanner from '@/components/shared/push-banner';
import { useGoogleLogin } from '@/hooks/use-google-login';
import { useHeroSlides } from '@/hooks/use-hero-slides';
import type { HeroSlide } from '@/hooks/use-hero-slides';
import { useLockSwipeBack } from '@/hooks/use-lock-swipe-back';
import { useNearestOutlet } from '@/hooks/use-nearest-outlet';
import { usePickupFlow } from '@/hooks/use-pickup-flow';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { usePolling } from '@/lib/use-polling';

/* ─── Main ─────────────────────────────────────────────────── */

export default function Home({ customerName, activeOrders }: any) {
    usePolling(20000);
    const { auth } = usePage<any>().props;
    const isLoggedIn = !!auth?.user;

    const hero = useHeroSlides();
    const nearestOutlet = useNearestOutlet();
    const pickup = usePickupFlow(nearestOutlet);

    const [deliverySheetOpen, setDeliverySheetOpen] = useState(false);
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [phoneBannerDismissed, setPhoneBannerDismissed] = useState(
        () =>
            typeof window !== 'undefined' &&
            localStorage.getItem('dombi_phone_banner_dismissed') === 'true',
    );

    const activeOrder = activeOrders?.[0] ?? null;

    useLockSwipeBack();

    const showPhoneBanner =
        isLoggedIn && !auth?.user?.customer?.phone && !phoneBannerDismissed;

    const handleDelivery = () => {
        if (!isLoggedIn) {
            setDeliverySheetOpen(true);
        } else {
            localStorage.setItem('dombi_fulfillment_type', 'delivery_dombi');
            router.get('/customer/products');
        }
    };

    return (
        <CustomerMobileLayout
            customerName={customerName}
            hideTopBar
            activeOrder={activeOrder}
        >
            <Head title="Home" />
            <div className={`${showPhoneBanner ? 'lg:grid lg:grid-cols-[1fr_320px] lg:gap-6' : ''}`}>
                <div className="min-w-0">
                    <HeroCarousel
                        hero={hero}
                        outletName={nearestOutlet?.name ?? null}
                        onOpenNotifications={() => setNotificationOpen(true)}
                    />
                    <GreetingCard
                        isLoggedIn={isLoggedIn}
                        customerName={customerName}
                        auth={auth}
                    />

                    <div className="lg:hidden">
                        <div className="mt-4">
                            <PushBanner variant="home" />
                        </div>

                        {showPhoneBanner && (
                            <PhoneBanner
                                onDismiss={() => {
                                    setPhoneBannerDismissed(true);
                                    localStorage.setItem(
                                        'dombi_phone_banner_dismissed',
                                        'true',
                                    );
                                }}
                            />
                        )}
                    </div>

                    <QuickActions
                        onPickup={pickup.start}
                        onDelivery={handleDelivery}
                        pickupLoading={pickup.loading}
                    />

                    <PromoBento />
                </div>
                {showPhoneBanner && (
                    <aside className="hidden lg:block">
                        <div className="space-y-4">
                            <PushBanner variant="home" />
                            <PhoneBanner
                                onDismiss={() => {
                                    setPhoneBannerDismissed(true);
                                    localStorage.setItem(
                                        'dombi_phone_banner_dismissed',
                                        'true',
                                    );
                                }}
                            />
                        </div>
                    </aside>
                )}
            </div>

            <DeliveryLoginSheet
                open={deliverySheetOpen}
                onClose={() => setDeliverySheetOpen(false)}
            />
            <NotificationSheet
                open={notificationOpen}
                onClose={() => setNotificationOpen(false)}
            />
            {pickup.loading && <PickupOverlay pickup={pickup} />}
        </CustomerMobileLayout>
    );
}

/* ─── Hero Header & Carousel ───────────────────────────────── */

function HeroCarousel({
    hero,
    outletName,
    onOpenNotifications,
}: {
    hero: ReturnType<typeof useHeroSlides>;
    outletName: string | null;
    onOpenNotifications: () => void;
}) {
    const { slides, index, setIndex } = hero;

    return (
        <section className="relative -mx-4 overflow-hidden rounded-b-[28px] bg-gradient-to-b from-[#185338] via-[#216b49] to-[#3a8b63] pb-14">
            {/* Decorative blobs */}
            <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute bottom-0 -left-10 h-36 w-36 rounded-full bg-black/10 blur-xl" />

            {/* Top bar: brand store + bell */}
            <div className="relative z-10 flex items-center justify-between px-4 pt-safe pb-3 text-white">
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide">
                    <Store className="h-3 w-3 text-emerald-300" />
                    Dombi Store • {outletName ?? 'Seturan'}
                </span>
                <NotificationBell
                    onClick={onOpenNotifications}
                    className="text-white active:bg-white/20"
                />
            </div>

            {/* Carousel slides */}
            <div className="relative z-10 px-4 pb-3">
                <div className="overflow-hidden">
                    <div
                        className="flex transition-transform duration-500 ease-out"
                        style={{ transform: `translateX(-${index * 100}%)` }}
                    >
                        {slides.map((slide) => (
                            <HeroSlideCard key={slide.title} slide={slide} />
                        ))}
                    </div>
                </div>

                {/* Dots */}
                <div className="mt-3 flex items-center justify-center gap-1.5">
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setIndex(i)}
                            aria-label={`Slide ${i + 1}`}
                            className={`rounded-full transition-all duration-300 ${
                                i === index
                                    ? 'h-1.5 w-5 bg-white'
                                    : 'h-1.5 w-1.5 bg-white/40'
                            }`}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}

function HeroSlideCard({ slide }: { slide: HeroSlide }) {
    return (
        <div className="flex min-w-full items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
            <div className="max-w-[60%] space-y-1">
                <span className="inline-block rounded-md bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-300 uppercase">
                    {slide.title}
                </span>
                <h2 className="text-xl leading-tight font-extrabold text-white">
                    {slide.subtitle}
                </h2>
                <p className="text-[9px] font-medium text-emerald-200/80">
                    {slide.cta}
                </p>
            </div>
            <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
                <img
                    src={slide.image}
                    alt={slide.title}
                    className="h-24 w-24 rotate-3 rounded-xl object-cover shadow-lg transition-transform duration-300 hover:rotate-0"
                />
            </div>
        </div>
    );
}

/* ─── Greeting Card ────────────────────────────────────────── */

function GreetingCard({
    isLoggedIn,
    customerName,
    auth,
}: {
    isLoggedIn: boolean;
    customerName: string;
    auth: any;
}) {
    const { login } = useGoogleLogin();

    return (
        <section className="relative z-20 -mt-10">
            <div className="rounded-2xl border border-border bg-white p-4 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.06)]">
                <div className="mb-3 flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-medium text-text-muted">
                            Selamat datang,
                        </span>
                        <h1 className="flex items-center gap-1.5 text-base font-bold text-text">
                            {isLoggedIn
                                ? `Hai ${(
                                      customerName ??
                                      auth?.user?.name ??
                                      ''
                                  ).toUpperCase()}!`
                                : 'Hai, Dombi Lovers!'}
                            {isLoggedIn && (
                                <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                            )}
                        </h1>
                    </div>
                    {isLoggedIn ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-500 shadow-sm">
                            <Coins className="h-4 w-4" />
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={login}
                            className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white active:opacity-80"
                        >
                            Masuk
                        </button>
                    )}
                </div>

                {isLoggedIn && (
                    <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
                        <button
                            type="button"
                            className="flex flex-1 items-center justify-between rounded-xl border border-emerald-100 bg-primary-light px-3 py-2 text-left active:opacity-80"
                        >
                            <div className="flex items-center gap-2">
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                                    <Leaf className="h-3 w-3" />
                                </div>
                                <span className="text-xs font-bold text-text">
                                    120{' '}
                                    <span className="font-normal text-text-muted">
                                        Poin
                                    </span>
                                </span>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                        </button>
                        <button
                            type="button"
                            className="flex flex-1 items-center justify-between rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-left active:opacity-80"
                        >
                            <div className="flex items-center gap-2">
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-[10px] text-white">
                                    <Crown className="h-3 w-3" />
                                </div>
                                <span className="text-xs font-bold text-sky-950">
                                    MyDombi Plan
                                </span>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-sky-400" />
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}

/* ─── Quick Actions (Pick Up vs Delivery) ──────────────────── */

function QuickActions({
    onPickup,
    onDelivery,
    pickupLoading,
}: {
    onPickup: () => void;
    onDelivery: () => void;
    pickupLoading: boolean;
}) {
    return (
        <section className="mt-6">
            <h2 className="px-4 text-sm font-bold text-text">Pesan Sekarang</h2>
            <div className={`mt-3 grid ${gridCols(2)} gap-3 px-4`}>
                <button
                    type="button"
                    onClick={onPickup}
                    disabled={pickupLoading}
                    className="group relative flex h-36 flex-col justify-between overflow-hidden rounded-2xl border border-emerald-200/70 bg-primary-light p-4 text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all active:opacity-80 disabled:opacity-50"
                >
                    <div className="relative z-10">
                        <h3 className="text-base font-extrabold text-primary transition-transform group-hover:translate-x-0.5">
                            Pick Up
                        </h3>
                        <p className="mt-1 text-[11px] leading-snug font-medium text-text-muted">
                            Ambil di store
                            <br />
                            tanpa antri
                        </p>
                    </div>
                    <div className="relative z-10 flex items-end justify-end">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs text-white shadow-md">
                            <Gift className="h-3.5 w-3.5" />
                        </span>
                    </div>
                    <div className="absolute -right-2 -bottom-2 h-20 w-20 rounded-full bg-emerald-200/40 blur-md transition-transform group-hover:scale-110" />
                </button>

                <button
                    type="button"
                    onClick={onDelivery}
                    className="group relative flex h-36 flex-col justify-between overflow-hidden rounded-2xl border border-orange-200/70 bg-orange-50/60 p-4 text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all active:opacity-80"
                >
                    <div className="relative z-10">
                        <h3 className="text-base font-extrabold text-orange-700 transition-transform group-hover:translate-x-0.5">
                            Delivery
                        </h3>
                        <p className="mt-1 text-[11px] leading-snug font-medium text-text-muted">
                            Garansi tepat
                            <br />
                            waktu, dijamin!
                        </p>
                    </div>
                    <div className="relative z-10 flex items-end justify-end">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-700 text-xs text-white shadow-md">
                            <Coffee className="h-3.5 w-3.5" />
                        </span>
                    </div>
                    <div className="absolute -right-2 -bottom-2 h-20 w-20 rounded-full bg-orange-200/40 blur-md transition-transform group-hover:scale-110" />
                </button>
            </div>
        </section>
    );
}

/* ─── Promo Bento ──────────────────────────────────────────── */

const PROMO_BENTOS = [
    {
        title: 'MyDombi Plan',
        subtitle: 'Berlangganan jauh lebih untung',
        icon: <Percent className="h-4 w-4" />,
        iconBg: 'bg-emerald-100 text-primary',
        cta: 'Cek Paket',
    },
    {
        title: 'Dombi Essentials',
        subtitle: 'Bawa minumanmu gaya baru',
        icon: <Wine className="h-4 w-4" />,
        iconBg: 'bg-amber-100 text-amber-700',
        cta: 'Lihat Merchandise',
        badge: 'Baru',
    },
    {
        title: 'Catering & Event',
        subtitle: 'Rayakan momen bareng Dombi',
        icon: <Coffee className="h-4 w-4" />,
        iconBg: 'bg-purple-100 text-purple-700',
        cta: 'Pesan Sekarang',
    },
];

function PromoBento() {
    return (
        <section className="mt-6">
            <div className="flex items-center justify-between px-4">
                <h2 className="text-sm font-bold text-text">
                    Yang Menarik di Dombi
                </h2>
                <Link
                    href="/customer/products"
                    className="text-xs font-semibold text-primary active:opacity-80"
                >
                    Lihat Semua
                </Link>
            </div>

            <div className={`mt-3 grid gap-3 px-4 ${gridCols(3)}`}>
                {PROMO_BENTOS.map((bento) => (
                    <div
                        key={bento.title}
                        className="relative flex flex-col justify-between rounded-2xl border border-border bg-white p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                    >
                        <div>
                            <div
                                className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${bento.iconBg}`}
                            >
                                {bento.icon}
                            </div>
                            {bento.badge && (
                                <span className="absolute top-2 right-2 rounded bg-orange-700 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                    {bento.badge}
                                </span>
                            )}
                            <h3 className="text-xs font-bold text-text">
                                {bento.title}
                            </h3>
                            <p className="mt-0.5 text-[11px] text-text-muted">
                                {bento.subtitle}
                            </p>
                        </div>
                        <div className="mt-3 flex items-center border-t border-gray-100 pt-2 text-[10px] font-bold text-primary">
                            <span>{bento.cta}</span>
                            <ArrowRight className="ml-1 h-3 w-3" />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

/* ─── Phone Banner ─────────────────────────────────────────── */

function PhoneBanner({ onDismiss }: { onDismiss: () => void }) {
    return (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3">
            <p className="min-w-0 flex-1 text-xs text-text-muted">
                Tambahkan nomor HP (opsional) untuk memudahkan kurir
                menghubungi.
            </p>
            <a
                href="/customer/verify-phone"
                className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white active:opacity-80"
            >
                Tambah
            </a>
            <button
                type="button"
                onClick={onDismiss}
                className="shrink-0 px-1 text-xs font-medium text-text-subtle active:opacity-80"
            >
                Nanti
            </button>
        </div>
    );
}

/* ─── Pickup Overlay ───────────────────────────────────────── */

function PickupOverlay({
    pickup,
}: {
    pickup: ReturnType<typeof usePickupFlow>;
}) {
    const { foundOutletName } = pickup;

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-emerald-600 to-emerald-700"
            role="dialog"
            aria-live="polite"
            aria-label="Ambil di Outlet"
        >
            <div className="mb-6 h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <div className="px-6 text-center">
                {foundOutletName ? (
                    <>
                        <div className="text-[11px] font-bold tracking-widest text-emerald-200 uppercase">
                            Outlet Terdekat
                        </div>
                        <div className="mt-2 text-2xl font-bold text-white">
                            {foundOutletName}
                        </div>
                        <div className="mt-3 text-sm text-emerald-100">
                            Mengarahkan ke daftar produk...
                        </div>
                    </>
                ) : (
                    <>
                        <div className="text-sm font-medium text-emerald-100">
                            Mencari outlet terdekat dari lokasi Anda
                        </div>
                        <div className="mt-2 text-xs text-emerald-200/70">
                            Pastikan GPS aktif untuk hasil terbaik
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
