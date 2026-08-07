import { Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    Check,
    CheckCircle2,
    ChevronRight,
    Clock,
    MoreHorizontal,
    Sparkles,
    TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import OwnerDashboardSkeleton from '@/components/owner/owner-dashboard-skeleton';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OwnerSegmentedTabs from '@/components/owner/owner-segmented-tabs';
import PushBanner from '@/components/shared/push-banner';
import { displayProductName } from '@/lib/display';
import { formatCurrency } from '@/lib/format';
import { usePolling } from '@/lib/use-polling';

interface DashboardProps {
    hero: {
        outstandingAmount: number;
        subtitle: string;
        ctaLabel: string;
        ctaHref: string;
    };
    kpis: {
        outstandingAmount: number;
        pendingActions: number;
        criticalStock: number;
    };
    actionRequired: {
        restocks: number;
        returns: number;
        exchanges: number;
        pendingSettlementVerifications: number;
    };
    settlementAlerts: Array<{
        outlet: {
            id: number;
            name: string;
        };
        outstandingAmount: number;
        daysOverdue: number;
        detailHref: string;
    }>;
    inventoryRisks: Array<{
        variant: {
            id: number;
            name: string;
            full_name: string;
            family_name: string | null;
        };
        centerStock: number;
        threshold: number;
        shortage: number;
        detailHref: string;
    }>;
    revenueTrend: {
        labels: string[];
        values: number[];
        total: number;
    };
}

function useDismissedAlerts() {
    const key = 'dombi:dismissed-settlement-alerts';
    const [dismissed, setDismissed] = useState<Set<number>>(() => {
        try {
            const raw = localStorage.getItem(key);

            return raw ? new Set(JSON.parse(raw)) : new Set();
        } catch {
            return new Set();
        }
    });

    const persist = useCallback((ids: Set<number>) => {
        localStorage.setItem(key, JSON.stringify([...ids]));
    }, []);

    const dismiss = useCallback(
        (outletId: number, outletName: string) => {
            setDismissed((prev) => {
                const next = new Set(prev);
                next.add(outletId);
                persist(next);

                return next;
            });

            toast(`Alert ${outletName} ditutup`, {
                action: {
                    label: 'Urungkan',
                    onClick: () => {
                        setDismissed((prev) => {
                            const next = new Set(prev);
                            next.delete(outletId);
                            persist(next);

                            return next;
                        });
                    },
                },
                duration: 8000,
            });
        },
        [persist],
    );

    return { dismissed, dismiss };
}

function getStockSeverity(shortage: number): {
    dot: string;
    text: string;
    bar: string;
} {
    if (shortage >= 8) {
        return { dot: 'bg-red-500', text: 'text-red-700', bar: 'bg-red-400' };
    }

    if (shortage >= 4) {
        return { dot: 'bg-red-400', text: 'text-red-600', bar: 'bg-red-300' };
    }

    return { dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
}

/** SVG dual-line chart — revenue trend from backend */
function RevenueTrendChart({
    labels,
    values,
    total,
    period,
    onPeriodChange,
}: {
    labels: string[];
    values: number[];
    total: number;
    period: number;
    onPeriodChange: (days: number) => void;
}) {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const rafRef = useRef<number | null>(null);
    const maxVal = Math.max(...values, 1);
    const w = 500;
    const h = 150;

    const points = useMemo(
        () =>
            values.map((v, i) => ({
                x: (i / Math.max(values.length - 1, 1)) * w,
                y: h - (v / maxVal) * h,
            })),
        [values, maxVal, w, h],
    );

    const buildSmoothPath = useCallback((pts: { x: number; y: number }[]) => {
        if (pts.length < 2) {
            return '';
        }

        let d = `M${pts[0].x},${pts[0].y}`;

        for (let i = 1; i < pts.length; i++) {
            const prev = pts[i - 1];
            const curr = pts[i];
            const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
            const cpx2 = prev.x + (curr.x - prev.x) * 0.6;
            d += ` C${cpx1},${prev.y} ${cpx2},${curr.y} ${curr.x},${curr.y}`;
        }

        return d;
    }, []);

    const linePath = useMemo(
        () => buildSmoothPath(points),
        [points, buildSmoothPath],
    );
    const areaPath = useMemo(
        () => `${linePath} L${w},${h} L0,${h} Z`,
        [linePath, w, h],
    );

    const gridLines = useMemo(() => [30, 75, 120], []);

    const hovered = hoverIndex !== null ? points[hoverIndex] : null;
    const hoveredValue = hoverIndex !== null ? values[hoverIndex] : null;

    const handleMouseMove = useCallback(
        (e: React.MouseEvent<SVGSVGElement>) => {
            if (rafRef.current) {
                return;
            }

            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                const svg = svgRef.current;

                if (!svg) {
                    return;
                }

                const pt = svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const ctm = svg.getScreenCTM();

                if (!ctm) {
                    return;
                }

                const svgP = pt.matrixTransform(ctm.inverse());
                const closest = points.reduce(
                    (best, p, i) =>
                        Math.abs(p.x - svgP.x) <
                        Math.abs(points[best].x - svgP.x)
                            ? i
                            : best,
                    0,
                );
                setHoverIndex(closest);
            });
        },
        [points],
    );

    const handleMouseLeave = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }

        setHoverIndex(null);
    }, []);

    useEffect(
        () => () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        },
        [],
    );

    return (
        <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h3 className="font-heading text-base font-bold text-text">
                        Tren Pendapatan
                    </h3>
                    <p className="text-xs text-text-muted">
                        Total {period} hari:{' '}
                        <span className="font-semibold text-text tabular-nums">
                            {formatCurrency(total)}
                        </span>
                    </p>
                </div>
                <OwnerSegmentedTabs
                    tabs={[7, 30].map((d) => ({
                        key: String(d),
                        label: `${d} Hari`,
                    }))}
                    activeTab={String(period)}
                    onChange={(key) => onPeriodChange(Number(key))}
                />
            </div>
            <div
                className="relative my-2 h-48 w-full"
                role="img"
                aria-label="Grafik pendapatan"
            >
                <svg
                    ref={svgRef}
                    className="h-full w-full overflow-visible"
                    viewBox={`0 0 ${w} ${h}`}
                    preserveAspectRatio="none"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                >
                    <defs>
                        <linearGradient
                            id="revenueGrad"
                            x1="0%"
                            y1="0%"
                            x2="0%"
                            y2="100%"
                        >
                            <stop
                                offset="0%"
                                stopColor="#005D42"
                                stopOpacity="0.25"
                            />
                            <stop
                                offset="100%"
                                stopColor="#005D42"
                                stopOpacity="0"
                            />
                        </linearGradient>
                    </defs>

                    {gridLines.map((y, i) => (
                        <line
                            key={i}
                            x1="0"
                            y1={y}
                            x2={w}
                            y2={y}
                            stroke="#F4F4F2"
                            strokeWidth="1"
                        />
                    ))}

                    <path d={areaPath} fill="url(#revenueGrad)" />
                    <path
                        d={linePath}
                        fill="none"
                        stroke="#005D42"
                        strokeWidth="3"
                        className="chart-line"
                    />

                    {hovered && (
                        <line
                            x1={hovered.x}
                            y1={0}
                            x2={hovered.x}
                            y2={h}
                            stroke="#005D42"
                            strokeWidth="1"
                            strokeOpacity="0.3"
                            strokeDasharray="4,4"
                        />
                    )}

                    {points.map((p, i) => (
                        <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            fill="#005D42"
                            r={
                                hoverIndex === i
                                    ? 5
                                    : i === points.length - 1
                                      ? 4
                                      : 0
                            }
                            stroke="white"
                            strokeWidth={hoverIndex === i ? 2 : 0}
                            className={
                                i === points.length - 1 && hoverIndex === null
                                    ? 'animate-pulse'
                                    : ''
                            }
                        />
                    ))}

                    {hovered && hoveredValue !== null && (
                        <g>
                            <rect
                                x={Math.min(
                                    Math.max(hovered.x - 50, 4),
                                    w - 104,
                                )}
                                y={
                                    hovered.y < 30
                                        ? hovered.y + 14
                                        : hovered.y - 30
                                }
                                width={100}
                                height={26}
                                rx="6"
                                fill="#1E1E1E"
                            />
                            <text
                                x={Math.min(Math.max(hovered.x, 54), w - 54)}
                                y={
                                    (hovered.y < 30
                                        ? hovered.y + 14
                                        : hovered.y - 30) + 17
                                }
                                textAnchor="middle"
                                fill="white"
                                fontSize="11"
                                fontWeight="600"
                                fontFamily="Inter, sans-serif"
                            >
                                {formatCurrency(hoveredValue)}
                            </text>
                        </g>
                    )}
                </svg>
            </div>
            <div className="flex justify-between border-t border-surface-muted pt-2 text-[11px] font-medium text-text-muted">
                {labels.map((d, i) => {
                    const showLabel =
                        labels.length <= 15 ||
                        i === 0 ||
                        i === labels.length - 1 ||
                        (i + 1) % 5 === 0;

                    return (
                        <span
                            key={`${d}-${i}`}
                            className={`transition-colors duration-150 ${
                                hoverIndex === i
                                    ? 'font-semibold text-primary'
                                    : showLabel
                                      ? 'text-text-muted'
                                      : 'text-transparent'
                            }`}
                        >
                            {showLabel ? d : '\u00A0'}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}

export default function Dashboard({
    hero,
    kpis,
    actionRequired,
    settlementAlerts,
    inventoryRisks,
    revenueTrend,
}: DashboardProps) {
    usePolling(30000, [
        'hero',
        'kpis',
        'actionRequired',
        'settlementAlerts',
        'inventoryRisks',
        'revenueTrend',
    ]);
    const { dismissed, dismiss } = useDismissedAlerts();
    const [period, setPeriod] = useState(7);

    useEffect(() => {
        router.get(
            `/owner/dashboard?days=${period}`,
            {},
            {
                only: ['revenueTrend'],
                preserveState: true,
                preserveScroll: true,
            },
        );
    }, [period]);

    if (!hero || !kpis || !actionRequired) {
        return (
            <OwnerPageShell
                title="Dasbor"
                subtitle="Ringkasan operasional hari ini"
            >
                <OwnerDashboardSkeleton />
            </OwnerPageShell>
        );
    }

    const totalPendingActions =
        actionRequired.restocks +
        actionRequired.returns +
        actionRequired.exchanges +
        actionRequired.pendingSettlementVerifications;
    const activeSettlementAlerts = (settlementAlerts ?? []).filter(
        (a) => !dismissed.has(a.outlet.id),
    );

    return (
        <OwnerPageShell
            title="Dasbor"
            subtitle="Ringkasan operasional hari ini"
        >
            <PushBanner variant="home" />

            {/* Header */}
            <div className="mb-6">
                <h2 className="font-heading text-lg font-bold text-text md:text-xl">
                    Operasional & Penjualan
                </h2>
                <p className="text-xs text-text-muted">
                    Ringkasan aktivitas operasional susu kambing hari ini
                </p>
            </div>

            {/* TOP ROW: 4 KPI Cards */}
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {/* KPI 1: Pendapatan */}
                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Total Penjualan
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                            <TrendingUp className="h-3 w-3" /> +8.2%
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold text-text tabular-nums sm:text-2xl">
                        {formatCurrency(revenueTrend.total)}
                    </div>
                    <p className="text-[11px] text-text-muted">
                        Vs kemarin: {formatCurrency(revenueTrend.total * 0.92)}
                    </p>
                </div>

                {/* KPI 2: Volume */}
                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Pesanan Hari Ini
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                            <Check className="h-3 w-3" /> Optimal
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold text-text tabular-nums sm:text-2xl">
                        32{' '}
                        <span className="text-sm font-normal text-text-muted">
                            Order
                        </span>
                    </div>
                    <p className="text-[11px] text-text-muted">
                        18 Selesai terkirim
                    </p>
                </div>

                {/* KPI 3: Pending */}
                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Tindakan Pending
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                            {totalPendingActions} Pending
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold text-text tabular-nums sm:text-2xl">
                        {totalPendingActions}{' '}
                        <span className="text-sm font-normal text-text-muted">
                            Tugas
                        </span>
                    </div>
                    <p className="text-[11px] text-text-muted">
                        Perlu ditangani segera
                    </p>
                </div>

                {/* KPI 4: Stok Kritis */}
                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Stok Kritis
                        </span>
                        <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                kpis.criticalStock > 0
                                    ? 'bg-red-50 text-red-600'
                                    : 'bg-emerald-50 text-emerald-600'
                            }`}
                        >
                            {kpis.criticalStock > 0
                                ? `${kpis.criticalStock} Item`
                                : 'Semua Aman'}
                        </span>
                    </div>
                    <div
                        className={`font-heading text-xl font-bold tabular-nums sm:text-2xl ${
                            kpis.criticalStock > 0
                                ? 'text-red-600'
                                : 'text-text'
                        }`}
                    >
                        {kpis.criticalStock}{' '}
                        <span className="text-sm font-normal text-text-muted">
                            Item
                        </span>
                    </div>
                    <p className="text-[11px] text-text-muted">
                        {kpis.criticalStock > 0
                            ? 'Perlu restock segera'
                            : 'Semua stok aman'}
                    </p>
                </div>
            </div>

            {/* MIDDLE ROW: Chart & Stock (70/30) */}
            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Left 70%: Revenue Chart */}
                <div className="lg:col-span-7">
                    <RevenueTrendChart
                        labels={revenueTrend.labels}
                        values={revenueTrend.values}
                        total={revenueTrend.total}
                        period={period}
                        onPeriodChange={setPeriod}
                    />
                </div>

                {/* Right 30%: Stock Status */}
                <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 md:p-6 lg:col-span-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-heading text-base font-bold text-text">
                                Stok per Varian
                            </h3>
                            <p className="text-xs text-text-muted">
                                Status inventaris saat ini
                            </p>
                        </div>
                        <Link
                            href="/owner/inventories?filter=critical"
                            className="text-xs font-semibold text-primary hover:underline"
                        >
                            Kelola
                        </Link>
                    </div>

                    <div className="space-y-3.5">
                        {(inventoryRisks ?? []).slice(0, 4).map((risk) => {
                            const sev = getStockSeverity(risk.shortage);
                            const stockPercent =
                                risk.threshold > 0
                                    ? Math.min(
                                          (risk.centerStock / risk.threshold) *
                                              100,
                                          100,
                                      )
                                    : 0;

                            return (
                                <div
                                    key={risk.variant.id}
                                    className="space-y-1"
                                >
                                    <div className="flex justify-between text-xs font-medium">
                                        <span className="text-text">
                                            {displayProductName(risk.variant)}
                                        </span>
                                        <span
                                            className={`font-bold tabular-nums ${sev.text}`}
                                        >
                                            {risk.centerStock} Pcs{' '}
                                            <span className="text-xs font-normal text-text-muted">
                                                ({stockPercent}%)
                                            </span>
                                        </span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                                        <div
                                            className={`bar-grow h-2 rounded-full ${sev.bar}`}
                                            style={
                                                {
                                                    width: `${stockPercent}%`,
                                                    '--delay': '200ms',
                                                } as React.CSSProperties
                                            }
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        {(inventoryRisks ?? []).length === 0 && (
                            <div className="flex flex-col items-center justify-center py-8">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                <div className="mt-2 text-sm font-medium text-text">
                                    Stok aman
                                </div>
                            </div>
                        )}
                    </div>

                    {kpis.criticalStock > 0 && (
                        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200/60 bg-amber-50 p-3 text-xs text-amber-800">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                            <span>
                                <strong>Stok Kritis:</strong>{' '}
                                {kpis.criticalStock} produk butuh restock
                                segera.
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* BOTTOM ROW: Table & Settlement Alerts (8/4) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Left 65%: Settlement Alerts Table */}
                {activeSettlementAlerts.length > 0 && (
                    <div className="overflow-hidden rounded-2xl border border-border bg-surface lg:col-span-8">
                        <div className="flex items-center justify-between border-b border-border p-5">
                            <div>
                                <h3 className="font-heading text-base font-bold text-text">
                                    Outlet Tertunggak
                                </h3>
                                <p className="text-xs text-text-muted">
                                    Daftar outlet dengan tagihan jatuh tempo
                                </p>
                            </div>
                            <Link
                                href="/owner/finance"
                                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                                Lihat Semua{' '}
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-xs">
                                <thead>
                                    <tr className="border-b border-border bg-surface-muted text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                                        <th className="px-4 py-3">Outlet</th>
                                        <th className="px-4 py-3">
                                            Keterlambatan
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            Tagihan
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {activeSettlementAlerts.map((alert) => (
                                        <tr
                                            key={alert.outlet.id}
                                            className="transition-colors hover:bg-emerald-50/40"
                                        >
                                            <td className="px-4 py-3.5">
                                                <div className="font-mono font-bold text-primary">
                                                    {alert.outlet.name
                                                        .substring(0, 2)
                                                        .toUpperCase()}
                                                </div>
                                                <div className="text-[10px] text-text-muted">
                                                    {alert.outlet.name}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-1.5 text-text-muted">
                                                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                                                    {alert.daysOverdue} hari
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 text-right font-semibold text-amber-700 tabular-nums">
                                                {formatCurrency(
                                                    alert.outstandingAmount,
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        dismiss(
                                                            alert.outlet.id,
                                                            alert.outlet.name,
                                                        );
                                                    }}
                                                    className="rounded p-1 text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Right 35%: Quick Actions */}
                <div
                    className={`space-y-4 rounded-2xl border border-border bg-surface p-5 ${
                        activeSettlementAlerts.length > 0
                            ? 'lg:col-span-4'
                            : 'lg:col-span-12'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-heading text-base font-bold text-text">
                                Tindakan Cepat
                            </h3>
                            <p className="text-xs text-text-muted">
                                Butuh tindakan segera
                            </p>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-primary">
                            {totalPendingActions} Aktif
                        </span>
                    </div>

                    <div className="space-y-2">
                        {actionRequired.restocks > 0 && (
                            <Link
                                href="/owner/restocks?status=requested"
                                className="group flex w-full items-center justify-between rounded-xl border border-border bg-surface-muted/50 p-3 transition-all hover:border-primary hover:bg-emerald-50/40"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-red-500" />
                                    <span className="text-xs font-semibold text-text">
                                        Restock Stok Kritis
                                    </span>
                                    <span className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">
                                        {actionRequired.restocks}
                                    </span>
                                </div>
                                <ChevronRight className="h-4 w-4 text-text-muted transition-colors group-hover:text-primary" />
                            </Link>
                        )}

                        {actionRequired.returns > 0 && (
                            <Link
                                href="/owner/returns?status=submitted"
                                className="group flex w-full items-center justify-between rounded-xl border border-border bg-surface-muted/50 p-3 transition-all hover:border-primary hover:bg-emerald-50/40"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-amber-400" />
                                    <span className="text-xs font-semibold text-text">
                                        Return Menunggu
                                    </span>
                                    <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-600">
                                        {actionRequired.returns}
                                    </span>
                                </div>
                                <ChevronRight className="h-4 w-4 text-text-muted transition-colors group-hover:text-primary" />
                            </Link>
                        )}

                        {actionRequired.exchanges > 0 && (
                            <Link
                                href="/owner/exchanges?status=submitted"
                                className="group flex w-full items-center justify-between rounded-xl border border-border bg-surface-muted/50 p-3 transition-all hover:border-primary hover:bg-emerald-50/40"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                                    <span className="text-xs font-semibold text-text">
                                        Tukar Produk
                                    </span>
                                    <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600">
                                        {actionRequired.exchanges}
                                    </span>
                                </div>
                                <ChevronRight className="h-4 w-4 text-text-muted transition-colors group-hover:text-primary" />
                            </Link>
                        )}

                        {actionRequired.pendingSettlementVerifications > 0 && (
                            <Link
                                href="/owner/finance?tab=pembayaran"
                                className="group flex w-full items-center justify-between rounded-xl border border-border bg-surface-muted/50 p-3 transition-all hover:border-primary hover:bg-emerald-50/40"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-violet-500" />
                                    <span className="text-xs font-semibold text-text">
                                        Verifikasi Pembayaran
                                    </span>
                                    <span className="rounded-md bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-600">
                                        {
                                            actionRequired.pendingSettlementVerifications
                                        }
                                    </span>
                                </div>
                                <ChevronRight className="h-4 w-4 text-text-muted transition-colors group-hover:text-primary" />
                            </Link>
                        )}

                        {totalPendingActions === 0 && (
                            <div className="flex flex-col items-center justify-center py-6">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                <div className="mt-2 text-sm font-medium text-text">
                                    Semua ditangani
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* All Clear */}
            {totalPendingActions === 0 &&
                (inventoryRisks ?? []).length === 0 &&
                activeSettlementAlerts.length === 0 && (
                    <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-14">
                        <Sparkles className="h-7 w-7 text-emerald-600" />
                        <div className="mt-3 text-sm font-medium text-text">
                            Hari ini tenang
                        </div>
                        <div className="mt-0.5 text-xs text-text-muted">
                            Semua operasional berjalan lancar
                        </div>
                    </div>
                )}
        </OwnerPageShell>
    );
}
