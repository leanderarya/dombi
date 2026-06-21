interface Props {
    label: string;
    disabled: boolean;
    processing: boolean;
    onClick: () => void;
}

export default function StepButton({ label, disabled, processing, onClick }: Props) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
            <div className="mx-auto max-w-lg">
                <button
                    type="button"
                    onClick={onClick}
                    disabled={disabled}
                    className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 active:opacity-80 disabled:from-zinc-300 disabled:to-zinc-300 disabled:shadow-none disabled:text-zinc-500"
                >
                    {processing ? 'Memproses...' : label}
                </button>
            </div>
        </div>
    );
}
