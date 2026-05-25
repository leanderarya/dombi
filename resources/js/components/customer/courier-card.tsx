interface Props {
    courier: {
        name: string;
    };
    vehicle?: string | null;
    plateNumber?: string | null;
}

export default function CourierCard({ courier, vehicle, plateNumber }: Props) {
    return (
        <div className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-white px-4 py-3">
            {/* Avatar placeholder */}
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100">
                <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            </div>
            {/* Info */}
            <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{courier.name}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                    {[vehicle, plateNumber].filter(Boolean).join(' · ') || 'Kurir aktif'}
                </div>
            </div>
            {/* Call action */}
            <a
                href="tel:"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 active:bg-emerald-100"
                aria-label="Hubungi kurir"
            >
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
            </a>
        </div>
    );
}
