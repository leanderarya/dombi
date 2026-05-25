interface Props {
    value: number;
    min?: number;
    onChange: (value: number) => void;
}

export default function QuantityStepper({ value, min = 1, onChange }: Props) {
    const safeValue = Number.isFinite(value) ? Math.max(min, value) : min;

    return (
        <div className="inline-flex items-center rounded-lg border border-zinc-200">
            <button
                type="button"
                onClick={() => onChange(Math.max(min, safeValue - 1))}
                className="flex h-10 w-10 items-center justify-center text-base font-semibold text-slate-600 transition-transform active:scale-90 active:bg-zinc-50"
                aria-label="Kurangi"
            >
                −
            </button>
            <span className="flex h-10 w-9 items-center justify-center text-sm font-bold tabular-nums text-slate-900">
                {safeValue}
            </span>
            <button
                type="button"
                onClick={() => onChange(safeValue + 1)}
                className="flex h-10 w-10 items-center justify-center text-base font-semibold text-slate-600 transition-transform active:scale-90 active:bg-zinc-50"
                aria-label="Tambah"
            >
                +
            </button>
        </div>
    );
}
