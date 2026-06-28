import { Head, router, usePage } from '@inertiajs/react';
import { LogOut } from 'lucide-react';
import CourierLayout from '@/layouts/courier-layout';

export default function CourierProfile() {
    const { auth, appVersion } = usePage<any>().props;

    return (
        <CourierLayout title="Profil">
            <Head title="Profil" />

            {/* User Info */}
            <div className="mt-4 mb-6 rounded-xl bg-white p-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <span className="text-lg font-bold">{auth?.user?.name?.charAt(0) ?? 'K'}</span>
                    </div>
                    <div>
                        <div className="text-base font-semibold text-text">{auth?.user?.name ?? 'Kurir'}</div>
                        <div className="text-sm text-text-subtle">Kurir</div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="mb-6 rounded-xl bg-white">
                <button
                    type="button"
                    onClick={() => router.post('/logout')}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-red-600 active:opacity-80"
                >
                    <LogOut className="h-5 w-5" />
                    <span className="text-sm font-medium">Keluar</span>
                </button>
            </div>

            {/* Version */}
            <div className="text-center text-[11px] text-text-subtle">
                Dombi v{appVersion ?? '1.0.0'}
            </div>
        </CourierLayout>
    );
}
