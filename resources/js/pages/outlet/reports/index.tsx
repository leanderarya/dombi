import { Head, router } from '@inertiajs/react';
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

            <div className="space-y-4">
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                    {periods.map((p) => (
                        <button
                            key={p.key}
                            onClick={() => setPeriod(p.key)}
                            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                                period === p.key ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-600 active:bg-zinc-200'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Export Laporan</div>
                    <p className="text-sm text-slate-600 mb-4">Download laporan penjualan dalam format CSV untuk periode yang dipilih.</p>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white active:bg-emerald-700 disabled:opacity-50"
                    >
                        {exporting ? 'Mengexport...' : 'Download CSV'}
                    </button>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Konten Laporan</div>
                    <ul className="space-y-2 text-sm text-slate-600">
                        <li className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Tanggal dan kode order
                        </li>
                        <li className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Nama produk dan variant
                        </li>
                        <li className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Quantity, harga, dan subtotal
                        </li>
                        <li className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Margin per item
                        </li>
                    </ul>
                </div>
            </div>
        </OutletLayout>
    );
}
