import { Head } from '@inertiajs/react';
import OutletLayout from '../../layouts/outlet-layout';

export default function OutletDashboard() {
    return <OutletLayout><Head title="Outlet Dashboard" /><div className="rounded-lg border bg-white p-6"><h1 className="text-2xl font-semibold">Outlet Dashboard</h1><p className="mt-2 text-zinc-500">Placeholder untuk milestone berikutnya.</p></div></OutletLayout>;
}
