import { WifiOff } from 'lucide-react';
import { useOnline } from '@/lib/use-online';

export default function OfflineBanner() {
    const online = useOnline();

    if (online) {
        return null;
    }

    return (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white shadow-md">
            <WifiOff className="h-4 w-4" />
            <span>
                Kamu sedang offline — beberapa fitur mungkin tidak tersedia
            </span>
        </div>
    );
}
