import { Head, router, useForm } from '@inertiajs/react';

interface Props {
    auth?: {
        user?: {
            id: number;
            name: string;
            email: string;
            role: string;
        } | null;
    };
}

const roleLabels: Record<string, string> = {
    owner: 'Owner',
    outlet: 'Outlet',
    courier: 'Kurir',
    customer: 'Customer',
};

const roleDashboards: Record<string, string> = {
    owner: '/owner/dashboard',
    outlet: '/outlet/dashboard',
    courier: '/courier/dashboard',
    customer: '/customer/home',
};

export default function Login({ auth }: Props) {
    const user = auth?.user;
    const form = useForm({ email: '', password: '', remember: false });

    if (user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
                <Head title="Login" />
                <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                    <h1 className="text-2xl font-semibold">Sudah Masuk</h1>
                    <p className="mt-1 text-sm text-zinc-500">Anda masuk sebagai akun berikut.</p>

                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                        <div className="mt-1">
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                                {roleLabels[user.role] ?? user.role}
                            </span>
                        </div>
                    </div>

                    <div className="mt-5 flex gap-2">
                        <button
                            onClick={() => router.visit(roleDashboards[user.role] ?? '/dashboard')}
                            className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-emerald-700 text-sm font-semibold text-white active:bg-emerald-800"
                        >
                            Buka Dashboard
                        </button>
                        <button
                            onClick={() => router.post('/logout')}
                            className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 active:bg-slate-50"
                        >
                            Ganti Akun
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
            <Head title="Login" />
            <form onSubmit={(e) => {
 e.preventDefault(); form.post('/login'); 
}} className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                <h1 className="text-2xl font-semibold">Login Dombi</h1>
                <p className="mt-1 text-sm text-zinc-500">Masuk sebagai owner, customer, outlet, atau courier.</p>
                <label className="mt-6 block text-sm">Email</label>
                <input value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2" />
                {form.errors.email && <div className="mt-1 text-sm text-red-600">{form.errors.email}</div>}
                <label className="mt-4 block text-sm">Password</label>
                <input type="password" value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2" />
                <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.data.remember} onChange={(e) => form.setData('remember', e.target.checked)} /> Remember me</label>
                <button disabled={form.processing} className="mt-6 w-full rounded-md bg-emerald-700 px-4 py-2 font-medium text-white">Login</button>
            </form>
        </div>
    );
}
