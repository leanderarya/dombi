import { Head, useForm } from '@inertiajs/react';
import CustomerLayout from '../../../layouts/customer-layout';
import { AddressForm } from './create';

export default function EditAddress({ address }: any) {
    const form = useForm({ label: address.label ?? '', recipient_name: address.recipient_name, phone: address.phone, address: address.address, kelurahan: address.kelurahan ?? '', kecamatan: address.kecamatan ?? '', latitude: address.latitude ?? '', longitude: address.longitude ?? '', is_default: address.is_default });
    return <CustomerLayout><Head title="Edit Alamat" /><h1 className="text-2xl font-semibold">Edit Alamat</h1><AddressForm form={form} submit={(e: any) => { e.preventDefault(); form.put(`/customer/addresses/${address.id}`); }} /></CustomerLayout>;
}
