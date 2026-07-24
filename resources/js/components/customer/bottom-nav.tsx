import { Link, usePage } from '@inertiajs/react';

const navItems = [
    { href: '/customer/home', label: 'Beranda', icon: HomeIcon },
    { href: '/customer/orders', label: 'Pesanan', icon: OrdersIcon },
    { href: '/customer/profile', label: 'Akun', icon: UserIcon },
];

interface Props {
    visible?: boolean;
}

export default function CustomerBottomNav({ visible = true }: Props) {
    const { url } = usePage();

    return (
        <nav
            className="fixed inset-x-0 z-40"
            style={{
                bottom: visible ? 0 : -100,
                transition: 'bottom 200ms ease',
            }}
        >
            <div className="bg-white/95 pb-safe shadow-[0_-1px_3px_rgba(0,0,0,0.06)] backdrop-blur">
            <div className="mx-auto grid h-14 max-w-lg grid-cols-3">
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
                            className={`flex flex-col items-center justify-center gap-0.5 text-xs active:scale-95 transition-transform ${
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
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
        </svg>
    );
}

function GridIcon({ active }: { active: boolean }) {
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
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
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
