import { Link } from '@inertiajs/react';
import { CheckCircle, Milk, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    type?: 'no-orders' | 'no-active' | 'no-results';
}

const content = {
    'no-orders': {
        icon: Milk,
        title: 'Yuk belanja lagi',
        description:
            'Belum ada pesanan aktif saat ini. Mulai pesan dan nikmati kesegarannya!',
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
    const {
        icon: Icon,
        title,
        description,
        showCta,
        ctaLabel,
        ctaHref,
    } = content[type];

    return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-card bg-surface p-7 text-center">
            <Icon className="h-[38px] w-[38px] text-text-subtle" />
            <p className="font-heading text-[15px] font-bold text-text">
                {title}
            </p>
            <p className="max-w-[300px] text-caption text-text-muted">
                {description}
            </p>
            {showCta && (
                <Button asChild variant="primary" size="md" className="mt-2">
                    <Link href={ctaHref ?? '/customer/checkout'}>
                        {ctaLabel ?? 'Pesan Sekarang'}
                    </Link>
                </Button>
            )}
        </div>
    );
}
