import { useCallback, useState } from 'react';

type ModalKey = string | null;

/**
 * Replace multiple boolean modal states with a single state.
 *
 * Before: const [showApprove, setShowApprove] = useState(false);
 *         const [showReject, setShowReject] = useState(false);
 * After:  const { current, open, close } = useModalState<'approve' | 'reject'>();
 */
export function useModalState<T extends string>() {
    const [current, setCurrent] = useState<T | null>(null);

    const open = useCallback((key: T) => setCurrent(key), []);
    const close = useCallback(() => setCurrent(null), []);
    const isOpen = useCallback((key: T) => current === key, [current]);

    return { current, open, close, isOpen } as const;
}
