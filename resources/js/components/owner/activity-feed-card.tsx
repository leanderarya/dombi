interface Props {
    items: {
        id: number;
        title: string;
        subtitle: string;
        color: 'emerald' | 'blue' | 'red' | 'amber' | 'slate';
    }[];
}

const dotColors = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    slate: 'bg-slate-400',
};

export default function ActivityFeed({ items }: Props) {
    if (items.length === 0) return null;

    return (
        <div className="space-y-0">
            {items.map((item, index) => (
                <div key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {/* Vertical line */}
                    {index < items.length - 1 && (
                        <div className="absolute left-[7px] top-5 bottom-0 w-px bg-slate-200" />
                    )}
                    {/* Dot */}
                    <div className="relative mt-1.5 shrink-0">
                        <div className={`h-3.5 w-3.5 rounded-full ${dotColors[item.color]}`} />
                    </div>
                    {/* Content */}
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                        <div className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">{item.subtitle}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
