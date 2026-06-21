import { Head } from '@inertiajs/react';
import OutletLayout from '@/layouts/outlet-layout';

export default function OutletScan() {
    return (
        <OutletLayout title="Scan" subtitle="Scan kode pesanan">
            <Head title="Scan Pesanan" />
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-slate-500">Halaman scan QR pesanan akan segera tersedia.</p>
            </div>
        </OutletLayout>
    );
}
