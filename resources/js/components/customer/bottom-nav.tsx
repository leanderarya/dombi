import { Link, usePage } from '@inertiajs/react';

const navItems = [
    { href: '/customer/home', label: 'Beranda', icon: HomeIcon },
    { href: '/customer/favorites', label: 'Favorit', icon: HeartIcon },
    { href: '/customer/orders', label: 'Pesanan', icon: OrdersIcon },
    { href: '/customer/profile', label: 'Akun', icon: UserIcon },
];

export default function CustomerBottomNav() {
    const { url } = usePage();

    return (
        <nav className="fixed inset-x-0 bottom-0 z-40 md:hidden">
            <div className="bg-white/95 pb-safe shadow-[0_-1px_3px_rgba(0,0,0,0.06)] backdrop-blur">
                <div className="mx-auto grid h-14 max-w-lg grid-cols-4">
                    {navItems.map((item) => {
                        const active =
                            url === item.href ||
                            url.startsWith(`${item.href}/`) ||
                            (item.href === '/customer/home' &&
                                url === '/customer/home');
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                replace
                                className={`flex flex-col items-center justify-center gap-0.5 text-xs transition-transform active:scale-95 ${
                                    active
                                        ? 'font-bold text-primary'
                                        : 'font-medium text-zinc-400'
                                }`}
                            >
                                <div className="p-1.5">
                                    <Icon active={active} />
                                </div>
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}

function HomeIcon({ active }: { active: boolean }) {
    return (
        <svg
            className="h-5 w-5"
            fill={active ? 'currentColor' : 'none'}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={active ? 0 : 1.8}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 10.5v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-8M3.5 10.5 11.6 3.2a1 1 0 0 1 1.3 0l8.1 7.3"
            />
        </svg>
    );
}

function OrdersIcon({ active }: { active: boolean }) {
    return (
        <svg
            className="h-5 w-5"
            fill={active ? 'currentColor' : 'none'}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={active ? 0 : 1.8}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
        </svg>
    );
}

function HeartIcon({ active }: { active: boolean }) {
    return (
        <svg
            className="h-5 w-5"
            fill={active ? 'currentColor' : 'none'}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={active ? 0 : 1.8}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
        </svg>
    );
}

function UserIcon({ active }: { active: boolean }) {
    return (
        <svg
            className="h-5 w-5"
            fill={active ? 'currentColor' : 'none'}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={active ? 0 : 1.8}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
        </svg>
    );
}
