const styles: Record<string, string> = {
    normal: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    critical: 'bg-red-100 text-red-800',
};

const labels: Record<string, string> = {
    normal: 'Normal',
    warning: 'Warning',
    critical: 'Terlambat',
};

export default function DeliverySlaBadge({ health }: { health: string }) {
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${styles[health] ?? styles.normal}`}>
            {health === 'critical' && (
                <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
            )}
            {labels[health] ?? health}
        </span>
    );
}
