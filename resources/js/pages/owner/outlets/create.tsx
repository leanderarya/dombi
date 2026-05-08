import { Head, useForm } from '@inertiajs/react';
import OwnerLayout from '../../../layouts/owner-layout';

function OutletForm({ form, submit, title }: any) {
    return <form onSubmit={submit} className="mt-5 grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 sm:grid-cols-2">
        {['name', 'kelurahan', 'kecamatan', 'phone', 'latitude', 'longitude'].map((key) => <label key={key} className="text-sm capitalize">{key}<input value={form.data[key] ?? ''} onChange={(e) => form.setData(key, e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />{form.errors[key] && <span className="text-red-600">{form.errors[key]}</span>}</label>)}
        <label className="text-sm sm:col-span-2">Address<textarea value={form.data.address} onChange={(e) => form.setData('address', e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" /></label>
        <label className="text-sm">Status<select value={form.data.status} onChange={(e) => form.setData('status', e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2"><option value="active">active</option><option value="inactive">inactive</option></select></label>
        <div className="sm:col-span-2"><button className="rounded-md bg-emerald-700 px-4 py-2 text-white">{title}</button></div>
    </form>;
}

export default function CreateOutlet() {
    const form = useForm({ name: '', kelurahan: '', kecamatan: '', address: '', latitude: '', longitude: '', phone: '', status: 'active' });
    return <OwnerLayout><Head title="Tambah Outlet" /><h1 className="text-2xl font-semibold">Tambah Outlet</h1><OutletForm form={form} title="Simpan" submit={(e: any) => { e.preventDefault(); form.post('/owner/outlets'); }} /></OwnerLayout>;
}
