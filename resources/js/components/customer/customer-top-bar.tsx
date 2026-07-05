import { Link, usePage } from '@inertiajs/react';
import { ChevronDown, LogIn, MapPin, User } from 'lucide-react';
import { useState } from 'react';
import LocationSheet from '@/components/customer/location-sheet';
import { useCustomerLocation } from '@/lib/customer-location';
import { useCart } from '@/lib/use-cart';

interface Props {
    addressOverride?: string | null;
    customerName?: string | null;
}

export default function CustomerTopBar({ addressOverride, customerName }: Props) {
    const { auth, guestMode } = usePage<any>().props;
    const { totalItems } = useCart();
    const { summary } = useCustomerLocation();
    const [sheetOpen, setSheetOpen] = useState(false);

    const isLoggedIn = !!auth?.user;
    const addressText = addressOverride ?? summary;

    return (
        <>
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur pt-safe">
            <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                    {isLoggedIn ? (
                        <div className="text-base font-bold text-text">
                            Halo, {customerName ?? auth.user.name} 👋
                        </div>
                    ) : (
                        <div className="text-base font-bold text-text">Dombi</div>
                    )}
                    <button type="button" onClick={() => setSheetOpen(true)} className="flex items-center gap-1 text-xs text-text-muted active:opacity-80">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{addressText || 'Tentukan Lokasi Anda'}</span>
                        <ChevronDown className="h-3 w-3 shrink-0" />
                    </button>
                </div>

                <div className="flex items-center gap-1">
                    {/* Login / Profile button */}
                    {isLoggedIn ? (
                        <Link href="/customer/profile" className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted active:bg-surface-muted">
                            {auth.user.avatar ? (
                                <img src={auth.user.avatar} alt="" className="h-7 w-7 rounded-full" />
                            ) : (
                                <User className="h-5 w-5" />
                            )}
                        </Link>
                    ) : guestMode ? (
                        <a href="/oauth/google" className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-primary active:bg-primary-light">
                            <LogIn className="h-4 w-4" />
                            Masuk
                        </a>
                    ) : null}

                    {/* Cart */}
                    <Link href="/customer/checkout" className="relative flex h-10 w-10 items-center justify-center rounded-lg text-text-muted active:bg-surface-muted">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                        </svg>
                        {totalItems > 0 && (
                            <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-white">
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
