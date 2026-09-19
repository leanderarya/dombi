import { router } from '@inertiajs/react';
import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Offline() {
    const handleRetry = () => {
        router.visit('/customer/home');
    };

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-light">
                <WifiOff className="h-10 w-10 text-primary" />
            </div>
            <h1 className="mb-2 text-xl font-semibold text-text">
                Koneksi Terputus
            </h1>
            <p className="mb-8 text-sm text-text-muted">
                Periksa koneksi internet Anda dan coba lagi
            </p>
            <Button
                type="button"
                variant="primary"
                onClick={handleRetry}
                className="px-8 py-3 text-sm font-medium transition-all active:scale-95 active:opacity-80"
            >
                Coba Lagi
            </Button>
        </div>
    );
}
