import { formatCurrency } from '@/lib/format';

interface Props {
    total: number;
    disabled?: boolean;
    processing?: boolean;
    onSubmit: () => void;
}

export default function StickyPlaceOrderBar({ total, disabled = false, processing = false, onSubmit }: Props) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto max-w-lg pb-3">
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={disabled || processing}
                    className="flex min-h-14 w-full items-center justify-between rounded-xl bg-emerald-700 px-5 shadow-lg transition-transform active:scale-[0.98] active:bg-emerald-800 disabled:bg-zinc-300 disabled:shadow-none disabled:active:scale-100"
                >
                    <div className="text-left">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">Place Order</div>
                        <div className="text-sm font-bold tabular-nums text-white">{formatCurrency(total)}</div>
                    </div>
                    {processing ? (
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    );
}
