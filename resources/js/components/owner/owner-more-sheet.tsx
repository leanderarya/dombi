import { Link, router, usePage } from '@inertiajs/react';
import type { ComponentType } from 'react';
import { useEffect } from 'react';

interface Props {
    open: boolean;
    onClose: () => void;
}

interface MenuItem {
    href?: string;
    title: string;
    subtitle?: string;
    icon: ComponentType<{ className?: string }>;
    action?: () => void;
}

const managementItems: MenuItem[] = [
    { href: '/owner/products', title: 'Kelola Produk', subtitle: 'Produk, harga, dan status aktif', icon: ProductIcon },
    { href: '/owner/outlets', title: 'Kelola Outlet', subtitle: 'Data outlet dan lokasi operasional', icon: OutletIcon },
    { href: '/owner/returns', title: 'Returns', subtitle: 'Review return request dari outlet', icon: ReturnIcon },
    { href: '/owner/exchanges', title: 'Exchanges', subtitle: 'Review permintaan tukar produk', icon: ExchangeIcon },
    { href: '/owner/reports', title: 'Reports', subtitle: 'Ringkasan performa operasional', icon: ReportIcon },
];

const monitoringItems: MenuItem[] = [
    { href: '/owner/stock-movements', title: 'Stock Movements', subtitle: 'Audit pergerakan stok outlet', icon: StockMovementIcon },
    { href: '/owner/deliveries', title: 'Delivery Logs', subtitle: 'Monitoring pengiriman dan insiden', icon: DeliveryLogIcon },
    { href: '/owner/stock-movements', title: 'Audit Trail', subtitle: 'Jejak perubahan inventory dan order', icon: AuditTrailIcon },
];

export default function OwnerMoreSheet({ open, onClose }: Props) {
    const { auth } = usePage<any>().props;

    useEffect(() => {
        document.body.style.overflow = open ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    const accountItems: MenuItem[] = [
        { href: '/owner/profile', title: 'Profile', subtitle: auth?.user?.email ?? 'Owner account', icon: ProfileIcon },
        { title: 'Logout', subtitle: 'Keluar dari sesi owner', icon: LogoutIcon, action: () => router.post('/logout') },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden" role="dialog" aria-modal="true" aria-labelledby="owner-more-title">
            <button aria-label="Tutup menu operasional" className="absolute inset-0 bg-slate-950/40" onClick={onClose} />

            <div className="relative flex h-[calc(100dvh-0.75rem)] w-full max-w-lg animate-[slideUp_200ms_ease-out] flex-col rounded-t-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="sticky top-0 z-10 rounded-t-3xl border-b border-slate-100 bg-white px-4 pt-3 pb-4">
                    <div className="mx-auto h-1 w-12 rounded-full bg-slate-300" />
                    <div className="mt-4 flex items-start justify-between gap-3">
                        <div>
                            <h2 id="owner-more-title" className="text-lg font-bold text-slate-950">Operational Menu</h2>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Akses modul operasional dan monitoring.</p>
                        </div>
                        <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition-all duration-150 active:scale-[0.98] active:bg-slate-50" aria-label="Close operational menu">
                            <CloseIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    <MenuSection title="Management" items={managementItems} onClose={onClose} />
                    <MenuSection title="Monitoring" items={monitoringItems} onClose={onClose} />
                    <MenuSection title="Account" items={accountItems} onClose={onClose} />
                </div>
            </div>
        </div>
    );
}

function MenuSection({ title, items, onClose }: { title: string; items: MenuItem[]; onClose: () => void }) {
    return (
        <section className="mb-5 last:mb-0">
            <div className="mb-2 text-xs font-semibold text-slate-500">{title}</div>
            <div className="space-y-2">
                {items.map((item) => (
                    <MenuRow key={`${title}-${item.title}`} item={item} onClose={onClose} />
                ))}
            </div>
        </section>
    );
}

function MenuRow({ item, onClose }: { item: MenuItem; onClose: () => void }) {
    const Icon = item.icon;
    const content = (
        <>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-950">{item.title}</div>
                {item.subtitle && <div className="mt-0.5 truncate text-[11px] text-slate-500">{item.subtitle}</div>}
            </div>
            <ChevronIcon className="h-4 w-4 shrink-0 text-slate-400" />
        </>
    );

    const className = 'flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left transition-all duration-150 active:scale-[0.98] active:bg-slate-50';

    if (item.action) {
        return (
            <button
                type="button"
                onClick={() => {
                    onClose();
                    item.action?.();
                }}
                className={className}
            >
                {content}
            </button>
        );
    }

    return (
        <Link href={item.href ?? '#'} onClick={onClose} className={className}>
            {content}
        </Link>
    );
}

function ProductIcon({ className }: { className?: string }) {
    return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
}

function OutletIcon({ className }: { className?: string }) {
    return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M8 9h.01M12 9h.01M16 9h.01" /></svg>;
}

function ReportIcon({ className }: { className?: string }) {
    return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
}

function ReturnIcon({ className }: { className?: string }) {
    return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10M7 12h10M7 17h6M7 3v4m0 0l-3-3m3 3l3-3M5 21h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
}

function ExchangeIcon({ className }: { className?: string }) {
    return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7h11m0 0l-3-3m3 3l-3 3M20 17H9m0 0l3-3m-3 3l3 3" /></svg>;
}

function StockMovementIcon({ className }: { className?: string }) {
    return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10M7 12h7M7 17h10M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" /></svg>;
}

function DeliveryLogIcon({ className }: { className?: string }) {
    return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7h10v10H3V7zm10 3h3l3 3v4h-6v-7zM6 19a2 2 0 104 0m7 0a2 2 0 104 0" /></svg>;
}

function AuditTrailIcon({ className }: { className?: string }) {
    return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 11-3.2-6.9M21 3v6h-6" /></svg>;
}

function ProfileIcon({ className }: { className?: string }) {
    return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 100-8 4 4 0 000 8zm7 9a7 7 0 10-14 0" /></svg>;
}

function LogoutIcon({ className }: { className?: string }) {
    return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17l5-5-5-5M20 12H9m2 9H5a2 2 0 01-2-2V5a2 2 0 012-2h6" /></svg>;
}

function ChevronIcon({ className }: { className?: string }) {
    return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>;
}

function CloseIcon({ className }: { className?: string }) {
    return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
}
