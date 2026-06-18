import { Link } from '@inertiajs/react';
import { Package, Search, CheckCircle } from 'lucide-react';

interface Props {
    type?: 'no-orders' | 'no-active' | 'no-results';
}

const content = {
    'no-orders': {
        icon: Package,
        title: '☕ Yuk pesan susu kambing favoritmu',
        description: 'Belum ada pesanan aktif saat ini. Mulai pesan dan nikmati kesegarannya!',
        showCta: true,
        ctaLabel: 'Lihat Menu',
        ctaHref: '/customer/products',
    },
    'no-active': {
        icon: CheckCircle,
        title: 'Semua pesanan sudah selesai',
        description: 'Pesananmu sudah diproses semua. Saatnya pesan lagi!',
        showCta: true,
        ctaLabel: 'Pesan Lagi',
        ctaHref: '/customer/products',
    },
    'no-results': {
        icon: Search,
        title: 'Pesanan tidak ditemukan',
        description: 'Coba ubah filter atau cari dengan kata kunci lain.',
        showCta: false,
        ctaLabel: '',
        ctaHref: '',
    },
};

export default function EmptyOrderState({ type = 'no-orders' }: Props) {
    const { icon: Icon, title, description, showCta, ctaLabel, ctaHref } = content[type];

    return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white py-12 text-center shadow-sm">
            <Icon className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
            <p className="mt-1 text-xs text-slate-400">{description}</p>
            {showCta && (
                <Link href={ctaHref ?? '/customer/checkout'} className="mt-4 flex min-h-10 items-center rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white active:bg-emerald-800">
                    {ctaLabel ?? 'Pesan Sekarang'}
                </Link>
            )}
        </div>
    );
}
