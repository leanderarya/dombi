import { Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useRef } from 'react';

interface Props {
    orderCode: string;
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

        // White background
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
            ctx.fillStyle = '#1e40af';
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
        <div className="mt-4 flex flex-col items-center rounded-xl border border-border bg-white p-4">
            <div ref={containerRef}>
                <QRCodeSVG
                    value={orderCode}
                    size={160}
                    bgColor="#ffffff"
                    fgColor="#1e40af"
                    level="M"
                    marginSize={0}
                />
            </div>
            <div className="mt-2 text-center">
                <div className="text-sm font-bold tracking-wider text-primary">
                    {orderCode}
                </div>
                <div className="mt-1 text-[11px] text-text-subtle">
                    Tunjukkan QR ini ke kasir
                </div>
            </div>
            <button
                type="button"
                onClick={handleSave}
                className="mt-3 flex h-10 items-center gap-2 rounded-lg bg-surface-muted px-4 text-xs font-semibold text-text active:opacity-80"
            >
                <Download className="h-3.5 w-3.5" />
                Simpan QR
            </button>
        </div>
    );
}
