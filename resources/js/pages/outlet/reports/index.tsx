import { Head, router } from '@inertiajs/react';
import { CheckCircle } from 'lucide-react';
import { useState } from 'react';
import OutletLayout from '@/layouts/outlet-layout';

interface Props {
    outlet: { id: number; name: string };
}

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

export default function OutletReports({ outlet }: Props) {
    const [period, setPeriod] = useState('month');
    const [exporting, setExporting] = useState(false);

    const handleExport = () => {
        setExporting(true);
        router.get(
            `/outlet/reports/sales/export?period=${period}`,
            {},
            {
                onFinish: () => setExporting(false),
            },
        );
    };

    return (
        <OutletLayout title="Laporan Penjualan" subtitle={`Laporan untuk ${outlet.name}`}>
            <Head title="Laporan Penjualan" />

            <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-2 overflow-x-auto scrollbar-none">
                    {periods.map((p) => (
                        <button
                            key={p.key}
                            onClick={() => setPeriod(p.key)}
                            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all ${
                                period === p.key
                                    ? 'bg-primary/10 text-primary ring-primary/20'
                                    : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                <div className="rounded-xl border border-border bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle mb-2">Export Laporan</div>
                    <p className="text-sm text-text-muted mb-4">Download laporan penjualan dalam format CSV untuk periode yang dipilih.</p>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white active:bg-primary disabled:opacity-50"
                    >
                        {exporting ? 'Mengexport...' : 'Download CSV'}
                    </button>
                </div>

                <div className="rounded-xl border border-border bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle mb-2">Konten Laporan</div>
                    <ul className="space-y-2 text-sm text-text-muted">
                        <li className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-primary" />
                                
                            
                            Tanggal dan kode order
                        </li>
                        <li className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-primary" />
                                
                            
                            Nama produk dan variant
                        </li>
                        <li className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-primary" />
                                
                            
                            Quantity, harga, dan subtotal
                        </li>
                        <li className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-primary" />
                                
                            
                            Margin per item
                        </li>
                    </ul>
                </div>
            </div>
        </OutletLayout>
    );
}
