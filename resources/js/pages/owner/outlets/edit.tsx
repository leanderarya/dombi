import { Head, useForm } from '@inertiajs/react';
import OwnerLayout from '../../../layouts/owner-layout';
import CreateOutlet from './create';

export default function EditOutlet({ outlet }: any) {
    const form = useForm({ name: outlet.name, kelurahan: outlet.kelurahan, kecamatan: outlet.kecamatan, address: outlet.address, latitude: outlet.latitude ?? '', longitude: outlet.longitude ?? '', phone: outlet.phone ?? '', status: outlet.status });
    const AnyCreate: any = CreateOutlet;
    const Form = (AnyCreate as any).OutletForm;
    return <OwnerLayout><Head title="Edit Outlet" /><h1 className="text-2xl font-semibold">Edit Outlet</h1>{Form ? <Form form={form} title="Update" submit={(e: any) => { e.preventDefault(); form.put(`/owner/outlets/${outlet.id}`); }} /> : <form onSubmit={(e) => { e.preventDefault(); form.put(`/owner/outlets/${outlet.id}`); }} className="mt-5 grid gap-4 rounded-lg border bg-white p-5 sm:grid-cols-2">{['name','kelurahan','kecamatan','phone','latitude','longitude'].map((key) => <label key={key} className="text-sm capitalize">{key}<input value={(form.data as any)[key] ?? ''} onChange={(e) => form.setData(key as any, e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" /></label>)}<label className="text-sm sm:col-span-2">Address<textarea value={form.data.address} onChange={(e) => form.setData('address', e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" /></label><label className="text-sm">Status<select value={form.data.status} onChange={(e) => form.setData('status', e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2"><option value="active">active</option><option value="inactive">inactive</option></select></label><div className="sm:col-span-2"><button className="rounded-md bg-emerald-700 px-4 py-2 text-white">Update</button></div></form>}</OwnerLayout>;
}
