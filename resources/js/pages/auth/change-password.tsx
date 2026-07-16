import { Head, useForm } from '@inertiajs/react';

export default function ChangePassword({
    mustChangePassword,
}: {
    mustChangePassword: boolean;
}) {
    const form = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    return (
        <div className="flex min-h-dvh items-center justify-center bg-[#F8FAFC] p-4">
            <Head title="Update Password" />
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.put('/password/change');
                }}
                className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4"
            >
                <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                    Operational Access
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                    Update Password
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                    {mustChangePassword
                        ? 'Akun outlet baru wajib mengganti temporary password sebelum masuk dashboard.'
                        : 'Perbarui password akun operasional Anda.'}
                </p>

                <Field
                    label="Temporary/current password"
                    type="password"
                    value={form.data.current_password}
                    onChange={(value) =>
                        form.setData('current_password', value)
                    }
                    error={form.errors.current_password}
                />
                <Field
                    label="New password"
                    type="password"
                    value={form.data.password}
                    onChange={(value) => form.setData('password', value)}
                    error={form.errors.password}
                />
                <Field
                    label="Confirm new password"
                    type="password"
                    value={form.data.password_confirmation}
                    onChange={(value) =>
                        form.setData('password_confirmation', value)
                    }
                    error={form.errors.password_confirmation}
                />

                <button
                    disabled={form.processing}
                    className="mt-5 flex min-h-[48px] w-full items-center justify-center rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white transition-colors active:bg-emerald-600 disabled:bg-slate-300"
                >
                    Update Password
                </button>
            </form>
        </div>
    );
}

function Field({
    label,
    type,
    value,
    onChange,
    error,
}: {
    label: string;
    type: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
}) {
    return (
        <label className="mt-4 block">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                {label}
            </span>
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            {error && (
                <span className="mt-1 block text-xs font-semibold text-red-600">
                    {error}
                </span>
            )}
        </label>
    );
}
