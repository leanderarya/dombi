import { Shield, MapPin, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Dialog from '@/components/ui/dialog';
import { GoogleIcon } from '@/components/ui/google-icon';

interface Props {
    open: boolean;
    onClose: () => void;
    title?: string;
}

export default function LoginDialog({
    open,
    onClose,
    title = 'Login untuk Melanjutkan',
}: Props) {
    return (
        <Dialog open={open} onClose={onClose} title={title}>
            <div className="mt-4 space-y-3">
                {[
                    { icon: MapPin, text: 'Alamat tersimpan aman' },
                    { icon: Package, text: 'Lacak pesanan real-time' },
                    { icon: Shield, text: 'Riwayat pesanan tersimpan' },
                ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light">
                            <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm text-text">{text}</span>
                    </div>
                ))}
            </div>

            <a
                href="/oauth/google"
                className="mt-6 flex min-h-11 w-full items-center justify-center gap-3 rounded-xl bg-primary text-sm font-bold text-white active:bg-primary-hover"
            >
                <GoogleIcon className="h-5 w-5" />
                Masuk dengan Google
            </a>

            <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="mt-3 h-auto min-h-11 w-full text-sm font-semibold text-text-muted hover:bg-transparent hover:text-text-muted active:text-text"
            >
                Nanti Saja
            </Button>
        </Dialog>
    );
}
