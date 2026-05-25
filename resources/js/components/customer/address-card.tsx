interface Props {
    address: any;
    selected?: boolean;
    onClick?: () => void;
}

export default function AddressCard({ address, selected = false, onClick }: Props) {
    const content = (
        <>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-950">{address.label || address.recipient_name}</div>
                    <div className="mt-1 text-xs text-slate-500">{address.recipient_name} · {address.phone}</div>
                </div>
                {selected && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Dipilih</span>}
            </div>
            <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{address.address}</div>
            <div className="mt-1 text-xs text-slate-400">{[address.kelurahan, address.kecamatan].filter(Boolean).join(', ')}</div>
        </>
    );

    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={`w-full rounded-lg border bg-white p-4 text-left transition-colors active:bg-zinc-50 ${selected ? 'border-emerald-300 ring-2 ring-emerald-50' : 'border-zinc-200'}`}>
                {content}
            </button>
        );
    }

    return <div className={`rounded-lg border bg-white p-4 ${selected ? 'border-emerald-300 ring-2 ring-emerald-50' : 'border-zinc-200'}`}>{content}</div>;
}
