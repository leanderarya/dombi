import { Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Wallet, XCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import SectionCard from '@/components/ui/section-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OwnerKpiCard from '@/components/owner/owner-kpi-card';
import OwnerActionCard from '@/components/owner/owner-action-card';
import { settlementSeverity } from '@/lib/severity';
import type { Severity } from '@/lib/severity';

interface VerificationPayment {
    id: number;
    outlet: { id: number; name: string };
    amount: number;
    reference_number: string;
    payment_date: string;
    notes: string | null;
    created_at: string;
}

interface PriorityOutlet {
    outlet: { id: number; name: string };
    outstanding: number;
    center_share: number;
    verified_payments: number;
    pending_payments: number;
    days_overdue: number;
}

interface AgingBucket {
    label: string;
    min: number;
    max: number;
    count: number;
    amount: number;
}

interface RankedOutlet {
    outlet: { id: number; name: string };
    center_share?: number;
    outstanding?: number;
    outlet_margin?: number;
    gross_revenue?: number;
    verified_payments?: number;
    pending_payments?: number;
}

interface CollectionData {
    hero: {
        total_outstanding: number;
        total_collected: number;
        total_pending: number;
        outlets_overdue: number;
    };
    verification_queue: VerificationPayment[];
    priority_list: PriorityOutlet[];
    aging: AgingBucket[];
    rankings: {
        by_revenue: RankedOutlet[];
        by_outstanding: RankedOutlet[];
        by_margin: RankedOutlet[];
    };
}

interface Props {
    collection: CollectionData;
}

type RankingTab = 'revenue' | 'outstanding' | 'margin';

export default function SettlementCollection({ collection }: Props) {
    const { hero, verification_queue, priority_list, aging, rankings } = collection;
    const [rankingTab, setRankingTab] = useState<RankingTab>('revenue');
    const [rejectingId, setRejectingId] = useState<number | null>(null);

    const rejectForm = useForm({ rejection_reason: '' });

    const handleVerify = (paymentId: number) => {
        if (confirm('Verifikasi pembayaran ini?')) {
            router.post(`/owner/settlement-payments/${paymentId}/verify`);
        }
    };

    const handleReject = (paymentId: number) => {
        rejectForm.post(`/owner/settlement-payments/${paymentId}/reject`, {
            onSuccess: () => {
                setRejectingId(null);
                rejectForm.reset();
            },
        });
    };

    const currentRanking = rankings[`by_${rankingTab}` as keyof typeof rankings] ?? [];

    return (
        <OwnerPageShell title="Pusat Penagihan" subtitle="Kelola penagihan dari semua outlet" backHref="/owner/settlement">
            {/* Hero */}
            <section className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-6">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-red-500">Total Belum Masuk</div>
                <div className="mt-2 text-4xl font-semibold tabular-nums text-red-700">{formatCurrency(hero.total_outstanding)}</div>
                <div className="mt-1 text-sm text-red-500">Total kewajiban outlet yang belum diselesaikan.</div>
            </section>

            {/* KPI Strip */}
            <section className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <OwnerKpiCard
                    label="Belum Masuk"
                    value={formatCurrency(hero.total_outstanding)}
                    tone="danger"
                    icon={<Wallet className="h-5 w-5" />}
                />
                <OwnerKpiCard
                    label="Sudah Diterima"
                    value={formatCurrency(hero.total_collected)}
                    tone="success"
                    icon={<CheckCircle2 className="h-5 w-5" />}
                />
                <OwnerKpiCard
                    label="Menunggu Verifikasi"
                    value={formatCurrency(hero.total_pending)}
                    tone="warning"
                    icon={<Clock className="h-5 w-5" />}
                />
                <OwnerKpiCard
                    label="Outlet Menunggak"
                    value={`${hero.outlets_overdue} Outlet`}
                    tone={hero.outlets_overdue > 0 ? 'danger' : 'neutral'}
                    icon={<AlertTriangle className="h-5 w-5" />}
                />
            </section>

            {/* Two-column: Verification Queue + Aging */}
            <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                <SectionCard label="Menunggu Verifikasi" labelRight={<span className="text-[11px] font-bold text-amber-600">{verification_queue.length} Menunggu</span>}>
                    {verification_queue.length === 0 ? (
                        <div className="py-6 text-center text-sm text-zinc-400">Tidak ada pembayaran yang perlu diverifikasi.</div>
                    ) : (
                        <div className="space-y-3">
                            {verification_queue.map((payment) => (
                                <div key={payment.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="text-sm font-semibold text-slate-900">{payment.outlet.name}</div>
                                            <div className="mt-1 text-lg font-bold tabular-nums text-emerald-700">{formatCurrency(payment.amount)}</div>
                                            <div className="mt-0.5 text-xs text-zinc-500">
                                                {payment.reference_number} &middot; {formatDate(payment.payment_date)}
                                            </div>
                                            {payment.notes && <div className="mt-1 text-xs text-zinc-400">{payment.notes}</div>}
                                        </div>
                                    </div>
                                    <div className="mt-3 flex gap-2 border-t border-zinc-100 pt-3">
                                        {rejectingId === payment.id ? (
                                            <div className="flex-1">
                                                <textarea
                                                    value={rejectForm.data.rejection_reason}
                                                    onChange={(e) => rejectForm.setData('rejection_reason', e.target.value)}
                                                    placeholder="Alasan penolakan..."
                                                    rows={2}
                                                    className="mb-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleReject(payment.id)}
                                                        disabled={rejectForm.processing}
                                                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                                    >
                                                        {rejectForm.processing ? 'Mengirim...' : 'Tolak'}
                                                    </button>
                                                    <button
                                                        onClick={() => { setRejectingId(null); rejectForm.reset(); }}
                                                        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600"
                                                    >
                                                        Batal
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleVerify(payment.id)}
                                                    className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white active:bg-emerald-700"
                                                >
                                                    Verifikasi
                                                </button>
                                                <button
                                                    onClick={() => setRejectingId(payment.id)}
                                                    className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 active:bg-red-50"
                                                >
                                                    Tolak
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>

                <SectionCard label="Umur Tagihan">
                    <div className="grid grid-cols-2 gap-3">
                        {aging.map((bucket) => (
                            <div
                                key={bucket.label}
                                className={`rounded-xl border p-4 ${bucket.count > 0 ? 'border-amber-200 bg-amber-50/50' : 'border-zinc-100 bg-zinc-50/50'}`}
                            >
                                <div className="text-[10px] font-medium text-zinc-500">{bucket.label}</div>
                                <div className="mt-1 text-lg font-bold tabular-nums text-slate-900">{bucket.count} Outlet</div>
                                <div className="text-xs tabular-nums text-zinc-500">{formatCurrency(bucket.amount)}</div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            </section>

            {/* Two-column: Priority List + Rankings */}
            <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                <SectionCard label="Outlet Perlu Perhatian" labelRight={<span className="text-[11px] font-bold text-zinc-400">{priority_list.length} Outlet</span>}>
                    {priority_list.length === 0 ? (
                        <div className="py-6 text-center text-sm text-zinc-400">Semua outlet telah menyelesaikan kewajibannya.</div>
                    ) : (
                        <div className="space-y-3">
                            {priority_list.map((item) => {
                                const severity = settlementSeverity(item.days_overdue);
                                const severityBorder = severity === 'critical' ? 'border-l-red-400' : severity === 'warning' ? 'border-l-amber-400' : 'border-l-blue-400';

                                return (
                                    <Link
                                        key={item.outlet.id}
                                        href={`/owner/settlement/outlet/${item.outlet.id}`}
                                        className={`block rounded-xl border border-l-4 border-slate-200 bg-white p-4 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40 ${severityBorder}`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="text-sm font-semibold text-slate-900">{item.outlet.name}</div>
                                            <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                                <div className="text-[10px] text-zinc-400">Belum Disetor</div>
                                                <div className="text-sm font-bold tabular-nums text-red-600">{formatCurrency(item.outstanding)}</div>
                                            </div>
                                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                                <div className="text-[10px] text-zinc-400">Omset</div>
                                                <div className="text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(item.center_share)}</div>
                                            </div>
                                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                                <div className="text-[10px] text-zinc-400">Sudah Dibayar</div>
                                                <div className="text-sm font-semibold tabular-nums text-emerald-600">{formatCurrency(item.verified_payments)}</div>
                                            </div>
                                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                                <div className="text-[10px] text-zinc-400">Hari Terlambat</div>
                                                <div className={`text-sm font-bold ${severity === 'critical' ? 'text-red-600' : severity === 'warning' ? 'text-amber-600' : 'text-slate-900'}`}>
                                                    {item.days_overdue} Hari
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </SectionCard>

                <SectionCard label="Peringkat Outlet">
                    <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
                        {([
                            { key: 'revenue', label: 'Omzet' },
                            { key: 'outstanding', label: 'Belum Masuk' },
                            { key: 'margin', label: 'Margin' },
                        ] as const).map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setRankingTab(tab.key)}
                                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                    rankingTab === tab.key
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    {currentRanking.length === 0 ? (
                        <div className="py-4 text-center text-xs text-zinc-400">Tidak ada data.</div>
                    ) : (
                        <div className="space-y-2">
                            {currentRanking.map((item, index) => {
                                let value = 0;
                                if (rankingTab === 'revenue') value = item.center_share ?? 0;
                                else if (rankingTab === 'outstanding') value = item.outstanding ?? 0;
                                else value = item.outlet_margin ?? 0;

                                return (
                                    <Link
                                        key={item.outlet.id}
                                        href={`/owner/settlement/outlet/${item.outlet.id}`}
                                        className="flex items-center gap-3 rounded-xl border border-zinc-100 p-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
                                    >
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600">
                                            {index + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-medium text-slate-900">{item.outlet.name}</div>
                                        </div>
                                        <div className="text-sm font-bold tabular-nums text-slate-900">{formatCurrency(value)}</div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </SectionCard>
            </section>
        </OwnerPageShell>
    );
}
