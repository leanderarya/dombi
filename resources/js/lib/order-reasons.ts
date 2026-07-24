export function normalizeOrderReason(reason: string | null | undefined): string | null {
    if (!reason) return null;
    return reason === 'Stok Habis' ? 'Stok Tidak Tersedia' : reason;
}
