import { router, usePage } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';

export default function OwnerProfile() {
    const { auth, appVersion } = usePage<any>().props;
    const user = auth?.user;

    return (
        <OwnerPageShell title="Profile" subtitle="Owner account">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-base font-bold text-white">
                        {user?.name?.charAt(0)?.toUpperCase() ?? 'O'}
                    </div>
                    <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-slate-950">{user?.name ?? 'Owner'}</div>
                        <div className="truncate text-xs text-slate-500">{user?.email ?? '-'}</div>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                    <InfoBox label="Role" value="Owner" />
                    <InfoBox label="Status" value={user?.is_active ? 'Active' : 'Inactive'} />
                    <InfoBox label="Phone" value={user?.phone ?? '-'} />
                    <InfoBox label="Version" value={appVersion ?? '1.0.0'} />
                </div>

                <button onClick={() => router.post('/logout')} className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-sm font-bold text-red-700 transition-all duration-150 active:scale-[0.98] active:bg-red-100">
                    Logout
                </button>
            </div>
        </OwnerPageShell>
    );
}

function InfoBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
            <div className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</div>
        </div>
    );
}
