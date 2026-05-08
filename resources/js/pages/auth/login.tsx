import { Head, useForm } from '@inertiajs/react';

export default function Login() {
    const form = useForm({ email: '', password: '', remember: false });

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
            <Head title="Login" />
            <form onSubmit={(e) => { e.preventDefault(); form.post('/login'); }} className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
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
