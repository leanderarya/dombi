import { useEffect, useRef } from 'react';
import { router } from '@inertiajs/react';

const EXCLUDE_PATTERNS = [
    '/payment/',
    '/doku/',
    '/checkout/payment',
    '/oauth/',
];

function shouldExclude(url: string): boolean {
    return EXCLUDE_PATTERNS.some((p) => url.includes(p));
}

export function useNavigationHistory(rootUrl = '/customer/home') {
    const stack = useRef<string[]>([]);

    const push = (url: string) => {
        if (shouldExclude(url)) return;
        stack.current.push(url);
    };

    const pop = (): string | null => {
        if (stack.current.length <= 1) return null;
        stack.current.pop();
        return stack.current[stack.current.length - 1] ?? rootUrl;
    };

    const pruneToRoot = () => {
        const root = stack.current[0] ?? rootUrl;
        stack.current = [root];
    };

    const clear = () => {
        stack.current = [rootUrl];
    };

    const back = () => {
        const prev = pop();
        if (prev) {
            router.visit(prev);
        }
    };

    const currentUrl = () =>
        stack.current[stack.current.length - 1] ?? rootUrl;

    useEffect(() => {
        if (stack.current.length === 0) {
            stack.current.push(rootUrl);
        }

        const handler = () => {
            const url = window.location.pathname + window.location.search;
            push(url);
        };

        handler();
    }, [rootUrl]);

    return { back, push, pop, pruneToRoot, clear, currentUrl, stackSize: () => stack.current.length };
}
