import { Link } from '@inertiajs/react';

interface Props {
    type?: 'no-orders' | 'no-active' | 'no-results';
}

const content = {
    'no-orders': {
        icon: '📦',
        title: 'Belum ada pesanan',
        description: 'Pesanan yang kamu buat akan muncul di sini.',
        showCta: true,
    },
    'no-active': {
        icon: '✓',
        title: 'Tidak ada pesanan aktif',
        description: 'Semua pesanan sudah selesai diproses.',
        showCta: false,
    },
    'no-results': {
        icon: '🔍',
        title: 'Tidak ada hasil',
        description: 'Coba ubah filter untuk melihat pesanan lain.',
        showCta: false,
    },
};

export default function EmptyOrderState({ type = 'no-orders' }: Props) {
    const { icon, title, description, showCta } = content[type];

    return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-100 bg-white py-12 text-center">
            <span className="text-3xl">{icon}</span>
            <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
            <p className="mt-1 text-xs text-slate-400">{description}</p>
            {showCta && (
                <Link href="/customer/checkout" className="mt-4 flex min-h-10 items-center rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white active:bg-emerald-800">
                    Pesan Sekarang
                </Link>
            )}
        </div>
    );
}
