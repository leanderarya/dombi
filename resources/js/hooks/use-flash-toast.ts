import { usePage } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface FlashPageProps {
    flash?: {
        success?: string;
        error?: string;
        warning?: string;
    };
    [key: string]: unknown;
}

/**
 * Listen to Inertia flash messages and show toast notifications.
 * Uses ref to prevent duplicate toasts on re-renders.
 */
export function useFlashToast() {
    const { flash } = usePage<FlashPageProps>().props;
    const lastSuccess = useRef<string | null>(null);
    const lastError = useRef<string | null>(null);
    const lastWarning = useRef<string | null>(null);

    useEffect(() => {
        const success = flash?.success;
        const error = flash?.error;
        const warning = flash?.warning;

        if (success && success !== lastSuccess.current) {
            lastSuccess.current = success;
            toast.success(success);
        }

        if (error && error !== lastError.current) {
            lastError.current = error;
            toast.error(error);
        }

        if (warning && warning !== lastWarning.current) {
            lastWarning.current = warning;
            toast.warning(warning);
        }
    }, [flash?.success, flash?.error, flash?.warning]);
}
