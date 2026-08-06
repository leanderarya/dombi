import { Link, usePage } from '@inertiajs/react';
import { ClipboardList, History, User } from 'lucide-react';

const navItems = [
    {
        href: '/courier/dashboard',
        label: 'Tugas',
        icon: ClipboardList,
        match: ['/courier/dashboard'],
    },
    {
        href: '/courier/deliveries',
        label: 'Riwayat',
        icon: History,
        match: ['/courier/deliveries'],
    },
    {
        href: '/courier/profile',
        label: 'Profil',
        icon: User,
        match: ['/courier/profile'],
    },
];

interface Props {
    visible?: boolean;
}

export default function CourierBottomNav({ visible = true }: Props) {
    const { url } = usePage();

    return (
        <nav
            className="fixed inset-x-0 z-40 border-t border-zinc-100 bg-white pb-safe"
            style={{
                bottom: visible ? 0 : -100,
                transition: 'bottom 200ms ease',
            }}
        >
            <div className="mx-auto grid h-14 max-w-lg grid-cols-3">
                {navItems.map((item) => {
                    const active = item.match.some(
                        (href) => url === href || url.startsWith(`${href}/`),
                    );
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
                                active ? 'text-primary' : 'text-text-subtle'
                            }`}
                        >
                            {active && (
                                <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
                            )}
                            <Icon
                                className="h-5 w-5"
                                strokeWidth={active ? 2 : 1.5}
                            />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
