import { Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
    orderCode: string;
}

/**
 * Canvas 2D contexts cannot resolve `var(--token)`, so the exported PNG reads
 * the token at save time. Fallback mirrors `--color-info`. The on-screen QR
 * uses `currentColor` and inherits from the `text-info` wrapper instead.
 */
const QR_FALLBACK = '#2563eb';

function readToken(name: string, fallback: string): string {
    if (typeof window === 'undefined') {
        return fallback;
    }

    return (
        getComputedStyle(document.documentElement)
            .getPropertyValue(name)
            .trim() || fallback
    );
}

export default function OrderQRCard({ orderCode }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);

    const handleSave = useCallback(() => {
        const svg = containerRef.current?.querySelector('svg');

        if (!svg) {
            return;
        }

        const canvas = document.createElement('canvas');
        const size = 640; // 4x for high quality
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');

        if (!ctx) {
            return;
        }

        // White background — the QR quiet zone must stay pure white to scan.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        // Serialize SVG
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], {
            type: 'image/svg+xml;charset=utf-8',
        });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
            // Center QR code
            const padding = 80;
            ctx.drawImage(
                img,
                padding,
                padding,
                size - padding * 2,
                size - padding * 2,
            );

            // Add order code text below
            ctx.fillStyle = readToken('--color-info', QR_FALLBACK);
            ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(orderCode, size / 2, size - 30);

            URL.revokeObjectURL(url);

            // Trigger download
            canvas.toBlob((blob) => {
                if (!blob) {
                    return;
                }

                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `dombi-${orderCode}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            }, 'image/png');
        };
        img.src = url;
    }, [orderCode]);

    return (
        <div className="mt-4 flex flex-col items-center rounded-card border border-border bg-surface p-4">
            <div ref={containerRef} className="text-info">
                <QRCodeSVG
                    value={orderCode}
                    size={160}
                    bgColor="#ffffff"
                    fgColor="currentColor"
                    level="M"
                    marginSize={0}
                />
            </div>
            <div className="mt-2 text-center">
                <div className="text-sm font-bold tracking-wider text-primary">
                    {orderCode}
                </div>
                <div className="mt-1 text-caption text-text-subtle">
                    Tunjukkan QR ini ke kasir
                </div>
            </div>
            <Button
                type="button"
                variant="secondary"
                onClick={handleSave}
                className="mt-3 h-10 text-xs hover:bg-surface-muted active:opacity-80 [&_svg]:size-3.5"
            >
                <Download className="h-3.5 w-3.5" />
                Simpan QR
            </Button>
        </div>
    );
}
