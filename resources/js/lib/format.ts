export function formatCurrency(value: number | string) {
    return `Rp ${Number(value).toLocaleString('id-ID')}`;
}

export function formatDistance(km: number | null | undefined): string {
    if (km === null || km === undefined) return '-';
    return `${km.toFixed(1)} km`;
}

export function formatDate(value?: string | null) {
    if (!value) {
        return '-';
    }

    return new Date(value).toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}
