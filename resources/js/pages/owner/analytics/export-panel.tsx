import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    open: boolean;
    onToggle: () => void;
    exporting: string | null;
    onExport: (type: string) => void;
}

export default function ExportPanel({ open, onToggle, exporting, onExport }: Props) {
    return (
        <div className="rounded-lg border border-border bg-white" aria-label="Download laporan">
            <button type="button" onClick={onToggle} className="flex w-full items-center justify-between p-4">
                <div className="text-sm font-semibold text-text">Download Laporan</div>
                <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {open && (
                <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                    <div>
                        <div className="text-xs font-medium text-text mb-1">Laporan Orders</div>
                        <p className="mb-2 text-xs text-text-muted">Download data order completed</p>
                        <Button
                            className="w-full"
                            loading={exporting === 'orders'}
                            disabled={exporting === 'orders'}
                            onClick={() => onExport('orders')}
                        >
                            {exporting === 'orders' ? 'Mengexport...' : 'Download CSV'}
                        </Button>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-text mb-1">Laporan Settlements</div>
                        <p className="mb-2 text-xs text-text-muted">Download data settlement outlet</p>
                        <Button
                            className="w-full"
                            loading={exporting === 'settlements'}
                            disabled={exporting === 'settlements'}
                            onClick={() => onExport('settlements')}
                        >
                            {exporting === 'settlements' ? 'Mengexport...' : 'Download CSV'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
