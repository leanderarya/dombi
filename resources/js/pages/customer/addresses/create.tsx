import { Head, useForm } from '@inertiajs/react';
import CustomerLayout from '../../../layouts/customer-layout';

export function AddressForm({ form, submit }: any) {
    return <form onSubmit={submit} className="mt-5 grid gap-4 rounded-lg border bg-white p-5 sm:grid-cols-2">{['label','recipient_name','phone','kelurahan','kecamatan','latitude','longitude'].map((key) => <label key={key} className="text-sm capitalize">{key.replace('_',' ')}<input value={form.data[key] ?? ''} onChange={(e) => form.setData(key, e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />{form.errors[key] && <span className="text-red-600">{form.errors[key]}</span>}</label>)}<label className="text-sm sm:col-span-2">Address<textarea value={form.data.address} onChange={(e) => form.setData('address', e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.data.is_default)} onChange={(e) => form.setData('is_default', e.target.checked)} /> Jadikan default</label><div className="sm:col-span-2"><button className="rounded-md bg-emerald-700 px-4 py-2 text-white">Simpan</button></div></form>;
}

export default function CreateAddress() {
    const form = useForm({ label: '', recipient_name: '', phone: '', address: '', kelurahan: '', kecamatan: '', latitude: '', longitude: '', is_default: false as any });
    return <CustomerLayout><Head title="Tambah Alamat" /><h1 className="text-2xl font-semibold">Tambah Alamat</h1><AddressForm form={form} submit={(e: any) => { e.preventDefault(); form.post('/customer/addresses'); }} /></CustomerLayout>;
}
