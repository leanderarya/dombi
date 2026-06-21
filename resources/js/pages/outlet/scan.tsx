import { Head, router } from '@inertiajs/react';
import { Camera, Keyboard, Loader2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import OutletLayout from '@/layouts/outlet-layout';

type ScanResult = {
    found: boolean;
    order?: {
        id: number;
        order_code: string;
        status: string;
        customer_name: string;
        total: number;
        items: { product_name: string; quantity: number }[];
    };
    error?: string;
};

export default function OutletScanPage() {
    const [scanning, setScanning] = useState(false);
    const [manualCode, setManualCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scannerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hasScannedRef = useRef(false);

    const stopScanner = useCallback(async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
                scannerRef.current = null;
            } catch {
                // Scanner may already be stopped
            }
        }

        setScanning(false);
    }, []);

    const lookupOrder = useCallback(async (orderCode: string) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/outlet/scan/${encodeURIComponent(orderCode)}`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            const data: ScanResult = await response.json();

            if (data.found && data.order) {
                router.visit(`/outlet/orders/${data.order.id}`);
            } else {
                setError(data.error ?? 'Pesanan tidak ditemukan.');
                hasScannedRef.current = false;
            }
        } catch {
            setError('Gagal memeriksa pesanan. Periksa koneksi Anda.');
            hasScannedRef.current = false;
        } finally {
            setLoading(false);
        }
    }, []);

    const handleScanResult = useCallback(
        async (decodedText: string) => {
            if (hasScannedRef.current) {
                return;
            }

            hasScannedRef.current = true;

            await stopScanner();

            let orderCode = decodedText;

            // Accept both plain code and URL (backward-compatible)
            try {
                const url = new URL(decodedText);
                const pathParts = url.pathname.split('/');
                const scanIndex = pathParts.indexOf('scan');

                if (scanIndex !== -1 && pathParts[scanIndex + 1]) {
                    orderCode = pathParts[scanIndex + 1];
                }
            } catch {
                // Not a URL, use as-is (plain order code)
            }

            lookupOrder(orderCode);
        },
        [stopScanner, lookupOrder],
    );

    const startScanner = useCallback(async () => {
        if (!containerRef.current) {
            return;
        }

        hasScannedRef.current = false;
        setScanning(true);
        setError(null);

        try {
            const { Html5Qrcode } = await import('html5-qrcode');

            const scanner = new Html5Qrcode('qr-reader');
            scannerRef.current = scanner;

            await scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                },
                (decodedText) => {
                    handleScanResult(decodedText);
                },
                () => {},
            );
        } catch {
            setError('Gagal mengakses kamera. Pastikan izin kamera sudah diberikan.');
            setScanning(false);
        }
    }, [handleScanResult]);

    useEffect(() => {
        return () => {
            stopScanner();
        };
    }, [stopScanner]);

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (manualCode.trim()) {
            hasScannedRef.current = true;
            lookupOrder(manualCode.trim());
        }
    };

    return (
        <OutletLayout title="Scan QR Code" backHref="/outlet/dashboard" hideNav>
            <Head title="Scan QR Code" />

            <div className="mx-auto max-w-lg">
                {/* Scanner Area */}
                <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-black">
                    <div
                        ref={containerRef}
                        id="qr-reader"
                        className="relative aspect-square w-full"
                    >
                        {!scanning && !loading && (
                            <div className="flex h-full flex-col items-center justify-center gap-4 bg-zinc-900 p-6 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                                    <Camera className="h-8 w-8 text-white" />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-white">Arahkan kamera ke QR code</div>
                                    <div className="mt-1 text-xs text-zinc-400">QR code akan ter-scan otomatis</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={startScanner}
                                    aria-label="Mulai scan QR code"
                                    className="flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white active:bg-primary-hover"
                                >
                                    <Camera className="h-4 w-4" />
                                    Mulai Scan
                                </button>
                            </div>
                        )}

                        {loading && (
                            <div className="flex h-full flex-col items-center justify-center gap-3 bg-zinc-900">
                                <Loader2 className="h-8 w-8 animate-spin text-white" />
                                <div className="text-sm text-white">Memeriksa pesanan...</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stop Scanner Button */}
                {scanning && (
                    <button
                        type="button"
                        onClick={stopScanner}
                        aria-label="Berhenti scan"
                        className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-text active:bg-surface-muted"
                    >
                        <XCircle className="h-4 w-4" />
                        Berhenti Scan
                    </button>
                )}

                {/* Error */}
                {error && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <div className="text-sm font-semibold text-red-800">{error}</div>
                        </div>
                    </div>
                )}

                {/* Divider */}
                <div className="my-6 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-semibold text-text-subtle">ATAU</span>
                    <div className="h-px flex-1 bg-border" />
                </div>

                {/* Manual Input */}
                <div className="rounded-2xl border border-border bg-white p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Keyboard className="h-4 w-4 text-text-muted" />
                        <span className="text-sm font-semibold text-text">Input Kode Manual</span>
                    </div>
                    <form onSubmit={handleManualSubmit} className="flex gap-2">
                        <input
                            type="text"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                            placeholder="Masukkan kode pesanan"
                            aria-label="Kode pesanan"
                            className="flex-1 min-h-[44px] rounded-xl border border-border px-4 text-sm font-semibold uppercase tracking-wider text-text placeholder:normal-case placeholder:tracking-normal placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                        <button
                            type="submit"
                            disabled={!manualCode.trim() || loading}
                            aria-label="Cari pesanan"
                            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white active:bg-primary-hover disabled:bg-surface-muted disabled:text-text-subtle"
                        >
                            Cari
                        </button>
                    </form>
                </div>

                {/* Instructions */}
                <div className="mt-6 rounded-xl border border-border bg-surface-muted p-4">
                    <div className="text-xs font-semibold text-text-subtle mb-2">Cara Menggunakan:</div>
                    <ol className="space-y-1.5 text-xs text-text-muted">
                        <li className="flex items-start gap-2">
                            <span className="font-semibold text-text">1.</span>
                            <span>Minta customer menunjukkan QR code di halaman tracking pesanan</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-semibold text-text">2.</span>
                            <span>Arahkan kamera ke QR code</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-semibold text-text">3.</span>
                            <span>Anda akan diarahkan ke halaman pesanan untuk konfirmasi</span>
                        </li>
                    </ol>
                </div>
            </div>
        </OutletLayout>
    );
}
