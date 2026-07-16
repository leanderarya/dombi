import { Head, Link } from '@inertiajs/react';

export default function InviteExpired() {
    return (
        <div className="flex min-h-dvh items-center justify-center bg-[#F8FAFC] p-4">
            <Head title="Undangan Kadaluarsa" />
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                    <svg
                        className="h-6 w-6 text-amber-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                    </svg>
                </div>
                <h1 className="mt-4 text-xl font-semibold text-slate-900">
                    Undangan Kadaluarsa
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                    Tautan undangan ini sudah tidak berlaku. Hubungi owner untuk
                    mengirim undangan baru.
                </p>
                <Link
                    href="/login"
                    className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-500 px-6 text-sm font-semibold text-white transition-colors active:bg-emerald-600"
                >
                    Ke Halaman Login
                </Link>
            </div>
        </div>
    );
}
