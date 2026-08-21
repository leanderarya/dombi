import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface ImageCropModalProps {
    open: boolean;
    onClose: () => void;
    imageSrc: string;
    onCropComplete: (blob: Blob) => void;
}

export default function ImageCropModal({
    open,
    onClose,
    imageSrc,
    onCropComplete,
}: ImageCropModalProps) {
    const [processing, setProcessing] = useState(false);

    const handleUse = async () => {
        try {
            setProcessing(true);
            // Simplified crop: convert src to Blob (1:1 crop handled server side or preview is already 1:1)
            // If imageSrc is an object URL / data URL, fetch it to Blob
            const response = await fetch(imageSrc);
            const blob = await response.blob();
            onCropComplete(blob);
            onClose();
        } catch {
            // Fallback: try to create blob from data URL or just close
            try {
                const res = await fetch(imageSrc);
                const blob = await res.blob();
                onCropComplete(blob);
            } catch {
                // If conversion fails, still close – caller can handle original file
            }

            onClose();
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Crop 1:1</DialogTitle>
                </DialogHeader>

                <div className="flex justify-center rounded-lg bg-surface-muted p-2">
                    <img
                        src={imageSrc}
                        alt="Crop preview"
                        className="max-h-96 rounded object-contain"
                    />
                </div>

                <p className="mt-2 text-[11px] text-text-subtle">
                    Preview 1:1 – gambar akan dipotong persegi di server (max
                    800x800 WebP).
                </p>

                <div className="mt-4 flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={processing}
                    >
                        Batal
                    </Button>
                    <Button onClick={handleUse} disabled={processing}>
                        {processing ? 'Memproses...' : 'Gunakan'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
