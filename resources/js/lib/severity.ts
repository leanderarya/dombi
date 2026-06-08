export type Severity = 'critical' | 'warning' | 'info';

export function settlementSeverity(daysOverdue: number): Severity {
    if (daysOverdue > 14) return 'critical';
    if (daysOverdue > 7) return 'warning';
    return 'info';
}

export function stockSeverity(current: number, threshold: number): Severity {
    if (current === 0) return 'critical';
    if (current <= threshold * 0.5) return 'warning';
    return 'info';
}

export function pendingSeverity(count: number, criticalThreshold = 5): Severity {
    if (count >= criticalThreshold) return 'critical';
    if (count > 0) return 'warning';
    return 'info';
}
