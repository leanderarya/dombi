import { Head, router, usePage } from '@inertiajs/react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CourierLayout from '@/layouts/courier-layout';

export default function CourierProfile() {
    const { auth, appVersion } = usePage<any>().props;

    return (
        <CourierLayout title="Profil">
            <Head title="Profil" />

            {/* User Info */}
            <div className="mt-4 mb-6 rounded-xl bg-surface p-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <span className="text-lg font-bold">
                            {auth?.user?.name?.charAt(0) ?? 'K'}
                        </span>
                    </div>
                    <div>
                        <div className="text-base font-semibold text-text">
                            {auth?.user?.name ?? 'Kurir'}
                        </div>
                        <div className="text-sm text-text-subtle">Kurir</div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="mb-6 rounded-xl bg-surface">
                <Button
                    type="button"
                    onClick={() => router.post('/logout')}
                    variant="ghost"
                    className="w-full justify-start gap-3 px-4 py-3.5 text-danger hover:text-danger"
                >
                    <LogOut className="h-5 w-5" />
                    <span className="text-sm font-medium">Keluar</span>
                </Button>
            </div>

            {/* Version */}
            <div className="text-center text-[11px] text-text-subtle">
                Dombi v{appVersion ?? '1.0.0'}
            </div>
        </CourierLayout>
    );
}
