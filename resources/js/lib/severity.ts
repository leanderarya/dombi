export type Severity = 'critical' | 'warning' | 'info';
export type AgingStatus = 'CURRENT' | 'DUE_TODAY' | 'OVERDUE_1_7' | 'OVERDUE_8_14' | 'OVERDUE_15_30' | 'OVERDUE_30_PLUS';

export const agingConfig: Record<AgingStatus, { label: string; color: string; bg: string; border: string }> = {
    CURRENT: { label: 'Tepat Waktu', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    DUE_TODAY: { label: 'Jatuh Tempo', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    OVERDUE_1_7: { label: '1-7 Hari', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    OVERDUE_8_14: { label: '8-14 Hari', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
    OVERDUE_15_30: { label: '15-30 Hari', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
    OVERDUE_30_PLUS: { label: '>30 Hari', color: 'text-red-900', bg: 'bg-red-100', border: 'border-red-300' },
};

export function getAgingStatus(daysOverdue: number, hasOutstanding: boolean): AgingStatus {
    if (!hasOutstanding) {
return 'CURRENT';
}

    if (daysOverdue <= 0) {
return 'CURRENT';
}

    if (daysOverdue <= 7) {
return 'OVERDUE_1_7';
}

    if (daysOverdue <= 14) {
return 'OVERDUE_8_14';
}

    if (daysOverdue <= 30) {
return 'OVERDUE_15_30';
}

    return 'OVERDUE_30_PLUS';
}

export function settlementSeverity(daysOverdue: number): Severity {
    if (daysOverdue > 14) {
return 'critical';
}

    if (daysOverdue > 7) {
return 'warning';
}

    return 'info';
}

export function stockSeverity(current: number, threshold: number): Severity {
    if (current === 0) {
return 'critical';
}

    if (current <= threshold * 0.5) {
return 'warning';
}

    return 'info';
}

export function pendingSeverity(count: number, criticalThreshold = 5): Severity {
    if (count >= criticalThreshold) {
return 'critical';
}

    if (count > 0) {
return 'warning';
}

    return 'info';
}
