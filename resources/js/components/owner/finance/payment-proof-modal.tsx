import { X, Download } from 'lucide-react';
import { createPortal } from 'react-dom';

interface Props {
    open: boolean;
    onClose: () => void;
    imageUrl: string;
}

export default function PaymentProofModal({ open, onClose, imageUrl }: Props) {
    if (!open) {
        return null;
    }

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
        >
            <div
                className="absolute inset-0 animate-[fadeIn_150ms_ease-out] bg-black/60"
                onClick={onClose}
            />
            <div className="relative z-10 mx-4 max-h-[80vh] max-w-lg animate-[slideUp_200ms_ease-out] rounded-lg bg-surface p-4 lg:animate-none lg:rounded-lg">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-text">
                        Bukti Transfer
                    </h3>
                    <div className="flex items-center gap-2">
                        <a
                            href={imageUrl}
                            download
                            className="flex h-8 w-8 items-center justify-center rounded-full text-text-subtle hover:bg-surface-muted hover:text-text-muted"
                        >
                            <Download className="h-4 w-4" />
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-text-subtle hover:bg-surface-muted hover:text-text-muted"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <img
                    src={imageUrl}
                    alt="Bukti transfer"
                    className="max-h-[65vh] rounded-lg object-contain"
                />
            </div>
        </div>,
        document.body,
    );
}
