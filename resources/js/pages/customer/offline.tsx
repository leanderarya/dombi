import { router } from '@inertiajs/react';
import { WifiOff } from 'lucide-react';

export default function Offline() {
    const handleRetry = () => {
        router.visit('/customer/home');
    };

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f8f7f2] px-6 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                <WifiOff className="h-10 w-10 text-emerald-600" />
            </div>
            <h1 className="mb-2 text-xl font-semibold text-gray-900">
                Koneksi Terputus
            </h1>
            <p className="mb-8 text-sm text-gray-500">
                Periksa koneksi internet Anda dan coba lagi
            </p>
            <button
                onClick={handleRetry}
                className="rounded-xl bg-emerald-600 px-8 py-3 text-sm font-medium text-white active:scale-95 active:opacity-80 transition-all"
            >
                Coba Lagi
            </button>
        </div>
    );
}
