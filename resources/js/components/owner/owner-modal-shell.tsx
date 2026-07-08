import { X } from 'lucide-react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: ReactNode;
    /** Max width. Default: max-w-lg */
    maxWidth?: 'max-w-sm' | 'max-w-md' | 'max-w-lg' | 'max-w-xl';
}

export default function OwnerModalShell({ open, onClose, title, subtitle, children, maxWidth = 'max-w-lg' }: Props) {
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handler);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className={`relative w-full ${maxWidth} max-h-[80vh] overflow-y-auto rounded-xl bg-white shadow-xl`}>
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-5 py-3">
                    <div>
                        <h2 className="text-base font-bold text-text">{title}</h2>
                        {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-7 w-7 p-1.5 items-center justify-center rounded-lg border border-border text-slate-600 hover:bg-surface-muted"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                {/* Body */}
                <div className="px-5 py-4">
                    {children}
                </div>
            </div>
        </div>,
        document.body,
    );
}
