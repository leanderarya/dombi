interface Props {
    icon?: string;
    title: string;
    description?: string;
}

export default function EmptyState({ icon = '📭', title, description }: Props) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl">{icon}</div>
            <p className="mt-2 text-sm font-medium text-slate-600">{title}</p>
            {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
        </div>
    );
}
