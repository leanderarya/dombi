import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
    onLocation: (lat: number, lng: number) => void;
}

export default function CurrentLocationButton({ onLocation }: Props) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function handleClick() {
        if (!navigator.geolocation) {
            setError('Geolocation tidak didukung browser ini.');

            return;
        }

        setLoading(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLoading(false);
                onLocation(position.coords.latitude, position.coords.longitude);
            },
            (err) => {
                setLoading(false);

                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        setError(
                            'Izin lokasi ditolak. Aktifkan di pengaturan browser.',
                        );
                        break;
                    case err.POSITION_UNAVAILABLE:
                        setError('Lokasi tidak tersedia. Coba lagi.');
                        break;
                    case err.TIMEOUT:
                        setError('Timeout. Pastikan GPS aktif.');
                        break;
                    default:
                        setError('Gagal mendapatkan lokasi.');
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
        );
    }

    return (
        <div>
            <Button
                type="button"
                variant="outline"
                onClick={handleClick}
                disabled={loading}
                className="min-h-10 w-full gap-2 rounded-chip text-xs font-semibold active:bg-surface-muted disabled:opacity-60"
            >
                {loading ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-text-subtle border-t-transparent" />
                ) : (
                    <svg
                        className="h-4 w-4 text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                    </svg>
                )}
                Gunakan Lokasi Saya
            </Button>
            {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
        </div>
    );
}
