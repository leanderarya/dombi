import { Link, usePage } from '@inertiajs/react';
import { LogIn, User } from 'lucide-react';
import { useState } from 'react';
import LocationSheet from '@/components/customer/location-sheet';
import { useCustomerLocation } from '@/lib/customer-location';
import { useCart } from '@/lib/use-cart';

interface Props {
    addressOverride?: string | null;
}

export default function CustomerTopBar({ addressOverride }: Props) {
    const { auth, guestMode } = usePage<any>().props;
    const { totalItems } = useCart();
    const { summary } = useCustomerLocation();
    const [sheetOpen, setSheetOpen] = useState(false);

    const isLoggedIn = !!auth?.user;
    const addressText = addressOverride ?? summary;

    return (
        <>
        <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
                <button type="button" onClick={() => setSheetOpen(true)} className="min-w-0 flex-1 text-left active:opacity-80">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Kirim ke</div>
                    <div className="mt-0.5 flex items-center gap-1">
                        <span className="truncate text-sm font-semibold text-slate-900">
                            {addressText || 'Tentukan Lokasi Anda'}
                        </span>
                        <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </button>

                <div className="flex items-center gap-1">
                    {/* Login / Profile button */}
                    {isLoggedIn ? (
                        <Link href="/customer/profile" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-zinc-100">
                            {auth.user.avatar ? (
                                <img src={auth.user.avatar} alt="" className="h-7 w-7 rounded-full" />
                            ) : (
                                <User className="h-5 w-5" />
                            )}
                        </Link>
                    ) : guestMode ? (
                        <a href="/auth/google" className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-emerald-700 active:bg-emerald-50">
                            <LogIn className="h-4 w-4" />
                            Masuk
                        </a>
                    ) : null}

                    {/* Cart */}
                    <Link href="/customer/checkout" className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-zinc-100">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                        </svg>
                        {totalItems > 0 && (
                            <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                                {totalItems > 9 ? '9+' : totalItems}
                            </span>
                        )}
                    </Link>
                </div>
            </div>
        </header>
        <LocationSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
        </>
    );
}
