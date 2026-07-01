import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
    open: boolean;
    onClose: () => void;
    /** Slide from left or right (default: 'left') */
    side?: 'left' | 'right';
    /** Width as CSS value (default: '80%') */
    width?: string;
    children: ReactNode;
}

export default function SideSheet({ open, onClose, side = 'left', width = '80%', children }: Props) {
    const touchStartRef = useRef<{ x: number; time: number } | null>(null);
    const [translateX, setTranslateX] = useState(0);

    // Scroll lock
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
            setTranslateX(0);
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    // Escape key
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    // Swipe to close
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartRef.current = {
            x: e.touches[0].clientX,
            time: Date.now(),
        };
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        const deltaX = e.touches[0].clientX - touchStartRef.current.x;
        // Only allow dragging in close direction
        if (side === 'left' && deltaX < 0) {
            setTranslateX(deltaX);
        } else if (side === 'right' && deltaX > 0) {
            setTranslateX(deltaX);
        }
    }, [side]);

    const handleTouchEnd = useCallback(() => {
        if (!touchStartRef.current) return;
        const velocity = Math.abs(translateX) / (Date.now() - touchStartRef.current.time);
        const threshold = 80;
        const velocityThreshold = 0.5;

        if (Math.abs(translateX) > threshold || velocity > velocityThreshold) {
            onClose();
        }

        setTranslateX(0);
        touchStartRef.current = null;
    }, [translateX, onClose]);

    if (!open) return null;

    const isDragging = translateX !== 0;
    const maxWidth = '320px';

    return createPortal(
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-slate-950/50"
                onClick={onClose}
                style={{ opacity: isDragging ? Math.max(0, 1 - Math.abs(translateX) / 300) : 1 }}
            />

            {/* Sheet */}
            <div
                className={`absolute top-0 bottom-0 ${side === 'left' ? 'left-0' : 'right-0'} flex flex-col bg-white shadow-xl`}
                style={{
                    width,
                    maxWidth,
                    transform: `translateX(${translateX}px)`,
                    transition: isDragging ? 'none' : 'transform 0.2s ease',
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}
