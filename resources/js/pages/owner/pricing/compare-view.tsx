import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SkeletonList } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';
import { marginColor } from '@/lib/pricing-utils';
import { fetchCompareData, runCompareRequest } from './compare-request';
import type { CompareData } from './compare-request';
import type { OutletData, OutletPriceRow } from './types';

interface Props {
    outletIds: number[];
    outlets: OutletData[];
    onClose: () => void;
}

export default function CompareView({ outletIds, outlets, onClose }: Props) {
    const requestKey = outletIds.join(',');
    const [result, setResult] = useState<{
        requestKey: string;
        data: CompareData[];
    } | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const requestedOutletIds = requestKey
            .split(',')
            .filter(Boolean)
            .map(Number);

        void runCompareRequest({
            outletIds: requestedOutletIds,
            signal: controller.signal,
            request: fetchCompareData,
            onData: (data) => setResult({ requestKey, data }),
            onError: () =>
                setResult((current) => ({
                    requestKey,
                    data: current?.data ?? [],
                })),
        });

        return () => controller.abort();
    }, [requestKey]);

    const loading = result?.requestKey !== requestKey;
    const data = useMemo(
        () => (result?.requestKey === requestKey ? result.data : []),
        [requestKey, result],
    );

    const matrix = useMemo(() => {
        const allVariantNames = new Set<string>();
        const byOutlet = new Map<number, Map<string, OutletPriceRow>>();

        for (const d of data) {
            const map = new Map<string, OutletPriceRow>();

            for (const p of d.prices) {
                allVariantNames.add(p.name);
                map.set(p.name, p);
            }

            byOutlet.set(d.outlet_id, map);
        }

        const rows = [...allVariantNames].sort();

        return { rows, byOutlet };
    }, [data]);

    if (loading) {
        return (
            <div className="rounded-lg border border-border bg-white p-4">
                <SkeletonList count={5} />
            </div>
        );
    }

    const outletNames = outletIds.map(
        (id) => outlets.find((o) => o.id === id)?.name ?? `Outlet ${id}`,
    );

    return (
        <div
            className="rounded-lg border border-border bg-white p-4"
            aria-label="Perbandingan harga antar outlet"
        >
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text">
                    Membandingkan: {outletNames.join('  |  ')}
                </h2>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                >
                    <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    Tutup
                </Button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border text-left text-xs font-medium text-text-muted">
                            <th className="sticky left-0 bg-white pr-4 pb-2">
                                Variant
                            </th>
                            {outletIds.map((id) => (
                                <th key={id} className="pr-4 pb-2">
                                    {outlets.find((o) => o.id === id)?.name ??
                                        '-'}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {matrix.rows.map((variantName) => (
                            <tr
                                key={variantName}
                                className="border-b border-border/50"
                            >
                                <td className="sticky left-0 bg-white py-2 pr-4 font-medium text-text">
                                    {variantName}
                                </td>
                                {outletIds.map((outletId) => {
                                    const row = matrix.byOutlet
                                        .get(outletId)
                                        ?.get(variantName);

                                    if (!row) {
                                        return (
                                            <td
                                                key={outletId}
                                                className="py-2 pr-4 text-text-muted"
                                            >
                                                -
                                            </td>
                                        );
                                    }

                                    return (
                                        <td
                                            key={outletId}
                                            className={`py-2 pr-4 ${row.has_override ? 'bg-amber-50' : ''}`}
                                        >
                                            <div className="font-semibold text-text tabular-nums">
                                                {formatCurrency(
                                                    row.selling_price,
                                                )}
                                            </div>
                                            <div
                                                className={`text-xs font-medium tabular-nums ${marginColor(row.margin, row.selling_price)}`}
                                            >
                                                {formatCurrency(row.margin)}
                                            </div>
                                            {row.has_override && (
                                                <StatusBadge
                                                    variant="info"
                                                    size="sm"
                                                >
                                                    Override
                                                </StatusBadge>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
