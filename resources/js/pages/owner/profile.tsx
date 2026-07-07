import { router, usePage } from '@inertiajs/react';
import { LogOut, User, Shield, Phone, Package } from 'lucide-react';
import OwnerPageShell from '@/components/owner/owner-page-shell';

export default function OwnerProfile() {
    const { auth, appVersion } = usePage<any>().props;
    const user = auth?.user;

    return (
        <OwnerPageShell title="Profile" subtitle="Owner account">
            <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
                {/* Left: user info */}
                <div className="space-y-4">
                    <div className="rounded-lg border border-border bg-white p-4 transition-all duration-200">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-base font-bold text-white">
                                {user?.name?.charAt(0)?.toUpperCase() ?? 'O'}
                            </div>
                            <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-text">{user?.name ?? 'Owner'}</div>
                                <div className="truncate text-xs text-text-muted">{user?.email ?? '-'}</div>
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <InfoBox label="Role" value="Owner" icon={<Shield className="h-3.5 w-3.5" />} />
                            <InfoBox label="Status" value={user?.is_active ? 'Active' : 'Inactive'} icon={<User className="h-3.5 w-3.5" />} />
                            <InfoBox label="Phone" value={user?.phone ?? '-'} icon={<Phone className="h-3.5 w-3.5" />} />
                            <InfoBox label="Version" value={appVersion ?? '1.0.0'} icon={<Package className="h-3.5 w-3.5" />} />
                        </div>
                    </div>
                </div>

                {/* Right: quick actions (desktop only, sticky) */}
                <div className="hidden lg:block">
                    <div className="sticky top-4 space-y-3">
                        <div className="rounded-lg border border-border bg-white p-4 transition-all duration-200">
                            <div className="text-xs font-bold uppercase tracking-wider text-text-subtle mb-3">Quick Actions</div>
                            <button
                                onClick={() => router.post('/logout')}
                                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-sm font-bold text-red-700 transition-all duration-150 hover:bg-red-100 active:opacity-80"
                            >
                                <LogOut className="h-4 w-4" />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile logout */}
                <div className="mt-4 lg:hidden">
                    <button
                        onClick={() => router.post('/logout')}
                        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-sm font-bold text-red-700 transition-all duration-150 hover:bg-red-100 active:opacity-80"
                    >
                        <LogOut className="h-4 w-4" />
                        Logout
                    </button>
                </div>
            </div>
        </OwnerPageShell>
    );
}

function InfoBox({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-border bg-surface-muted p-3 transition-all duration-200">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-subtle">
                {icon}
                {label}
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-text">{value}</div>
        </div>
    );
}
