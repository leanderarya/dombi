import { Head, useForm } from '@inertiajs/react';

interface Invitation {
    name: string;
    phone: string;
    email: string | null;
    token: string;
}

export default function AcceptInvite({ invitation }: { invitation: Invitation }) {
    const form = useForm({
        password: '',
        password_confirmation: '',
    });

    return (
        <div className="flex min-h-dvh items-center justify-center bg-[#F8FAFC] p-4">
            <Head title="Terima Undangan" />
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post(`/courier/invite/${invitation.token}`);
                }}
                className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4"
            >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Undangan Kurir</p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">Selamat Datang, {invitation.name}</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                    Anda diundang sebagai kurir di Dombi. Buat password untuk mengaktifkan akun Anda.
                </p>

                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <div>
                        <div className="text-xs text-slate-500">No. HP</div>
                        <div className="text-sm font-semibold text-slate-900">{invitation.phone}</div>
                    </div>
                    {invitation.email && (
                        <div>
                            <div className="text-xs text-slate-500">Email (untuk login)</div>
                            <div className="text-sm font-semibold text-slate-900">{invitation.email}</div>
                        </div>
                    )}
                </div>

                <label className="mt-5 block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Password Baru</span>
                    <input
                        type="password"
                        value={form.data.password}
                        onChange={(e) => form.setData('password', e.target.value)}
                        className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                    {form.errors.password && <span className="mt-1 block text-xs font-semibold text-red-600">{form.errors.password}</span>}
                </label>

                <label className="mt-4 block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Konfirmasi Password</span>
                    <input
                        type="password"
                        value={form.data.password_confirmation}
                        onChange={(e) => form.setData('password_confirmation', e.target.value)}
                        className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                </label>

                <button
                    disabled={form.processing}
                    className="mt-5 flex min-h-[48px] w-full items-center justify-center rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white transition-colors active:bg-emerald-600 disabled:bg-slate-300"
                >
                    {form.processing ? 'Mengaktifkan...' : 'Aktifkan Akun'}
                </button>
            </form>
        </div>
    );
}
