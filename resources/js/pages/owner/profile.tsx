import { router, useForm, usePage } from '@inertiajs/react';
import {
    LogOut,
    User,
    Shield,
    Phone,
    Package,
    KeyRound,
    Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EMPTY_PASSWORD = {
    current_password: '',
    password: '',
    password_confirmation: '',
};

export default function OwnerProfile() {
    const { auth, appVersion } = usePage<any>().props;
    const user = auth?.user;
    const passwordForm = useForm({ ...EMPTY_PASSWORD });
    const emailForm = useForm({
        email: user?.email ?? '',
        current_password: '',
    });

    const submitPassword = (e: React.FormEvent) => {
        e.preventDefault();
        passwordForm.put('/owner/profile/password', {
            preserveScroll: true,
            onSuccess: () => passwordForm.reset(),
            onError: (errors) =>
                toast.error(Object.values(errors).flat().join(', ')),
        });
    };

    const submitEmail = (e: React.FormEvent) => {
        e.preventDefault();
        emailForm.patch('/owner/profile/email', {
            preserveScroll: true,
            onSuccess: () => emailForm.reset('current_password'),
            onError: (errors) =>
                toast.error(Object.values(errors).flat().join(', ')),
        });
    };

    return (
        <OwnerPageShell title="Profil" subtitle="Akun owner">
            <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
                {/* Left: user info */}
                <div className="space-y-4" aria-label="Informasi profil">
                    <div className="rounded-lg border border-border bg-white p-4 transition-all duration-200">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-base font-bold text-white">
                                {user?.name?.charAt(0)?.toUpperCase() ?? 'O'}
                            </div>
                            <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-text">
                                    {user?.name ?? 'Owner'}
                                </div>
                                <div className="truncate text-xs text-text-muted">
                                    {user?.email ?? '-'}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <InfoBox
                                label="Peran"
                                value={user?.role ?? 'owner'}
                                icon={
                                    <Shield
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                    />
                                }
                            />
                            <InfoBox
                                label="Status"
                                value={user?.is_active ? 'Aktif' : 'Nonaktif'}
                                icon={
                                    <User
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                    />
                                }
                            />
                            <InfoBox
                                label="Telepon"
                                value={user?.phone ?? '-'}
                                icon={
                                    <Phone
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                    />
                                }
                            />
                            <InfoBox
                                label="Versi"
                                value={appVersion ?? '1.0.0'}
                                icon={
                                    <Package
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                    />
                                }
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <form
                        onSubmit={submitPassword}
                        className="rounded-lg border border-border bg-white p-4 transition-all duration-200"
                        aria-label="Ganti password"
                    >
                        <div className="mb-3 flex items-center gap-2">
                            <KeyRound
                                className="h-4 w-4 text-text-muted"
                                aria-hidden="true"
                            />
                            <h2 className="text-sm font-bold text-text">
                                Ganti Password
                            </h2>
                        </div>
                        <div className="space-y-3">
                            <Input
                                label="Password Saat Ini"
                                type="password"
                                autoComplete="current-password"
                                value={passwordForm.data.current_password}
                                onChange={(e) =>
                                    passwordForm.setData(
                                        'current_password',
                                        e.target.value,
                                    )
                                }
                                error={passwordForm.errors.current_password}
                            />
                            <Input
                                label="Password Baru"
                                type="password"
                                autoComplete="new-password"
                                value={passwordForm.data.password}
                                onChange={(e) =>
                                    passwordForm.setData(
                                        'password',
                                        e.target.value,
                                    )
                                }
                                error={passwordForm.errors.password}
                            />
                            <Input
                                label="Konfirmasi Password Baru"
                                type="password"
                                autoComplete="new-password"
                                value={passwordForm.data.password_confirmation}
                                onChange={(e) =>
                                    passwordForm.setData(
                                        'password_confirmation',
                                        e.target.value,
                                    )
                                }
                                error={
                                    passwordForm.errors.password_confirmation
                                }
                            />
                        </div>
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            className="mt-4"
                            loading={passwordForm.processing}
                        >
                            Simpan Password
                        </Button>
                    </form>

                    {/* Email */}
                    <form
                        onSubmit={submitEmail}
                        className="rounded-lg border border-border bg-white p-4 transition-all duration-200"
                        aria-label="Ganti email"
                    >
                        <div className="mb-3 flex items-center gap-2">
                            <Mail
                                className="h-4 w-4 text-text-muted"
                                aria-hidden="true"
                            />
                            <h2 className="text-sm font-bold text-text">
                                Ganti Email
                            </h2>
                        </div>
                        <div className="space-y-3">
                            <Input
                                label="Email"
                                type="email"
                                autoComplete="email"
                                value={emailForm.data.email}
                                onChange={(e) =>
                                    emailForm.setData('email', e.target.value)
                                }
                                error={emailForm.errors.email}
                            />
                            <Input
                                label="Password Saat Ini"
                                type="password"
                                autoComplete="current-password"
                                value={emailForm.data.current_password}
                                onChange={(e) =>
                                    emailForm.setData(
                                        'current_password',
                                        e.target.value,
                                    )
                                }
                                error={emailForm.errors.current_password}
                            />
                            <p className="text-xs text-text-muted">
                                Konfirmasi dengan password saat ini. Email baru
                                langsung aktif — tidak ada email verifikasi.
                            </p>
                        </div>
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            className="mt-4"
                            loading={emailForm.processing}
                        >
                            Simpan Email
                        </Button>
                    </form>
                </div>

                {/* Right: quick actions (desktop only, sticky) */}
                <div className="hidden lg:block" aria-label="Aksi cepat">
                    <div className="sticky top-4 space-y-3">
                        <div className="rounded-lg border border-border bg-white p-4 transition-all duration-200">
                            <div className="mb-3 text-xs font-medium text-text-subtle">
                                Aksi Cepat
                            </div>
                            <Button
                                onClick={() => router.post('/logout')}
                                variant="outline"
                                size="cta"
                                className="border-danger-border text-danger-text hover:bg-danger-bg active:opacity-80"
                            >
                                <LogOut
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Keluar
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Keluar (mobile) */}
                <div className="mt-4 lg:hidden">
                    <Button
                        onClick={() => router.post('/logout')}
                        variant="outline"
                        size="cta"
                        className="border-danger-border text-danger-text hover:bg-danger-bg active:opacity-80"
                    >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                        Keluar
                    </Button>
                </div>
            </div>
        </OwnerPageShell>
    );
}

function InfoBox({
    label,
    value,
    icon,
}: {
    label: string;
    value: string;
    icon?: React.ReactNode;
}) {
    return (
        <div className="rounded-lg border border-border bg-surface-muted p-3 transition-all duration-200">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-subtle">
                {icon}
                {label}
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-text">
                {value}
            </div>
        </div>
    );
}
