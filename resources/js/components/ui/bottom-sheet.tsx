import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    /** Max height as CSS value (default: 80vh) */
    maxHeight?: string;
}

export default function BottomSheet({ open, onClose, title, children, maxHeight = '80vh' }: Props) {
    const [translateY, setTranslateY] = useState(0);
    const touchStartRef = useRef<{ y: number; time: number } | null>(null);
    const sheetRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
            setTranslateY(0);
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartRef.current = {
            y: e.touches[0].clientY,
            time: Date.now(),
        };
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        const deltaY = e.touches[0].clientY - touchStartRef.current.y;
        // Only allow dragging down, not up
        if (deltaY > 0) {
            setTranslateY(deltaY);
        }
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (!touchStartRef.current) return;

        const velocity = translateY / (Date.now() - touchStartRef.current.time);
        const threshold = 100; // pixels
        const velocityThreshold = 0.5; // px/ms

        if (translateY > threshold || velocity > velocityThreshold) {
            onClose();
        }

        setTranslateY(0);
        touchStartRef.current = null;
    }, [translateY, onClose]);

    if (!open) return null;

    const isDragging = translateY > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
            <div
                ref={sheetRef}
                className="relative flex w-full max-w-lg flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)]"
                style={{
                    maxHeight,
                    transform: `translateY(${translateY}px)`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Drag Handle — touch target for swipe */}
                <div
                    className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="h-1 w-10 rounded-full bg-slate-200" />
                </div>

                {/* Header */}
                {title && (
                    <div className="flex items-center justify-between px-5 pb-3 shrink-0">
                        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-5 pb-4">
                    {children}
                </div>
            </div>
        </div>
    );
}
