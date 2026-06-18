import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

interface DialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    maxWidth?: string;
}

export default function Dialog({ open, onClose, title, children, maxWidth = 'max-w-md' }: DialogProps) {
    useEffect(() => {
        if (!open) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleEscape);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/50" 
                onClick={onClose}
            />
            
            {/* Dialog */}
            <div className={`relative w-full ${maxWidth} rounded-2xl bg-white shadow-xl`}>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
                    <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                
                {/* Content */}
                <div className="px-5 py-4">
                    {children}
                </div>
            </div>
        </div>
    );
}
