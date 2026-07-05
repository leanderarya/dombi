import { useEffect, useState } from 'react';

/**
 * Checks for new app version and shows reload prompt.
 * Polls /api/version every 5 minutes.
 */
export default function UpdateBanner() {
    const [updateAvailable, setUpdateAvailable] = useState(false);

    useEffect(() => {
        let buildHash: number | null = null;

        const checkVersion = async () => {
            try {
                const res = await fetch('/api/version');

                if (!res.ok) {
return;
}

                const data = await res.json();

                if (buildHash === null) {
                    buildHash = data.build;
                } else if (data.build && data.build !== buildHash) {
                    setUpdateAvailable(true);
                }
            } catch {
                // Network error - ignore
            }
        };

        // Check every 5 minutes
        const interval = setInterval(checkVersion, 5 * 60 * 1000);
        // Initial check after 30s
        const timeout = setTimeout(checkVersion, 30000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, []);

    if (!updateAvailable) {
return null;
}

    return (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-emerald-200 bg-emerald-50 px-4 py-3 text-center shadow-lg safe-bottom">
            <p className="text-sm font-medium text-emerald-800">Versi baru tersedia</p>
            <button
                onClick={() => window.location.reload()}
                className="mt-1 rounded-md bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white active:bg-emerald-800"
            >
                Refresh Sekarang
            </button>
        </div>
    );
}
