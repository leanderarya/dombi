import { Head, Link } from '@inertiajs/react';
import { ChevronLeft, Truck, Shield } from 'lucide-react';
import { GoogleIcon } from '@/components/ui/google-icon';

export default function LoginPrompt() {
    return (
        <div className="min-h-dvh bg-surface text-text">
            <Head title="Login Diperlukan" />

            <header className="sticky top-0 z-30 border-b border-border bg-surface/95 pt-safe backdrop-blur">
                <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
                    <Link
                        href="/customer/checkout"
                        className="flex h-11 w-11 items-center justify-center rounded-chip text-text active:opacity-80"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <div className="text-sm font-semibold text-text">
                            Login Diperlukan
                        </div>
                        <div className="text-[11px] text-text-muted">
                            Untuk pengiriman ke alamat
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-lg px-4 py-8">
                <div className="flex flex-col items-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-card bg-primary-light">
                        <Truck className="h-8 w-8 text-primary" />
                    </div>

                    <h1 className="mt-6 text-lg font-bold text-text">
                        Login untuk Pengiriman
                    </h1>
                    <p className="mt-2 max-w-sm text-sm text-text-muted">
                        Untuk mengirim ke alamat Anda, silakan login terlebih
                        dahulu.
                    </p>

                    <Link
                        href="/oauth/google?redirect=/customer/checkout/customer"
                        className="mt-8 flex min-h-11 w-full max-w-sm items-center justify-center gap-3 rounded-thumb border border-border bg-surface px-6 text-sm font-semibold text-text active:opacity-80"
                    >
                        <GoogleIcon className="h-5 w-5" />
                        Login dengan Google
                    </Link>

                    <div className="mt-8 w-full max-w-sm rounded-thumb border border-border bg-surface p-4 text-left">
                        <div className="flex items-start gap-3">
                            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                            <div>
                                <div className="text-sm font-semibold text-text">
                                    Keamanan Terjamin
                                </div>
                                <div className="mt-1 text-xs leading-relaxed text-text-muted">
                                    Data alamat dan nomor HP Anda dilindungi.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 text-sm text-text-muted">
                        Ingin{' '}
                        <Link
                            href="/customer/checkout"
                            className="font-semibold text-primary"
                        >
                            Ambil di Outlet
                        </Link>
                        ? Tidak perlu login.
                    </div>
                </div>
            </main>
        </div>
    );
}
