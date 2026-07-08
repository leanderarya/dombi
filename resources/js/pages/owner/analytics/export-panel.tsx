import { ChevronDown } from 'lucide-react';

interface Props {
    open: boolean;
    onToggle: () => void;
    exporting: string | null;
    onExport: (type: string) => void;
}

export default function ExportPanel({ open, onToggle, exporting, onExport }: Props) {
    return (
        <div className="rounded-lg border border-border bg-white transition-shadow">
            <button onClick={onToggle} className="flex w-full items-center justify-between p-4">
                <div className="text-sm font-semibold text-text">Download Laporan</div>
                <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                    <div>
                        <div className="text-xs font-medium text-text mb-1">Laporan Orders</div>
                        <p className="mb-2 text-xs text-text-muted">Download data order completed</p>
                        <button
                            onClick={() => onExport('orders')}
                            disabled={exporting === 'orders'}
                            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-all duration-150 hover:bg-primary/90 active:bg-primary/90 disabled:opacity-50"
                        >
                            {exporting === 'orders' ? 'Mengexport...' : 'Download CSV'}
                        </button>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-text mb-1">Laporan Settlements</div>
                        <p className="mb-2 text-xs text-text-muted">Download data settlement outlet</p>
                        <button
                            onClick={() => onExport('settlements')}
                            disabled={exporting === 'settlements'}
                            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-all duration-150 hover:bg-primary/90 active:bg-primary/90 disabled:opacity-50"
                        >
                            {exporting === 'settlements' ? 'Mengexport...' : 'Download CSV'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
