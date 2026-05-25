import { formatCurrency } from '@/lib/format';

interface Props {
    total: number;
    itemCount?: number;
    disabled?: boolean;
    processing?: boolean;
    onSubmit?: () => void;
}

export default function StickyCheckoutBar({ total, itemCount = 0, disabled = false, processing = false, onSubmit }: Props) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-100 bg-white px-4 pb-[env(safe-area-inset-bottom)] pt-3">
            <div className="mx-auto flex max-w-lg items-center gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold tabular-nums text-slate-950">{formatCurrency(total)}</span>
                        {itemCount > 0 && <span className="text-xs text-slate-400">{itemCount} item</span>}
                    </div>
                </div>
                <button
                    type={onSubmit ? 'button' : 'submit'}
                    onClick={onSubmit}
                    disabled={disabled || processing}
                    className="flex min-h-12 items-center gap-2 rounded-lg bg-emerald-700 px-6 text-sm font-bold text-white transition-transform active:scale-[0.97] active:bg-emerald-800 disabled:bg-zinc-300 disabled:active:scale-100"
                >
                    {processing ? (
                        <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Memproses
                        </>
                    ) : (
                        'Pesan Sekarang'
                    )}
                </button>
            </div>
        </div>
    );
}
