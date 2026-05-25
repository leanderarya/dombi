import { Link } from '@inertiajs/react';

export default function CheckoutHeader() {
    return (
        <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white">
            <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                <Link href="/customer/home" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 active:bg-zinc-100">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <h1 className="text-base font-semibold text-slate-900">Checkout</h1>
                <div className="flex h-10 w-10 items-center justify-center">
                    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                </div>
            </div>
        </header>
    );
}
