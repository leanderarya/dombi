import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GoogleIcon } from '@/components/ui/google-icon';
import { useGoogleLogin } from '@/hooks/use-google-login';

export default function Welcome() {
    const [loading, setLoading] = useState(false);
    const { login } = useGoogleLogin();

    const handleGoogleLogin = async () => {
        await login();
    };

    const handleGuestMode = () => {
        setLoading(true);
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/guest-mode';

        const csrf = document.querySelector(
            'meta[name="csrf-token"]',
        ) as HTMLMetaElement;

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
            <div className="flex min-h-dvh items-center justify-center bg-surface">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 animate-pulse rounded-card bg-primary" />
                    <p className="mt-4 text-sm font-medium text-text-muted">
                        Menyiapkan Dombi...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-dvh flex-col bg-surface">
            <Head title="Selamat Datang di Dombi" />

            {/* SECTION 1 — HERO IMAGE */}
            <div className="relative w-full flex-[0_0_50vh] overflow-hidden rounded-b-[2rem]">
                {/* Replace this gradient with an <img> when hero asset is available */}
                <div
                    className="absolute inset-0 bg-gradient-to-br from-primary via-brand-bright to-primary"
                    style={{
                        backgroundImage: `
                            linear-gradient(135deg, var(--color-primary) 0%, var(--color-brand-bright) 50%, var(--color-primary) 100%)
                        `,
                    }}
                />
                {/* Decorative elements */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-surface" />
                    <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-surface" />
                    <div className="absolute right-10 bottom-20 h-40 w-40 rounded-full bg-surface" />
                </div>
                {/* Logo center */}
                <div className="relative flex h-full flex-col items-center justify-center px-8">
                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-surface/20 backdrop-blur-sm">
                        <span className="text-4xl font-bold text-white">D</span>
                    </div>
                    <div className="mt-4 text-sm font-semibold tracking-widest text-white/80 uppercase">
                        Dombi
                    </div>
                </div>
            </div>

            {/* SECTION 2 — CAROUSEL INDICATOR */}
            <div className="flex justify-center gap-2 pt-5">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <div className="h-2 w-2 rounded-full bg-border" />
                <div className="h-2 w-2 rounded-full bg-border" />
            </div>

            {/* SECTION 3 — HEADLINE */}
            <div className="px-8 pt-4">
                <h1 className="text-center text-[1.75rem] leading-tight font-bold tracking-tight text-text">
                    Pengalaman Terbaik
                    <br />
                    Belanja Kebutuhan Harian
                </h1>
            </div>

            {/* SECTION 4 — SUBTITLE */}
            <div className="px-8 pt-3">
                <p className="text-center text-sm leading-relaxed text-text-muted">
                    Nikmati belanja kebutuhan harian berkualitas langsung dari
                    Dombi.
                </p>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* SECTION 5 & 6 — CTAs */}
            <div className="px-6 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom,0))]">
                <div className="mx-auto max-w-sm space-y-3">
                    {/* Primary: Google Login */}
                    <Button
                        type="button"
                        variant="primary"
                        onClick={handleGoogleLogin}
                        className="h-14 w-full gap-3 rounded-full font-bold shadow-lg shadow-primary/20 transition-all active:bg-primary-hover active:opacity-80"
                    >
                        <GoogleIcon className="h-5 w-5" />
                        Masuk dengan Google
                    </Button>

                    {/* Secondary: Guest */}
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleGuestMode}
                        className="h-12 w-full font-semibold text-text-muted underline hover:bg-transparent hover:text-text active:text-text"
                    >
                        Lewati Tahap Ini
                    </Button>
                </div>
            </div>
        </div>
    );
}
