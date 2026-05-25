import { Head, Link, router, usePage } from '@inertiajs/react';
import AccountMenuItem from '@/components/customer/account-menu-item';
import ProfileCard from '@/components/customer/profile-card';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';

export default function Profile({ defaultAddress }: any) {
    const { auth, appVersion } = usePage<any>().props;
    const user = auth.user;

    return (
        <CustomerMobileLayout hideTopBar>
            <Head title="Profil Saya" />

            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold text-slate-900">Profil Saya</h1>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
            </div>

            {/* Profile Card */}
            <section className="mt-4">
                <ProfileCard user={user} />
            </section>

            {/* Default Address */}
            {defaultAddress && (
                <section className="mt-6">
                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Alamat Utama</h2>
                    <div className="mt-2 rounded-xl border border-emerald-200 bg-white p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                                <svg className="h-4 w-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-900">{defaultAddress.label || 'Alamat Utama'}</span>
                                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700">Utama</span>
                                </div>
                                <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{defaultAddress.address}</div>
                            </div>
                        </div>
                        <Link href="/customer/addresses" className="mt-3 flex min-h-9 w-full items-center justify-center rounded-lg border border-zinc-200 text-xs font-semibold text-slate-700 active:bg-zinc-50">
                            Kelola Alamat
                        </Link>
                    </div>
                </section>
            )}

            {/* Account Menu */}
            <section className="mt-6">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pengaturan Akun</h2>
                <div className="mt-2 space-y-2">
                    <AccountMenuItem href="/customer/orders" title="Pesanan Saya" icon={<OrderIcon />} />
                    <AccountMenuItem href="/customer/addresses" title="Alamat Saya" icon={<AddressIcon />} />
                    <AccountMenuItem href="/customer/help" title="Bantuan" icon={<HelpIcon />} />
                    <AccountMenuItem href="/customer/about" title="Tentang Dombi" icon={<InfoIcon />} />
                </div>
            </section>

            {/* Logout */}
            <section className="mt-6">
                <button
                    onClick={() => router.post('/logout')}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-200 text-sm font-semibold text-red-600 active:bg-red-50"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                </button>
                <p className="mt-3 text-center text-[11px] text-slate-400">Versi {appVersion ?? '1.0.0'}</p>
            </section>
        </CustomerMobileLayout>
    );
}

function OrderIcon() {
    return <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
}
function AddressIcon() {
    return <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
}
function HelpIcon() {
    return <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
}
function InfoIcon() {
    return <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
