import { Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    Package,
    RotateCcw,
    ArrowLeftRight,
    CreditCard,
    ChevronRight,
    CheckCircle2,
    Clock,
    Sparkles,
    ArrowRight,
    Receipt,
    ShieldAlert,
    Layers,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import OwnerDashboardSkeleton from '@/components/owner/owner-dashboard-skeleton';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
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

function getGreeting(): string {
    const hour = new Date().getHours();

    if (hour < 11) {
        return 'Selamat Pagi';
    }

    if (hour < 15) {
        return 'Selamat Siang';
    }

    if (hour < 18) {
        return 'Selamat Sore';
    }

    return 'Selamat Malam';
}

interface ActionItem {
    key: string;
    href: string;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    dotColor: string;
    label: string;
    count: number;
    suffix: string;
    urgency: number;
}

/** SVG area chart — revenue trend from backend, optimized */
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
    const w = 700;
    const h = 200;
    const padTop = 20;
    const padBottom = 10;
    const chartH = h - padTop - padBottom;

    const points = useMemo(
        () =>
            values.map((v, i) => ({
                x: (i / Math.max(values.length - 1, 1)) * w,
                y: padTop + chartH - (v / maxVal) * chartH,
            })),
        [values, maxVal, w, chartH, padTop],
    );

    // Smooth cubic bezier curve
    const buildSmoothPath = useCallback((pts: { x: number; y: number }[]) => {
        if (pts.length < 2) return '';
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

    // Grid lines (4 horizontal)
    const gridLines = useMemo(
        () => [0, 0.25, 0.5, 0.75].map((pct) => padTop + chartH * (1 - pct)),
        [padTop, chartH],
    );

    // Tooltip position
    const hovered = hoverIndex !== null ? points[hoverIndex] : null;
    const hoveredValue = hoverIndex !== null ? values[hoverIndex] : null;

    // Throttled mouse move via RAF — uses SVG getScreenCTM for accurate mapping
    const handleMouseMove = useCallback(
        (e: React.MouseEvent<SVGSVGElement>) => {
            if (rafRef.current) return;
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                const svg = svgRef.current;
                if (!svg) return;
                const pt = svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const ctm = svg.getScreenCTM();
                if (!ctm) return;
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
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        },
        [],
    );

    return (
        <div className="overflow-hidden rounded-xl bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-border/30 px-6 py-5">
                <div>
                    <h3 className="text-base font-semibold text-text">
                        Tren Pendapatan
                    </h3>
                    <p className="mt-0.5 text-xs text-text-muted">
                        Total {period} hari:{' '}
                        <span className="font-semibold text-text tabular-nums">
                            {formatCurrency(total)}
                        </span>
                    </p>
                </div>
                <div className="bg-mint-wash flex rounded-lg p-1">
                    {[7, 30].map((d) => (
                        <button
                            key={d}
                            onClick={() => onPeriodChange(d)}
                            className={`rounded px-4 py-1.5 text-[12px] font-semibold transition-all duration-200 ${
                                period === d
                                    ? 'bg-white text-primary shadow-sm'
                                    : 'text-text-muted hover:text-primary'
                            }`}
                        >
                            {d} Hari
                        </button>
                    ))}
                </div>
            </div>
            <div className="p-6">
                <div className="relative h-52 w-full overflow-visible">
                    <svg
                        ref={svgRef}
                        className="h-full w-full cursor-crosshair overflow-visible"
                        viewBox={`0 0 ${w} ${h}`}
                        preserveAspectRatio="xMidYMid meet"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                    >
                        <defs>
                            <linearGradient
                                id="revenueGrad"
                                x1="0"
                                x2="0"
                                y1="0"
                                y2="1"
                            >
                                <stop
                                    offset="5%"
                                    stop-color="#0D9488"
                                    stop-opacity="0.15"
                                />
                                <stop
                                    offset="95%"
                                    stop-color="#0D9488"
                                    stop-opacity="0"
                                />
                            </linearGradient>
                        </defs>

                        {/* Grid lines */}
                        {gridLines.map((y, i) => (
                            <line
                                key={i}
                                x1="0"
                                y1={y}
                                x2={w}
                                y2={y}
                                stroke="#E5E5E5"
                                strokeWidth="1"
                                strokeDasharray={i === 0 ? 'none' : '4,4'}
                            />
                        ))}

                        {/* Area fill */}
                        <path d={areaPath} fill="url(#revenueGrad)" />

                        {/* Line */}
                        <path
                            d={linePath}
                            fill="none"
                            stroke="#0D9488"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="chart-line"
                        />

                        {/* Hover vertical line */}
                        {hovered && (
                            <line
                                x1={hovered.x}
                                y1={padTop}
                                x2={hovered.x}
                                y2={h - padBottom}
                                stroke="#0D9488"
                                strokeWidth="1"
                                strokeOpacity="0.3"
                                strokeDasharray="4,4"
                            />
                        )}

                        {/* Data points */}
                        {points.map((p, i) => (
                            <circle
                                key={i}
                                cx={p.x}
                                cy={p.y}
                                fill="#0D9488"
                                r={
                                    hoverIndex === i
                                        ? 6
                                        : i === points.length - 1
                                          ? 5
                                          : 3
                                }
                                stroke="white"
                                strokeWidth={hoverIndex === i ? 3 : 0}
                                className={
                                    i === points.length - 1 &&
                                    hoverIndex === null
                                        ? 'animate-pulse'
                                        : ''
                                }
                                style={{
                                    transition:
                                        'r 120ms ease-out, stroke-width 120ms ease-out',
                                }}
                            />
                        ))}

                        {/* Tooltip */}
                        {hovered &&
                            hoveredValue !== null &&
                            (() => {
                                const tooltipW = 100;
                                const tooltipH = 26;
                                const tooltipX = Math.min(
                                    Math.max(hovered.x - tooltipW / 2, 4),
                                    w - tooltipW - 4,
                                );
                                // Flip below if near top (padTop + tooltipH + 10 margin)
                                const nearTop =
                                    hovered.y < padTop + tooltipH + 14;
                                const tooltipY = nearTop
                                    ? hovered.y + 14
                                    : hovered.y - tooltipH - 8;

                                return (
                                    <g>
                                        <rect
                                            x={tooltipX}
                                            y={tooltipY}
                                            width={tooltipW}
                                            height={tooltipH}
                                            rx="6"
                                            fill="#1A1A1A"
                                        />
                                        <text
                                            x={tooltipX + tooltipW / 2}
                                            y={tooltipY + 17}
                                            textAnchor="middle"
                                            fill="white"
                                            fontSize="11"
                                            fontWeight="600"
                                            fontFamily="Poppins, sans-serif"
                                        >
                                            {formatCurrency(hoveredValue)}
                                        </text>
                                    </g>
                                );
                            })()}
                    </svg>
                </div>
                <div className="mt-3 flex justify-between px-0">
                    {labels.map((d, i) => (
                        <span
                            key={`${d}-${i}`}
                            className={`text-[11px] font-medium transition-colors duration-150 ${hoverIndex === i ? 'font-semibold text-primary' : 'text-text-muted'}`}
                        >
                            {d}
                        </span>
                    ))}
                </div>
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
    const greeting = useMemo(() => getGreeting(), []);
    const [period, setPeriod] = useState(7);

    // Refetch revenue trend when period changes
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

    const actionItems: ActionItem[] = [];

    if (actionRequired.restocks > 0) {
        actionItems.push({
            key: 'restocks',
            href: '/owner/restocks?status=requested',
            icon: <Package className="h-4 w-4" />,
            iconBg: 'bg-red-50',
            iconColor: 'text-red-600',
            dotColor: 'bg-red-500',
            label: 'Restock Stok Kritis',
            count: actionRequired.restocks,
            suffix: 'menunggu',
            urgency: 1,
        });
    }

    if (actionRequired.returns > 0) {
        actionItems.push({
            key: 'returns',
            href: '/owner/returns?status=submitted',
            icon: <RotateCcw className="h-4 w-4" />,
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
            dotColor: 'bg-amber-400',
            label: 'Return Menunggu',
            count: actionRequired.returns,
            suffix: 'menunggu',
            urgency: 2,
        });
    }

    if (actionRequired.exchanges > 0) {
        actionItems.push({
            key: 'exchanges',
            href: '/owner/exchanges?status=submitted',
            icon: <ArrowLeftRight className="h-4 w-4" />,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            dotColor: 'bg-blue-500',
            label: 'Tukar Produk',
            count: actionRequired.exchanges,
            suffix: 'menunggu',
            urgency: 3,
        });
    }

    if (actionRequired.pendingSettlementVerifications > 0) {
        actionItems.push({
            key: 'settlements',
            href: '/owner/finance?tab=pembayaran',
            icon: <CreditCard className="h-4 w-4" />,
            iconBg: 'bg-violet-50',
            iconColor: 'text-violet-600',
            dotColor: 'bg-violet-500',
            label: 'Verifikasi Pembayaran',
            count: actionRequired.pendingSettlementVerifications,
            suffix: 'menunggu',
            urgency: 4,
        });
    }

    actionItems.sort((a, b) => a.urgency - b.urgency);

    return (
        <OwnerPageShell
            title="Dasbor"
            subtitle="Ringkasan operasional hari ini"
        >
            {/* Greeting */}
            <div className="mb-10">
                <h2 className="text-[32px] leading-tight font-bold tracking-tight text-primary">
                    {greeting}, Pemilik
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                    Berikut ringkasan kinerja bisnis Dombi Anda hari ini.
                </p>
            </div>

            {/* KPI Cards */}
            <OwnerKpiStrip
                items={[
                    {
                        label: 'Tagihan Tertunggak',
                        value: formatCurrency(kpis.outstandingAmount),
                        icon: <Receipt className="h-6 w-6" />,
                        accentColor: '#006a61',
                        href: '/owner/finance',
                        sublabel: `${(settlementAlerts ?? []).length} outlet`,
                        sublabelColor: 'text-text-muted',
                    },
                    {
                        label: 'Tindakan Pending',
                        value: totalPendingActions,
                        icon: <ShieldAlert className="h-6 w-6" />,
                        accentColor: '#00338d',
                        href: '#actions',
                        trend:
                            totalPendingActions > 0
                                ? {
                                      direction: 'up',
                                      value: `+${totalPendingActions}`,
                                      label: 'perlu ditangani',
                                      positive: false,
                                  }
                                : undefined,
                    },
                    {
                        label: 'Stok Kritis',
                        value: kpis.criticalStock,
                        valueClassName:
                            kpis.criticalStock > 0
                                ? 'text-red-600'
                                : 'text-text',
                        icon: <Layers className="h-6 w-6" />,
                        accentColor:
                            kpis.criticalStock > 0 ? '#DC2626' : '#16A34A',
                        href: '/owner/inventories?filter=critical',
                        trend:
                            kpis.criticalStock > 0
                                ? {
                                      direction: 'down',
                                      value: `+${kpis.criticalStock} item`,
                                      label: 'perlu restock',
                                      positive: false,
                                  }
                                : undefined,
                        sublabel:
                            kpis.criticalStock === 0 ? 'Semua aman' : undefined,
                        sublabelColor: 'text-emerald-600',
                    },
                ]}
            />

            {/* 70/30 Split — Stitch layout */}
            <section className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-10">
                {/* Left: Tren Pendapatan (70%) */}
                <div className="lg:col-span-7">
                    <RevenueTrendChart
                        labels={revenueTrend.labels}
                        values={revenueTrend.values}
                        total={revenueTrend.total}
                        period={period}
                        onPeriodChange={setPeriod}
                    />
                </div>

                {/* Right: Stok Kritis + Tindakan Cepat (30%) */}
                <div className="space-y-6 lg:col-span-3">
                    {/* Stok Kritis */}
                    <div className="overflow-hidden rounded-xl bg-surface shadow-card">
                        <div className="flex items-center justify-between border-b border-border/30 px-6 py-5">
                            <h3 className="text-base font-semibold text-text">
                                Stok Kritis
                            </h3>
                            {(inventoryRisks ?? []).length > 0 && (
                                <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-600">
                                    {inventoryRisks.length}
                                </span>
                            )}
                        </div>
                        <div className="space-y-3 p-4">
                            {(inventoryRisks ?? []).slice(0, 5).map((risk) => {
                                const sev = getStockSeverity(risk.shortage);
                                const stockPercent =
                                    risk.threshold > 0
                                        ? Math.min(
                                              (risk.centerStock /
                                                  risk.threshold) *
                                                  100,
                                              100,
                                          )
                                        : 0;

                                return (
                                    <div key={risk.variant.id}>
                                        <Link
                                            href={risk.detailHref}
                                            className="block"
                                        >
                                            <div className="mb-1.5 flex justify-between text-xs font-medium">
                                                <span className="truncate text-text">
                                                    {displayProductName(
                                                        risk.variant,
                                                    )}
                                                </span>
                                                <span
                                                    className={`font-semibold tabular-nums ${sev.text}`}
                                                >
                                                    {risk.centerStock} unit
                                                </span>
                                            </div>
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                                                <div
                                                    className={`bar-grow h-full rounded-full ${sev.bar}`}
                                                    style={
                                                        {
                                                            width: `${stockPercent}%`,
                                                            '--delay': '200ms',
                                                        } as React.CSSProperties
                                                    }
                                                />
                                            </div>
                                        </Link>
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
                        {(inventoryRisks ?? []).length > 5 && (
                            <div className="px-4 pb-4">
                                <Link
                                    href="/owner/inventories?filter=critical"
                                    className="hover:bg-mint-wash flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold text-primary transition-colors"
                                >
                                    Lihat semua {inventoryRisks.length} item
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Tindakan Cepat — compact */}
                    <div className="overflow-hidden rounded-xl bg-surface shadow-card">
                        <div className="border-b border-border/30 px-6 py-5">
                            <h3 className="text-base font-semibold text-text">
                                Tindakan Cepat
                            </h3>
                        </div>
                        <div className="space-y-1.5 p-3">
                            {actionItems.map((item) => (
                                <Link
                                    key={item.key}
                                    href={item.href}
                                    className="hover:bg-mint-wash group flex w-full items-center justify-between rounded-lg border border-border/30 p-3 transition-all hover:border-primary active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`h-2 w-2 rounded-full ${item.dotColor}`}
                                        ></span>
                                        <span className="text-sm font-medium text-text">
                                            {item.label}
                                        </span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-text-muted transition-colors group-hover:text-primary" />
                                </Link>
                            ))}
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
            </section>

            {/* Settlement Alerts — table */}
            {activeSettlementAlerts.length > 0 && (
                <section className="mb-8 overflow-hidden rounded-xl bg-surface shadow-card">
                    <div className="flex items-center justify-between border-b border-border/30 px-6 py-5">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-text">
                                Outlet Tertunggak
                            </h3>
                            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                                {activeSettlementAlerts.length}
                            </span>
                        </div>
                        <Link
                            href="/owner/finance"
                            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                            Lihat Semua <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="bg-surface-muted/50">
                                    <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                                        Outlet
                                    </th>
                                    <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                                        Keterlambatan
                                    </th>
                                    <th className="px-6 py-3 text-right text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                                        Tagihan
                                    </th>
                                    <th className="px-6 py-3 text-center text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                                {activeSettlementAlerts.map((alert) => (
                                    <tr
                                        key={alert.outlet.id}
                                        className="hover:bg-mint-wash group cursor-pointer transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">
                                                    {alert.outlet.name
                                                        .substring(0, 2)
                                                        .toUpperCase()}
                                                </div>
                                                <span className="text-sm font-medium text-text">
                                                    {alert.outlet.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-sm text-text-muted">
                                                <Clock className="h-3.5 w-3.5 text-amber-500" />
                                                {alert.daysOverdue} hari
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-semibold text-amber-700 tabular-nums">
                                                {formatCurrency(
                                                    alert.outstandingAmount,
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    dismiss(
                                                        alert.outlet.id,
                                                        alert.outlet.name,
                                                    );
                                                }}
                                                className="rounded px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
                                            >
                                                Tutup
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* Alert Banner */}
            {kpis.criticalStock > 0 && (
                <div className="spring-transition mb-8 flex items-center justify-between rounded-xl bg-red-50 p-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-text">
                                {kpis.criticalStock} produk stok kritis — perlu
                                restock segera
                            </p>
                            <p className="text-xs text-text-muted">
                                Kehabisan stok dapat menyebabkan penurunan
                                pendapatan harian hingga 15%.
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/owner/inventories?filter=critical"
                        className="text-deep-emerald flex items-center gap-1 text-sm font-semibold whitespace-nowrap transition-opacity hover:opacity-80"
                    >
                        Lihat Inventaris <ChevronRight className="h-4 w-4" />
                    </Link>
                </div>
            )}

            {/* All Clear */}
            {totalPendingActions === 0 &&
                (inventoryRisks ?? []).length === 0 &&
                activeSettlementAlerts.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-xl bg-surface py-14 shadow-card">
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
