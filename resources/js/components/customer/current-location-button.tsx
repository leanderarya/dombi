import { useState } from 'react';

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
            <button
                type="button"
                onClick={handleClick}
                disabled={loading}
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-white text-xs font-semibold text-text active:bg-surface-muted disabled:opacity-60"
            >
                {loading ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-text-subtle border-t-transparent" />
                ) : (
                    <svg
                        className="h-4 w-4 text-emerald-600"
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
            </button>
            {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
        </div>
    );
}
