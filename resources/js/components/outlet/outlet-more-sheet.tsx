import { Link, router } from '@inertiajs/react';
import { BarChart3, DollarSign, FileText, LogOut, Package, RefreshCw, RotateCcw, Truck } from 'lucide-react';
import BottomSheet from '@/components/ui/bottom-sheet';

interface Props {
    open: boolean;
    onClose: () => void;
}

const sheetItems = [
    { href: '/outlet/restocks', label: 'Restock', icon: Package },
    { href: '/outlet/settlement', label: 'Settlement', icon: DollarSign },
    { href: '/outlet/deliveries', label: 'Pengiriman', icon: Truck },
    { divider: true },
    { href: '/outlet/returns', label: 'Pengembalian', icon: RotateCcw },
    { href: '/outlet/exchanges', label: 'Penukaran', icon: RefreshCw },
    { divider: true },
    { href: '/outlet/reports', label: 'Laporan', icon: FileText },
    { href: '/outlet/analytics', label: 'Analitik', icon: BarChart3 },
];

export default function OutletMoreSheet({ open, onClose }: Props) {
    return (
        <BottomSheet open={open} onClose={onClose} title="Menu">
            <div className="mb-4 space-y-0.5">
                {sheetItems.map((item, i) => {
                    if ('divider' in item && item.divider) {
                        return <div key={i} className="my-2 h-px bg-border" />;
                    }

                    const Icon = item.icon!;

                    return (
                        <Link
                            key={item.href}
                            href={item.href!}
                            onClick={onClose}
                            className="flex items-center gap-3 rounded-xl px-3 py-3 text-text active:opacity-80"
                        >
                            <Icon className="h-5 w-5 text-text-muted" />
                            <span className="text-sm font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </div>

            <div className="border-t border-border pt-3">
                <button
                    type="button"
                    onClick={() => {
 onClose(); router.post('/logout'); 
}}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-red-600 active:opacity-80"
                >
                    <LogOut className="h-5 w-5" />
                    <span className="text-sm font-medium">Keluar</span>
                </button>
            </div>
        </BottomSheet>
    );
}
