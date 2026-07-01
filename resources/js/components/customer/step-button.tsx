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
                    className="flex min-h-14 w-full items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white active:opacity-80 disabled:bg-border disabled:text-text-subtle"
                >
                    {processing ? 'Memproses...' : label}
                </button>
            </div>
        </div>
    );
}
