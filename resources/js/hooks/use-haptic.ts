export function useHaptic() {
    const vibrate = (pattern: number | number[]) => {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    };

    return {
        tap: () => vibrate(10),
        success: () => vibrate([10, 50, 10]),
        error: () => vibrate([50, 100, 50]),
    };
}
