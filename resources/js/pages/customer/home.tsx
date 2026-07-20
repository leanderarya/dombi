import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ChatCircleFill,
    MapPinFill,
    PackageFill,
    StorefrontFill,
    TruckFill,
} from '@/components/icons/phosphor-fill';
import { useState } from 'react';
import DeliveryLoginSheet from '@/components/customer/delivery-login-sheet';
import { useGoogleLogin } from '@/hooks/use-google-login';
import { useHeroSlides } from '@/hooks/use-hero-slides';
import { useLockSwipeBack } from '@/hooks/use-lock-swipe-back';
import { useNearestOutlet } from '@/hooks/use-nearest-outlet';
import { usePickupFlow } from '@/hooks/use-pickup-flow';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import PushBanner from '@/components/shared/push-banner';
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
            localStorage.setItem('dombi_fulfillment_type', 'delivery');
            router.get('/customer/products');
        }
    };

    return (
        <CustomerMobileLayout
            customerName={customerName}
            hideTopBar
            activeOrder={activeOrder}
            keepBottomNavVisible
        >
            <Head title="Home" />
            <HeroCarousel hero={hero} />
            <GreetingCard
                isLoggedIn={isLoggedIn}
                customerName={customerName}
                auth={auth}
            />

            <PushBanner variant="home" />

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

            <QuickActions
                onPickup={pickup.start}
                onDelivery={handleDelivery}
                pickupLoading={pickup.loading}
            />

            <ExploreGrid
                nearestOutlet={nearestOutlet}
                isLoggedIn={isLoggedIn}
            />
            <TrustBadges />

            <DeliveryLoginSheet
                open={deliverySheetOpen}
                onClose={() => setDeliverySheetOpen(false)}
            />
            {pickup.loading && <PickupOverlay pickup={pickup} />}
        </CustomerMobileLayout>
    );
}

/* ─── Sub-components ───────────────────────────────────────── */

function HeroCarousel({ hero }: { hero: ReturnType<typeof useHeroSlides> }) {
    const { slides, index, setIndex, current } = hero;

    return (
        <section className="-mx-4 overflow-hidden rounded-b-[2rem]">
            <div className="relative h-72 transition-all duration-700">
                <div
                    className={`absolute inset-0 bg-gradient-to-br ${current.gradient} transition-all duration-700`}
                />
                <img
                    src={current.image}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                <div className="absolute right-5 bottom-16 left-5 z-10">
                    <h1 className="text-2xl leading-tight font-bold text-white drop-shadow-md">
                        {current.title}
                    </h1>
                    <p className="mt-1 text-sm text-white/80 drop-shadow-sm">
                        {current.subtitle}
                    </p>
                    {current.cta && (
                        <Link
                            href={current.ctaHref}
                            className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-white/20 px-6 text-sm font-bold text-white backdrop-blur-sm active:bg-white/30"
                        >
                            {current.cta}
                        </Link>
                    )}
                </div>

                <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-2">
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setIndex(i)}
                            className="flex min-h-11 min-w-11 items-center justify-center active:opacity-80"
                            aria-label={`Slide ${i + 1}`}
                        >
                            <span
                                className={`block h-2 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/40'}`}
                            />
                        </button>
                    ))}
                </div>
            </div>
        </section>
    );
}

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
        <div className="relative z-20 mx-4 -mt-8 rounded-2xl bg-white px-5 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-lg font-bold text-text">
                        {isLoggedIn
                            ? `Hai ${customerName ?? auth.user.name}!`
                            : 'Selamat Datang di Dombi!'}
                    </div>
                    <div className="mt-1 text-xs text-text-muted">
                        {isLoggedIn
                            ? 'Yuk belanja kebutuhanmu hari ini.'
                            : 'Masuk untuk pengalaman penuh.'}
                    </div>
                </div>
                {!isLoggedIn && (
                    <button
                        type="button"
                        onClick={login}
                        className="shrink-0 rounded-full border-2 border-primary px-4 py-2 text-xs font-bold text-primary active:bg-primary-light"
                    >
                        Masuk
                    </button>
                )}
            </div>
        </div>
    );
}

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
            <h2 className="fore-section-header">Pesan Sekarang</h2>
            <p className="mt-1 text-xs text-text-muted">
                Pilih cara belanja favoritmu.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={onPickup}
                    disabled={pickupLoading}
                    className="group flex min-h-[100px] flex-col items-center justify-center gap-2.5 rounded-2xl bg-primary-light/30 p-4 transition-all active:scale-[0.98] active:opacity-80 disabled:opacity-50"
                >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
                        <StorefrontFill className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-center">
                        <div className="text-sm font-bold text-text">
                            Pick Up
                        </div>
                        <div className="mt-0.5 text-[11px] text-text-muted">
                            Ambil di outlet
                        </div>
                    </div>
                </button>
                <button
                    type="button"
                    onClick={onDelivery}
                    className="group flex min-h-[100px] flex-col items-center justify-center gap-2.5 rounded-2xl bg-amber-50/40 p-4 transition-all active:scale-[0.98] active:opacity-80"
                >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
                        <TruckFill className="h-6 w-6 text-amber-600" />
                    </div>
                    <div className="text-center">
                        <div className="text-sm font-bold text-text">
                            Delivery
                        </div>
                        <div className="mt-0.5 text-[11px] text-text-muted">
                            Diantar ke rumah
                        </div>
                    </div>
                </button>
            </div>
        </section>
    );
}

interface ExploreCard {
    icon: React.ReactNode;
    bg: string;
    title: string;
    subtitle: string;
    href: string;
    isButton?: boolean;
    onClick?: () => void;
}

function ExploreGrid({
    nearestOutlet,
    isLoggedIn,
}: {
    nearestOutlet: { name: string } | null;
    isLoggedIn: boolean;
}) {
    const { login } = useGoogleLogin();

    const cards: ExploreCard[] = [
        {
            icon: <MapPinFill className="h-5 w-5 text-blue-600" />,
            bg: 'bg-blue-50',
            title: 'Outlet Terdekat',
            subtitle: nearestOutlet?.name ?? 'Cari outlet terdekat',
            href: '/customer/products',
        },
        {
            icon: <PackageFill className="h-5 w-5 text-amber-600" />,
            bg: 'bg-amber-50',
            title: 'Riwayat Pesanan',
            subtitle: isLoggedIn
                ? 'Lihat pesanan sebelumnya'
                : 'Login untuk melihat',
            href: isLoggedIn ? '/customer/orders' : undefined,
            onClick: isLoggedIn ? undefined : login,
        },
        {
            icon: <ChatCircleFill className="h-5 w-5 text-purple-600" />,
            bg: 'bg-purple-50',
            title: 'Butuh Bantuan?',
            subtitle: 'Hubungi via WhatsApp',
            href: 'https://wa.me/6281111111111',
            isButton: true,
        },
    ];

    return (
        <section className="mt-6">
            <h2 className="fore-section-header">Jelajahi Dombi</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
                {cards.map((card) => {
                    if (card.onClick) {
                        return (
                            <button
                                key={card.title}
                                type="button"
                                onClick={card.onClick}
                                className="group flex items-start gap-3 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-200 active:opacity-80"
                            >
                                <div
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.bg} shadow-inner`}
                                >
                                    {card.icon}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-text">
                                        {card.title}
                                    </div>
                                    <div className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
                                        {card.subtitle}
                                    </div>
                                </div>
                            </button>
                        );
                    }

                    const Tag = card.isButton ? 'a' : Link;
                    const extra = card.isButton
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {};

                    return (
                        <Tag
                            key={card.title}
                            href={card.href!}
                            {...extra}
                            className="group flex items-start gap-3 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-200 active:opacity-80"
                        >
                            <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.bg} shadow-inner`}
                            >
                                {card.icon}
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-text">
                                    {card.title}
                                </div>
                                <div className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
                                    {card.subtitle}
                                </div>
                            </div>
                        </Tag>
                    );
                })}
            </div>
        </section>
    );
}

function TrustBadges() {
    return (
        <section className="mt-6 mb-4">
            <div className="flex items-center justify-center gap-3 text-xs text-text-subtle">
                <span>Sertifikasi Halal</span>
                <span className="h-3 w-px bg-border" />
                <span>Izin Usaha</span>
                <span className="h-3 w-px bg-border" />
                <span>Dombi 2024</span>
            </div>
        </section>
    );
}

function PickupOverlay({
    pickup,
}: {
    pickup: ReturnType<typeof usePickupFlow>;
}) {
    const { foundOutletName, retry, cancel } = pickup;

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-emerald-600 to-emerald-700"
            role="dialog"
            aria-live="polite"
            aria-label="Ambil di Outlet"
        >
            <div className="mb-6 h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <div className="text-center">
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
