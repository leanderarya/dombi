export function gridCols(count: number): string {
    const base = 'grid-cols-2';
    return count >= 3 ? `${base} lg:grid-cols-${count}` : base;
}

export function railAndMain(): string {
    return 'grid-cols-1 lg:grid-cols-[260px_1fr] lg:gap-6';
}