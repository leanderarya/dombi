import { Link } from '@inertiajs/react';

interface Props {
    orderId: number;
    showReorder?: boolean;
}

export default function StickyOrderActions({ orderId, showReorder = true }: Props) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white px-4 pb-safe pt-3">
            <div className="mx-auto max-w-lg space-y-2">
                {showReorder && (
                    <Link
                        href={`/customer/orders/${orderId}/restore-cart`}
                        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 text-sm font-bold text-white active:bg-emerald-800"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                        </svg>
                        Pesan Lagi
                    </Link>
                )}
                <Link
                    href={`/customer/orders`}
                    className="flex min-h-10 w-full items-center justify-center text-xs font-bold uppercase tracking-wide text-text-muted active:text-text"
                >
                    Kembali ke Riwayat
                </Link>
            </div>
        </div>
    );
}
