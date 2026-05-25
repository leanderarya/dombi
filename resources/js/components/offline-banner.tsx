import { useOnline } from '@/lib/use-online';

export default function OfflineBanner() {
    const online = useOnline();

    if (online) return null;

    return (
        <div className="fixed inset-x-0 top-0 z-50 bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white shadow-md">
            📡 Kamu sedang offline — beberapa fitur mungkin tidak tersedia
        </div>
    );
}
