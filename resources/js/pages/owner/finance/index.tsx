import { useForm, router } from '@inertiajs/react';
import { DollarSign, Store, Clock, Search, PartyPopper, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import FinanceFilterTabs from '@/components/owner/finance/finance-filter-tabs';
import FinanceOutletCard from '@/components/owner/finance/finance-outlet-card';
import PaymentHistoryCard from '@/components/owner/finance/payment-history-card';
import PaymentProofModal from '@/components/owner/finance/payment-proof-modal';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { SkeletonKpiGrid, SkeletonFilters, SkeletonOrderList } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';

/* ------------------------------------------------------------------ */
/*  Tab definitions                                                    */
/* ------------------------------------------------------------------ */

const TABS = [
    { key: 'tagihan', label: 'Tagihan' },
    { key: 'pembayaran', label: 'Pembayaran' },
    { key: 'rekening', label: 'Rekening' },
];

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function FinanceIndex(props: any) {
    const [activeTab, setActiveTab] = useState('tagihan');

    // Sync tab with URL on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');

        if (tab && TABS.some((t) => t.key === tab)) {
            setActiveTab(tab);
        }
    }, []);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        router.get('/owner/finance', { tab }, { preserveState: true, replace: true });
    };

    return (
        <OwnerPageShell title="Keuangan" subtitle="Pantau kewajiban seluruh outlet">
            {/* Segmented Control — primary tab navigation */}
            <div className="mb-5 inline-flex rounded-xl bg-surface-muted p-1">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => handleTabChange(tab.key)}
                        className={`relative rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                            activeTab === tab.key
                                ? 'bg-white text-text shadow-sm'
                                : 'text-text-muted hover:text-text'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'tagihan' && <TagihanTab {...props} />}
            {activeTab === 'pembayaran' && <PembayaranTab {...props} />}
            {activeTab === 'rekening' && <RekeningTab {...props} />}
        </OwnerPageShell>
    );
}

/* ------------------------------------------------------------------ */
/*  Tagihan Tab — moved from finance/index.tsx                         */
/* ------------------------------------------------------------------ */

const TAGIHAN_FILTER_TABS = [
    { key: 'action_needed', label: 'Butuh Tindakan' },
    { key: 'overdue', label: 'Terlambat' },
    { key: 'unpaid', label: 'Belum Bayar' },
    { key: 'paid', label: 'Lunas' },
];

function TagihanTab({ kpis, outlets }: any) {
    const [filter, setFilter] = useState('action_needed');
    const [search, setSearch] = useState('');

    if (!kpis || !outlets) {
        return (
            <div className="space-y-4">
                <SkeletonKpiGrid count={4} />
                <SkeletonFilters />
                <SkeletonOrderList />
            </div>
        );
    }

    const filtered = useMemo(() => {
        return outlets.filter((o: any) => {
            if (filter === 'action_needed') {
                if (o.display_status !== 'overdue' && o.display_status !== 'unpaid') {
                    return false;
                }
            } else if (filter !== 'all' && o.display_status !== filter) {
                return false;
            }

            if (search) {
                return o.outlet_name.toLowerCase().includes(search.toLowerCase());
            }

            return true;
        });
    }, [outlets, filter, search]);

    return (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            {/* Left: Filters + Outlet List */}
            <div>
                {/* Sticky Filters + Search */}
                <div className="sticky top-0 z-20 -mx-4 px-4 py-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <FinanceFilterTabs tabs={TAGIHAN_FILTER_TABS} active={filter} onChange={setFilter} />
                        <div className="flex items-center gap-2 rounded-full border border-border bg-white px-3 sm:w-56">
                            <Search className="h-4 w-4 shrink-0 text-text-subtle" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari outlet..."
                                className="w-full bg-transparent py-2 pr-1 text-sm placeholder:text-text-subtle focus:outline-none"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="shrink-0 text-text-subtle hover:text-text-muted"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile KPI Strip */}
                <div className="mb-4 grid grid-cols-3 gap-2 lg:hidden">
                    <div className="rounded-xl border border-border bg-white p-3 text-center">
                        <div className="text-[11px] font-medium text-text-muted">Belum Dibayar</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-text">{formatCurrency(kpis.total_unpaid)}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-3 text-center">
                        <div className="text-[11px] font-medium text-text-muted">Outlet</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-text">{kpis.outlets_unpaid}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-3 text-center">
                        <div className="text-[11px] font-medium text-text-muted">Jatuh Tempo</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-text">{formatCurrency(kpis.due_this_week)}</div>
                    </div>
                </div>

                {/* Outlet List */}
                <section className="mt-4">
                    {filtered.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border bg-white py-16 text-center">
                            {search ? (
                                <>
                                    <Store className="mx-auto h-10 w-10 text-text-subtle" />
                                    <p className="mt-3 text-sm font-medium text-text-muted">Outlet tidak ditemukan</p>
                                    <p className="mt-1 text-xs text-text-subtle">Coba kata kunci lain</p>
                                </>
                            ) : filter === 'action_needed' ? (
                                <>
                                    <PartyPopper className="mx-auto h-10 w-10 text-emerald-400" />
                                    <p className="mt-3 text-sm font-medium text-text">Tidak ada outlet yang butuh tindakan</p>
                                    <p className="mt-1 text-xs text-text-subtle">Semua tagihan sudah tertangani</p>
                                </>
                            ) : filter === 'paid' ? (
                                <>
                                    <PartyPopper className="mx-auto h-10 w-10 text-emerald-400" />
                                    <p className="mt-3 text-sm font-medium text-text">Semua outlet sudah lunas</p>
                                    <p className="mt-1 text-xs text-text-subtle">Tidak ada tagihan aktif</p>
                                </>
                            ) : (
                                <>
                                    <Store className="mx-auto h-10 w-10 text-text-subtle" />
                                    <p className="mt-3 text-sm font-medium text-text-muted">Belum ada outlet dengan status ini</p>
                                    <p className="mt-1 text-xs text-text-subtle">Coba filter lain untuk melihat outlet</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filtered.map((o: any) => (
                                <FinanceOutletCard
                                    key={o.outlet_id}
                                    outletId={o.outlet_id}
                                    outletName={o.outlet_name}
                                    totalSales={o.total_sales}
                                    totalOutstanding={o.total_outstanding}
                                    totalPaid={o.total_paid}
                                    displayStatus={o.display_status}
                                    nearestDueDate={o.nearest_due_date}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {/* Right: KPI Cards (desktop sidebar) */}
            <aside className="hidden lg:block">
                <div className="sticky top-20 space-y-3">
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <DollarSign className="h-4 w-4 text-red-500" />
                            Total Belum Dibayar
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">{formatCurrency(kpis.total_unpaid)}</div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-500">
                            {kpis.outlets_unpaid > 0 ? (
                                <>
                                    <AlertCircle className="h-3 w-3" />
                                    {kpis.outlets_unpaid} outlet memiliki tagihan
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-3 w-3 text-emerald-500" />
                                    <span className="text-emerald-500">Semua outlet lunas</span>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <Store className="h-4 w-4 text-amber-500" />
                            Outlet Belum Bayar
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">{kpis.outlets_unpaid}</div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-500">
                            <AlertCircle className="h-3 w-3" />
                            Outlet dengan sisa tagihan
                        </div>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <Clock className="h-4 w-4 text-orange-500" />
                            Jatuh Tempo Minggu Ini
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">{formatCurrency(kpis.due_this_week)}</div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-orange-500">
                            {kpis.due_this_week > 0 ? (
                                <>
                                    <AlertCircle className="h-3 w-3" />
                                    Segera tindak lanjuti
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-3 w-3 text-emerald-500" />
                                    <span className="text-emerald-500">Tidak ada jatuh tempo</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Pembayaran Tab — moved from finance/settlement-payments.tsx        */
/* ------------------------------------------------------------------ */

const PEMBAYARAN_FILTER_TABS = [
    { key: 'all', label: 'Semua' },
    { key: 'pending_verification', label: 'Pending' },
    { key: 'verified', label: 'Diverifikasi' },
    { key: 'rejected', label: 'Ditolak' },
];

function PembayaranTab({ payments, statusFilter, paymentKpis }: any) {
    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [processing, setProcessing] = useState(false);
    const [proofUrl, setProofUrl] = useState<string | null>(null);
    const [batchVerifying, setBatchVerifying] = useState(false);

    // Default to pending_verification if no statusFilter
    useEffect(() => {
        if (!statusFilter || statusFilter === 'all') {
            router.get('/owner/finance', { tab: 'pembayaran', status: 'pending_verification' }, { replace: true, preserveState: true });
        }
    }, []);

    const handleVerify = (paymentId: number) => {
        if (!confirm('Verifikasi pembayaran ini?')) {
            return;
        }

        setProcessing(true);
        router.post(`/owner/finance/settlement-payments/${paymentId}/verify`, {}, {
            onFinish: () => setProcessing(false),
        });
    };

    const handleReject = (paymentId: number) => {
        if (rejectingId === paymentId) {
            if (!rejectReason.trim()) {
                return;
            }

            setProcessing(true);
            router.post(`/owner/finance/settlement-payments/${paymentId}/reject`, {
                rejection_reason: rejectReason,
            }, {
                onSuccess: () => {
                    setRejectingId(null);
                    setRejectReason('');
                },
                onFinish: () => setProcessing(false),
            });
        } else {
            setRejectingId(paymentId);
            setRejectReason('');
        }
    };

    const handleBatchVerify = () => {
        if (!confirm(`Verifikasi semua ${pendingPayments.length} pembayaran yang pending?`)) {
            return;
        }

        setBatchVerifying(true);
        router.post('/owner/finance/settlement-payments/bulk-verify', {}, {
            onFinish: () => setBatchVerifying(false),
        });
    };

    const pendingPayments = payments.data.filter((p: any) => p.status === 'pending_verification');
    const otherPayments = payments.data.filter((p: any) => p.status !== 'pending_verification');

    const handleStatusFilterChange = (key: string) => {
        router.get('/owner/finance', { tab: 'pembayaran', status: key }, { preserveState: true });
    };

    return (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            {/* Left: Filters + Payment Cards */}
            <div>
                {/* Sticky Filter */}
                <div className="sticky top-0 z-20 -mx-4 px-4 py-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <FinanceFilterTabs
                            tabs={PEMBAYARAN_FILTER_TABS}
                            active={statusFilter}
                            onChange={handleStatusFilterChange}
                        />
                        {pendingPayments.length > 0 && statusFilter !== 'verified' && statusFilter !== 'rejected' && (
                            <button
                                type="button"
                                onClick={handleBatchVerify}
                                disabled={batchVerifying}
                                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-50"
                            >
                                {batchVerifying ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <CheckCircle className="h-3.5 w-3.5" />
                                )}
                                Verifikasi Semua ({pendingPayments.length})
                            </button>
                        )}
                    </div>
                </div>

                {/* Reject reason input */}
                {rejectingId && (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                        <div className="text-sm font-semibold text-red-800">Alasan Penolakan</div>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Masukkan alasan penolakan..."
                            rows={2}
                            className="mt-2 w-full rounded-lg border border-red-200 bg-surface px-3 py-2 text-sm focus:border-red-400 focus:ring-1 focus:ring-red-200"
                        />
                        <div className="mt-3 flex gap-2">
                            <button
                                type="button"
                                onClick={() => handleReject(rejectingId)}
                                disabled={processing || !rejectReason.trim()}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                {processing ? 'Mengirim...' : 'Konfirmasi Tolak'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
 setRejectingId(null); setRejectReason(''); 
}}
                                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text hover:bg-surface-muted"
                            >
                                Batal
                            </button>
                        </div>
                    </div>
                )}

                {/* Payment Cards */}
                <section className="mt-4">
                    {payments.data.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border bg-surface py-16 text-center">
                            <DollarSign className="mx-auto h-10 w-10 text-text-subtle" />
                            <p className="mt-3 text-sm font-medium text-text-muted">Belum ada pembayaran</p>
                            <p className="mt-1 text-xs text-text-subtle">Pembayaran outlet akan muncul di sini.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Pending first */}
                            {pendingPayments.map((payment: any) => (
                                <PaymentHistoryCard
                                    key={payment.id}
                                    payment={payment}
                                    onVerify={handleVerify}
                                    onReject={(id) => {
 setRejectingId(id); setRejectReason(''); 
}}
                                    onShowProof={(url) => setProofUrl(url)}
                                    processing={processing}
                                />
                            ))}
                            {/* Then others */}
                            {otherPayments.map((payment: any) => (
                                <PaymentHistoryCard
                                    key={payment.id}
                                    payment={payment}
                                    onVerify={handleVerify}
                                    onReject={(id) => {
 setRejectingId(id); setRejectReason(''); 
}}
                                    onShowProof={(url) => setProofUrl(url)}
                                    processing={processing}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* Pagination */}
                {payments.last_page > 1 && (
                    <>
                        {/* Desktop: number pagination */}
                        <div className="mt-6 hidden justify-center gap-2 sm:flex">
                            {Array.from({ length: payments.last_page }, (_, i) => i + 1).map((page) => (
                                <button
                                    key={page}
                                    type="button"
                                    onClick={() => router.get(`/owner/finance?page=${page}&tab=pembayaran&status=${statusFilter}`)}
                                    className={`h-9 w-9 rounded-full text-sm font-medium transition-colors ${
                                        page === payments.current_page
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-surface-muted text-text-muted hover:bg-surface-muted'
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>
                        {/* Mobile: Load More */}
                        {payments.current_page < payments.last_page && (
                            <div className="mt-6 flex justify-center sm:hidden">
                                <button
                                    type="button"
                                    onClick={() => router.get(`/owner/finance?page=${payments.current_page + 1}&tab=pembayaran&status=${statusFilter}`, {}, { preserveState: true })}
                                    className="rounded-full border border-border bg-surface px-6 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-surface-muted"
                                >
                                    Muat Lebih Banyak
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Right: KPI Cards (desktop sidebar) */}
            <aside className="hidden lg:block">
                <div className="sticky top-20 space-y-3">
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <Clock className="h-4 w-4 text-amber-500" />
                            Pending Verifikasi
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">{paymentKpis?.pending_count ?? 0}</div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-500">
                            <Clock className="h-3 w-3" />
                            Pembayaran menunggu persetujuan
                        </div>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            Pembayaran Hari Ini
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">{formatCurrency(paymentKpis?.verified_today ?? 0)}</div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                            <CheckCircle className="h-3 w-3" />
                            Diverifikasi hari ini
                        </div>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <DollarSign className="h-4 w-4 text-blue-500" />
                            Total Bulan Ini
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">{formatCurrency(paymentKpis?.verified_month ?? 0)}</div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-blue-500">
                            <DollarSign className="h-3 w-3" />
                            Total pembayaran bulan ini
                        </div>
                    </div>
                </div>
            </aside>

            {/* Mobile/Tablet: KPI Strip */}
            <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3 lg:hidden">
                <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                        <Clock className="h-4 w-4 text-amber-500" />
                        Pending Verifikasi
                    </div>
                    <div className="mt-2 text-3xl font-bold text-text">{paymentKpis?.pending_count ?? 0}</div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-500">
                        <Clock className="h-3 w-3" />
                        Pembayaran menunggu persetujuan
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                        Pembayaran Hari Ini
                    </div>
                    <div className="mt-2 text-3xl font-bold text-text">{formatCurrency(paymentKpis?.verified_today ?? 0)}</div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                        <CheckCircle className="h-3 w-3" />
                        Diverifikasi hari ini
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                        <DollarSign className="h-4 w-4 text-blue-500" />
                        Total Bulan Ini
                    </div>
                    <div className="mt-2 text-3xl font-bold text-text">{formatCurrency(paymentKpis?.verified_month ?? 0)}</div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-blue-500">
                        <DollarSign className="h-3 w-3" />
                        Total pembayaran bulan ini
                    </div>
                </div>
            </section>

            {/* Proof Modal */}
            {proofUrl && (
                <PaymentProofModal open={!!proofUrl} onClose={() => setProofUrl(null)} imageUrl={proofUrl} />
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Rekening Tab — moved from finance/payment-accounts.tsx             */
/* ------------------------------------------------------------------ */

interface PaymentAccount {
    id: number;
    bank_name: string;
    account_number: string;
    account_holder: string;
    is_active: boolean;
}

function RekeningTab({ accounts }: { accounts: PaymentAccount[] }) {
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const { data, setData, post, put, processing, errors, reset } = useForm({
        bank_name: '',
        account_number: '',
        account_holder: '',
        is_active: true,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingId) {
            put(`/owner/finance/payment-accounts/${editingId}`, {
                onSuccess: () => {
                    reset();
                    setShowForm(false);
                    setEditingId(null);
                },
            });
        } else {
            post('/owner/finance/payment-accounts', {
                onSuccess: () => {
                    reset();
                    setShowForm(false);
                },
            });
        }
    };

    const handleEdit = (account: PaymentAccount) => {
        setEditingId(account.id);
        setData({
            bank_name: account.bank_name,
            account_number: account.account_number,
            account_holder: account.account_holder,
            is_active: account.is_active,
        });
        setShowForm(true);
    };

    const handleDelete = (id: number) => {
        if (confirm('Hapus rekening ini?')) {
            router.delete(`/owner/finance/payment-accounts/${id}`);
        }
    };

    return (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            {/* Left: account list */}
            <div>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-text">Rekening Pembayaran</h2>
                    <button
                        type="button"
                        onClick={() => {
                            reset();
                            setEditingId(null);
                            setShowForm(!showForm);
                        }}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-primary/90 active:opacity-80 lg:hidden"
                    >
                        {showForm ? 'Batal' : 'Tambah Rekening'}
                    </button>
                </div>

                {/* Mobile form */}
                {showForm && (
                    <form onSubmit={handleSubmit} className="mb-4 rounded-xl border border-border bg-white p-4 lg:hidden">
                        <h3 className="mb-3 text-sm font-semibold text-text">
                            {editingId ? 'Edit Rekening' : 'Tambah Rekening'}
                        </h3>
                        <AccountForm data={data} setData={setData} errors={errors} processing={processing} editingId={editingId} />
                    </form>
                )}

                <div className="space-y-2">
                    {accounts.length === 0 ? (
                        <div className="rounded-xl border border-border bg-white p-8 text-center">
                            <p className="text-sm text-text-muted">Belum ada rekening</p>
                        </div>
                    ) : (
                        accounts.map((account) => (
                            <div key={account.id} className="rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm hover:border-border/60">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-text">{account.bank_name}</div>
                                        <div className="text-xs text-text-muted">{account.account_number}</div>
                                        <div className="text-xs text-text-subtle">a.n. {account.account_holder}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${account.is_active ? 'bg-primary-light text-primary' : 'bg-surface-muted text-text-muted'}`}>
                                            {account.is_active ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-3 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleEdit(account)}
                                        className="rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-muted/80"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(account.id)}
                                        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                                    >
                                        Hapus
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right: add/edit form (desktop only, sticky) */}
            <div className="hidden lg:block">
                <div className="sticky top-4">
                    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-white p-4 transition-shadow hover:shadow-sm">
                        <h3 className="mb-3 text-sm font-semibold text-text">
                            {editingId ? 'Edit Rekening' : 'Tambah Rekening'}
                        </h3>
                        <AccountForm data={data} setData={setData} errors={errors} processing={processing} editingId={editingId} />
                    </form>
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Account Form — shared between mobile & desktop                     */
/* ------------------------------------------------------------------ */

function AccountForm({ data, setData, errors, processing, editingId }: {
    data: { bank_name: string; account_number: string; account_holder: string; is_active: boolean };
    setData: (key: string, value: any) => void;
    errors: Record<string, string>;
    processing: boolean;
    editingId: number | null;
}) {
    return (
        <div className="space-y-3">
            <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Nama Bank</label>
                <input
                    type="text"
                    value={data.bank_name}
                    onChange={(e) => setData('bank_name', e.target.value)}
                    required
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
                    placeholder="BCA, Mandiri, BRI..."
                />
                {errors.bank_name && <p className="mt-1 text-xs text-red-600">{errors.bank_name}</p>}
            </div>

            <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Nomor Rekening</label>
                <input
                    type="text"
                    value={data.account_number}
                    onChange={(e) => setData('account_number', e.target.value)}
                    required
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
                    placeholder="1234567890"
                />
                {errors.account_number && <p className="mt-1 text-xs text-red-600">{errors.account_number}</p>}
            </div>

            <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Nama Pemilik</label>
                <input
                    type="text"
                    value={data.account_holder}
                    onChange={(e) => setData('account_holder', e.target.value)}
                    required
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
                    placeholder="PT Dombi Indonesia"
                />
                {errors.account_holder && <p className="mt-1 text-xs text-red-600">{errors.account_holder}</p>}
            </div>

            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="is_active"
                    checked={data.is_active}
                    onChange={(e) => setData('is_active', e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                />
                <label htmlFor="is_active" className="text-sm text-text">Aktif</label>
            </div>

            <button
                type="submit"
                disabled={processing}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-primary/90 active:opacity-80 disabled:opacity-50"
            >
                {processing ? 'Menyimpan...' : editingId ? 'Perbarui' : 'Simpan'}
            </button>
        </div>
    );
}
