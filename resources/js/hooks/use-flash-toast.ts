import { usePage } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

/**
 * Listen to Inertia flash messages and show toast notifications.
 * Uses ref to prevent duplicate toasts on re-renders.
 */
export function useFlashToast() {
    const { flash } = usePage().props;
    const lastSuccess = useRef<string | null>(null);
    const lastError = useRef<string | null>(null);
    const lastWarning = useRef<string | null>(null);

    useEffect(() => {
        const success = flash?.success as string | undefined;
        const error = flash?.error as string | undefined;
        const warning = flash?.warning as string | undefined;

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
