import { Head } from '@inertiajs/react';
import { useState } from 'react';

export default function Welcome() {
    const [loading, setLoading] = useState(false);

    const handleGuestMode = () => {
        setLoading(true);
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/guest-mode';

        const csrf = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;

        if (csrf) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = '_token';
            input.value = csrf.content;
            form.appendChild(input);
        }

        document.body.appendChild(form);
        form.submit();
    };

    if (loading) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-white">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-emerald-600" />
                    <p className="mt-4 text-sm font-medium text-text-muted">Menyiapkan Dombi...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-dvh flex-col bg-white">
            <Head title="Selamat Datang di Dombi" />

            {/* SECTION 1 — HERO IMAGE */}
            <div className="relative flex-[0_0_50vh] w-full overflow-hidden rounded-b-[2rem]">
                {/* Replace this gradient with an <img> when hero asset is available */}
                <div
                    className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-emerald-400 to-emerald-600"
                    style={{
                        backgroundImage: `
                            linear-gradient(135deg, #059669 0%, #34d399 50%, #059669 100%)
                        `,
                    }}
                />
                {/* Decorative elements */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white" />
                    <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white" />
                    <div className="absolute bottom-20 right-10 h-40 w-40 rounded-full bg-white" />
                </div>
                {/* Logo center */}
                <div className="relative flex h-full flex-col items-center justify-center px-8">
                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 backdrop-blur-sm">
                        <span className="text-4xl font-bold text-white">D</span>
                    </div>
                    <div className="mt-4 text-sm font-semibold tracking-widest text-white/80 uppercase">Dombi</div>
                </div>
            </div>

            {/* SECTION 2 — CAROUSEL INDICATOR */}
            <div className="flex justify-center gap-2 pt-5">
                <div className="h-2 w-2 rounded-full bg-emerald-600" />
                <div className="h-2 w-2 rounded-full bg-border" />
                <div className="h-2 w-2 rounded-full bg-border" />
            </div>

            {/* SECTION 3 — HEADLINE */}
            <div className="px-8 pt-4">
                <h1 className="text-center text-[1.75rem] font-bold leading-tight tracking-tight text-text">
                    Pengalaman Terbaik
                    <br />
                    Menikmati Susu Kambing
                </h1>
            </div>

            {/* SECTION 4 — SUBTITLE */}
            <div className="px-8 pt-3">
                <p className="text-center text-sm leading-relaxed text-text-muted">
                    Nikmati susu kambing segar dan produk olahan berkualitas langsung dari Dombi.
                </p>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* SECTION 5 & 6 — CTAs */}
            <div className="px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4">
                <div className="mx-auto max-w-sm space-y-3">
                    {/* Primary: Google Login */}
                    <a
                        href="/oauth/google"
                        className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-200/50 transition-all active:opacity-80 active:bg-emerald-700"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Masuk dengan Google
                    </a>

                    {/* Secondary: Guest */}
                    <button
                        type="button"
                        onClick={handleGuestMode}
                        className="flex h-12 w-full items-center justify-center text-sm font-semibold text-text-muted underline active:text-text"
                    >
                        Lewati Tahap Ini
                    </button>
                </div>
            </div>
        </div>
    );
}
