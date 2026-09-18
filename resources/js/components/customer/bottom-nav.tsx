import { Link, usePage } from '@inertiajs/react';
import { Heart, House, ReceiptText, User } from 'lucide-react';

const navItems = [
    { href: '/customer/home', label: 'Beranda', icon: House },
    { href: '/customer/favorites', label: 'Favorit', icon: Heart },
    { href: '/customer/orders', label: 'Pesanan', icon: ReceiptText },
    { href: '/customer/profile', label: 'Akun', icon: User },
];

/**
 * The kanvas `Bottom Nav` (frames Orders 1–4) draws lucide icons at 20px over
 * a 10/500–700 label, a 64px bar with a 1px top stroke and no shadow. The old
 * nav used hand-rolled 20px SVGs that filled on the active tab — the kanvas
 * keeps one outline glyph and only swaps the colour.
 */
export default function CustomerBottomNav() {
    const { url } = usePage();

    return (
        <nav className="fixed inset-x-0 bottom-0 z-40 md:hidden">
            <div className="border-t border-border bg-surface pb-safe">
                <div className="mx-auto grid h-16 max-w-lg grid-cols-4">
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
                                className={`flex flex-col items-center justify-center gap-[3px] text-[10px] transition-transform active:scale-95 ${
                                    active
                                        ? 'font-bold text-primary'
                                        : 'font-medium text-text-subtle'
                                }`}
                            >
                                <Icon className="h-5 w-5" />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
