import { Head, Link, router } from '@inertiajs/react';
import OwnerLayout from '../../../layouts/owner-layout';

export default function OutletsIndex({ outlets }: any) {
    return (
        <OwnerLayout>
            <Head title="Outlet" />
            <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Outlet</h1><Link href="/owner/outlets/create" className="rounded-md bg-emerald-700 px-4 py-2 text-white">Tambah</Link></div>
            <div className="mt-5 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50"><tr><th className="p-3">Nama</th><th>Kecamatan</th><th>Status</th><th></th></tr></thead>
                    <tbody>{outlets.data.map((outlet: any) => <tr key={outlet.id} className="border-t"><td className="p-3 font-medium">{outlet.name}</td><td>{outlet.kecamatan}</td><td>{outlet.status}</td><td className="space-x-3 p-3 text-right"><Link href={`/owner/outlets/${outlet.id}/edit`} className="text-emerald-700">Edit</Link><button onClick={() => confirm('Hapus outlet?') && router.delete(`/owner/outlets/${outlet.id}`)} className="text-red-600">Hapus</button></td></tr>)}</tbody>
                </table>
            </div>
        </OwnerLayout>
    );
}
