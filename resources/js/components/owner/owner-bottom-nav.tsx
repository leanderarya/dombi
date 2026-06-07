import { Link, usePage } from '@inertiajs/react';
import { useState } from 'react';
import OwnerMoreSheet from './owner-more-sheet';

const navItems = [
    { href: '/owner/dashboard', label: 'Dashboard', icon: DashIcon },
    { href: '/owner/orders', label: 'Orders', icon: OrderIcon },
    { href: '/owner/inventories', label: 'Inventory', icon: InvIcon },
    { href: '/owner/restocks', label: 'Restocks', icon: RestockIcon },
];

const moreRoutes = ['/owner/products', '/owner/outlets', '/owner/reports', '/owner/stock-movements', '/owner/deliveries', '/owner/profile', '/owner/returns', '/owner/exchanges'];

export default function OwnerBottomNav() {
    const { url } = usePage();
    const [moreOpen, setMoreOpen] = useState(false);
    const moreActive = moreRoutes.some((route) => url === route || url.startsWith(`${route}/`));

    return (
        <>
            <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
                <div className="mx-auto grid h-14 max-w-lg grid-cols-5">
                    {navItems.map((item) => {
                        const active = url === item.href || url.startsWith(`${item.href}/`) || (item.href === '/owner/dashboard' && url === '/owner/dashboard');
                        const Icon = item.icon;
                        return (
                            <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center gap-0.5 text-[9px] font-semibold ${active ? 'text-emerald-700' : 'text-slate-400'}`}>
                                <Icon active={active} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                    <button type="button" onClick={() => setMoreOpen(true)} className={`flex flex-col items-center justify-center gap-0.5 text-[9px] font-semibold ${moreActive || moreOpen ? 'text-emerald-700' : 'text-slate-400'}`} aria-label="Open operational menu">
                        <MoreIcon active={moreActive || moreOpen} />
                        <span>More</span>
                    </button>
                </div>
            </nav>
            <OwnerMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
        </>
    );
}

function DashIcon({ active }: { active: boolean }) {
    return <svg className="h-5 w-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 6a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5zM4 13a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2z" /></svg>;
}
function OrderIcon({ active }: { active: boolean }) {
    return <svg className="h-5 w-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
}
function InvIcon({ active }: { active: boolean }) {
    return <svg className="h-5 w-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
}
function RestockIcon({ active }: { active: boolean }) {
    return <svg className="h-5 w-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
}
function MoreIcon({ active }: { active: boolean }) {
    return <svg className="h-5 w-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" /></svg>;
}
