import { Head, Link, usePage } from '@inertiajs/react';
import { Coffee, Crown, Inbox, Leaf, Wine } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import EmptyState from '@/components/ui/empty-state';
import PageHeader from '@/components/ui/page-header';

interface FeatureInfo {
    title: string;
    description: string;
    cta: string;
    icon: ReactNode;
}

const FEATURES: Record<string, FeatureInfo> = {
    'my-dombi-plan': {
        title: 'MyDombi Plan',
        description:
            'Berlangganan kopi & minuman favorit kamu dengan harga lebih hemat. Fitur ini lagi kami siapkan — segera hadir!',
        cta: 'Beri Tahu Saya',
        icon: <Crown className="h-8 w-8" />,
    },
    merch: {
        title: 'Dombi Merch',
        description:
            'Bawa gaya Dombi ke mana-mana! Tumbler, gelas, dan merchandise seru lagi disiapkan — pantengin terus ya.',
        cta: 'Beri Tahu Saya',
        icon: <Wine className="h-8 w-8" />,
    },
    catering: {
        title: 'Catering & Event',
        description:
            'Rayakan momen bareng Dombi. Paket catering untuk acara seru kamu lagi disiapkan tim kami.',
        cta: 'Hubungi Kami',
        icon: <Coffee className="h-8 w-8" />,
    },
    poin: {
        title: 'Dombi Poin',
        description:
            'Kumpulin poin dari tiap pembelian buat ditukar hadiah seru. Fiturnya lagi disiapkan!',
        cta: 'Beri Tahu Saya',
        icon: <Leaf className="h-8 w-8" />,
    },
};

export default function ComingSoon() {
    const { feature } = usePage<any>().props;
    const info = FEATURES[feature] ?? {
        title: 'Fitur Ini Segera Hadir',
        description: 'Fitur ini segera hadir',
        cta: 'Beri Tahu Saya',
        icon: <Inbox className="h-8 w-8" />,
    };

    const handleCta = () => {
        if (feature === 'catering') {
            // ponytail: ganti link WA saat nomor tersedia
            toast.info(
                'Hubungi kami via WhatsApp besok ya — nomornya lagi disiapin 🙏',
            );
        } else {
            toast.success('Makasih! Kami kabarin begitu fiturnya hadir 🎉');
        }
    };

    return (
        <div className="min-h-dvh bg-background text-text">
            <Head title={info.title} />
            <PageHeader
                variant="customer"
                title="Akan Datang"
                backHref="/customer/home"
            />

            <main className="mx-auto max-w-lg px-4 pt-6 pb-24">
                <EmptyState
                    icon={info.icon}
                    title={info.title}
                    description={info.description}
                    action={{ label: info.cta, onClick: handleCta }}
                />
                <div className="mt-4 flex justify-center">
                    <Link
                        href="/customer/home"
                        className="inline-flex min-h-11 items-center justify-center rounded-chip border border-border bg-surface px-4 text-sm font-semibold text-text active:bg-surface-muted"
                    >
                        Kembali ke Beranda
                    </Link>
                </div>
            </main>
        </div>
    );
}
