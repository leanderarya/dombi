import { useEffect, useState } from 'react';

interface CountdownResult {
    minutes: number;
    seconds: number;
    expired: boolean;
    totalSeconds: number;
}

export function useCountdown(
    targetIso: string | null | undefined,
): CountdownResult {
    const [result, setResult] = useState<CountdownResult>({
        minutes: 0,
        seconds: 0,
        expired: true,
        totalSeconds: 0,
    });

    useEffect(() => {
        if (!targetIso) {
            setResult({
                minutes: 0,
                seconds: 0,
                expired: true,
                totalSeconds: 0,
            });

            return;
        }

        const target = new Date(targetIso).getTime();

        function tick() {
            const now = Date.now();
            const diff = Math.max(0, Math.floor((target - now) / 1000));

            if (diff <= 0) {
                setResult({
                    minutes: 0,
                    seconds: 0,
                    expired: true,
                    totalSeconds: 0,
                });

                return;
            }

            setResult({
                minutes: Math.floor(diff / 60),
                seconds: diff % 60,
                expired: false,
                totalSeconds: diff,
            });
        }

        tick();
        const id = setInterval(tick, 1000);

        return () => clearInterval(id);
    }, [targetIso]);

    return result;
}
