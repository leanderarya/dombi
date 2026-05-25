interface Props {
    user: {
        name: string;
        email: string;
        phone?: string | null;
    };
}

export default function ProfileCard({ user }: Props) {
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xl font-bold text-emerald-700">
                    {user.name.charAt(0).toUpperCase()}
                </div>
                {/* Info */}
                <div className="min-w-0 flex-1">
                    <div className="text-base font-bold text-slate-900">{user.name}</div>
                    {user.phone && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                            {user.phone}
                        </div>
                    )}
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        {user.email}
                    </div>
                </div>
            </div>
        </div>
    );
}
