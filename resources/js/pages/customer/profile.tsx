import { Head, Link, router, usePage } from '@inertiajs/react';
import { HelpCircle, Info, LogOut, MapPin, Package } from 'lucide-react';
import { useState } from 'react';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import LoginDialog from '@/components/customer/login-dialog';
import { useLockSwipeBack } from '@/hooks/use-lock-swipe-back';

export default function Profile({ defaultAddress }: any) {
    useLockSwipeBack();
    const { auth, appVersion } = usePage<any>().props;
    const user = auth?.user;
    const isLoggedIn = !!auth?.user;
    const [loginDialogOpen, setLoginDialogOpen] = useState(false);

    const initials =
        user?.name
            ?.split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) ?? 'U';

    return (
        <CustomerMobileLayout hideTopBar hideCartBar>
            <Head title="Pengaturan" />

            {/* PWA safe area spacer */}
            <div className="pt-safe" />

            {/* User Info */}
            <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700">
                    {initials}
                </div>
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-xl font-semibold text-text">
                        {user?.name ?? 'Pengguna'}
                    </h1>
                    {user?.email && (
                        <p className="truncate text-sm text-text-muted">
                            {user.email}
                        </p>
                    )}
                </div>
            </div>

            {/* Default Address */}
            {defaultAddress && (
                <section className="mt-5">
                    <h2 className="text-[13px] text-text-subtle">
                        Alamat Utama
                    </h2>
                    <div className="mt-2 rounded-xl border border-border bg-white p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                                <MapPin className="h-4 w-4 text-emerald-700" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-text">
                                        {defaultAddress.label || 'Alamat Utama'}
                                    </span>
                                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 uppercase">
                                        Utama
                                    </span>
                                </div>
                                <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-muted">
                                    {defaultAddress.address}
                                </div>
                            </div>
                        </div>
                        {isLoggedIn ? (
                            <Link
                                href="/customer/addresses"
                                className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-lg border border-border text-xs font-semibold text-text active:opacity-80"
                            >
                                Kelola Alamat
                            </Link>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setLoginDialogOpen(true)}
                                className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-lg border border-border text-xs font-semibold text-text active:opacity-80"
                            >
                                Login untuk Kelola Alamat
                            </button>
                        )}
                    </div>
                </section>
            )}

            {/* Menu */}
            <section className="mt-6">
                <h2 className="text-[13px] text-text-subtle">Menu</h2>
                <div className="mt-2 space-y-1">
                    <MenuItem
                        href="/customer/orders"
                        title="Pesanan Saya"
                        icon={<Package className="h-5 w-5 text-text-subtle" />}
                    />
                    {isLoggedIn ? (
                        <MenuItem
                            href="/customer/addresses"
                            title="Alamat Saya"
                            icon={
                                <MapPin className="h-5 w-5 text-text-subtle" />
                            }
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={() => setLoginDialogOpen(true)}
                            className="flex min-h-[52px] w-full items-center gap-3.5 rounded-xl px-1 active:opacity-80"
                        >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                                <MapPin className="h-5 w-5 text-text-subtle" />
                            </div>
                            <span className="text-sm font-medium text-text">
                                Alamat Saya
                            </span>
                            <svg
                                className="ml-auto h-4 w-4 text-zinc-300"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                        </button>
                    )}
                    <MenuItem
                        href="/customer/help"
                        title="Bantuan"
                        icon={
                            <HelpCircle className="h-5 w-5 text-text-subtle" />
                        }
                    />
                    <MenuItem
                        href="/customer/about"
                        title="Tentang Dombi"
                        icon={<Info className="h-5 w-5 text-text-subtle" />}
                    />
                </div>
            </section>

            {/* Logout */}
            {isLoggedIn && (
                <button
                    onClick={() => router.post('/logout')}
                    className="mt-6 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-bold text-red-700 transition-all duration-150 active:opacity-80"
                >
                    <LogOut className="h-4 w-4" />
                    Logout
                </button>
            )}

            {/* Version */}
            <p className="mt-4 mb-4 text-center text-xs text-text-subtle">
                Versi {appVersion ?? '1.0.0'}
            </p>

            {/* Login Dialog */}
            <LoginDialog
                open={loginDialogOpen}
                onClose={() => setLoginDialogOpen(false)}
            />
        </CustomerMobileLayout>
    );
}

function MenuItem({
    href,
    title,
    icon,
}: {
    href: string;
    title: string;
    icon: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            className="flex min-h-[52px] items-center gap-3.5 rounded-xl px-1 active:opacity-80"
        >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                {icon}
            </div>
            <span className="text-sm font-medium text-text">{title}</span>
            <svg
                className="ml-auto h-4 w-4 text-zinc-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                />
            </svg>
        </Link>
    );
}
