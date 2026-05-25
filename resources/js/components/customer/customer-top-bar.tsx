import { Link, router, usePage } from '@inertiajs/react';
import { useCart } from '@/lib/use-cart';

interface Props {
    /** Override address text (optional — falls back to shared defaultAddress) */
    addressOverride?: string | null;
}

export default function CustomerTopBar({ addressOverride }: Props) {
    const { auth } = usePage<any>().props;
    const { totalItems } = useCart();

    // Derive address display from shared Inertia data
    const defaultAddress = auth?.defaultAddress;
    const addressText = addressOverride
        ?? (defaultAddress ? `${defaultAddress.label || defaultAddress.recipient_name} · ${defaultAddress.kecamatan ?? ''}` : null);

    return (
        <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
                <Link href="/customer/addresses" className="min-w-0 flex-1 active:opacity-80">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Kirim ke</div>
                    <div className="mt-0.5 flex items-center gap-1">
                        <span className="truncate text-sm font-semibold text-slate-900">
                            {addressText || 'Tambah alamat'}
                        </span>
                        <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </Link>
                <div className="flex items-center gap-2">
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
                    <button onClick={() => router.post('/logout')} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 active:bg-zinc-100">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </div>
        </header>
    );
}
