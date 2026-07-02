import { Head, router } from '@inertiajs/react';
import { CheckCircle } from 'lucide-react';
import { useState } from 'react';
import FilterChips from '@/components/ui/filter-chips';
import OutletPageShell from '@/components/outlet/outlet-page-shell';
import OutletLayout from '@/layouts/outlet-layout';

interface Props {
    outlet: { id: number; name: string };
}

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
    { key: 'custom', label: 'Pilih Tanggal' },
];

export default function OutletReports({ outlet }: Props) {
    const [period, setPeriod] = useState('month');
    const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
    const [exporting, setExporting] = useState(false);

    const handlePeriodChange = (key: string) => {
        setPeriod(key);
        if (key !== 'custom') {
            setExporting(true);
            router.get(`/outlet/reports/sales/export?period=${key}`, {}, { onFinish: () => setExporting(false) });
        }
    };

    const handleCustomExport = () => {
        setExporting(true);
        router.get(
            `/outlet/reports/sales/export?period=custom&date_from=${dateFrom}&date_to=${dateTo}`,
            {},
            { onFinish: () => setExporting(false) },
        );
    };

    return (
        <OutletLayout title="Laporan Penjualan" subtitle={`Laporan untuk ${outlet.name}`}>
            <Head title="Laporan Penjualan" />

            <OutletPageShell>
                <FilterChips options={periods} active={period} onChange={handlePeriodChange} size="sm" variant="ring" />

                {period === 'custom' && (
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="min-h-11 flex-1 rounded-lg border border-border px-3 text-sm"
                        />
                        <span className="text-xs text-text-muted">sampai</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="min-h-11 flex-1 rounded-lg border border-border px-3 text-sm"
                        />
                        <button
                            type="button"
                            onClick={handleCustomExport}
                            disabled={exporting}
                            className="min-h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-bold text-white active:opacity-80 disabled:opacity-50"
                        >
                            {exporting ? 'Export...' : 'Download'}
                        </button>
                    </div>
                )}

                {period !== 'custom' && (
                    <div className="rounded-xl border border-border bg-white p-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle mb-2">Export Laporan</div>
                        <p className="text-sm text-text-muted mb-4">Download laporan penjualan dalam format CSV untuk periode yang dipilih.</p>
                        <button
                            onClick={() => handlePeriodChange(period)}
                            disabled={exporting}
                            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white active:bg-primary disabled:opacity-50"
                        >
                            {exporting ? 'Mengexport...' : 'Download CSV'}
                        </button>
                    </div>
                )}

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
            </OutletPageShell>
        </OutletLayout>
    );
}
