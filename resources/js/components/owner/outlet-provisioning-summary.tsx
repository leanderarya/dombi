import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/clipboard';

type Provisioning = {
    outlet_name: string;
    email: string;
    temporary_password: string;
    status: string;
    location: string;
    must_change_password: boolean;
};

export default function OutletProvisioningSummary({
    provisioning,
}: {
    provisioning?: Provisioning | null;
}) {
    const [open, setOpen] = useState(Boolean(provisioning));
    const [copied, setCopied] = useState(false);

    if (!provisioning || !open) {
        return null;
    }

    const credentials = [
        `Outlet: ${provisioning.outlet_name}`,
        `Username: ${provisioning.email}`,
        `Temporary Password: ${provisioning.temporary_password}`,
        'First login: wajib ganti password',
    ].join('\n');

    const copyCredentials = async () => {
        await copyToClipboard(credentials);
        setCopied(true);
    };

    const shareCredentials = async () => {
        if (navigator.share) {
            await navigator.share({
                title: `Dombi Outlet Account - ${provisioning.outlet_name}`,
                text: credentials,
            });
        } else {
            await copyCredentials();
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-foreground/40 px-4"
            role="dialog"
            aria-modal="true"
        >
            <div className="w-full max-w-md rounded-lg border border-border bg-surface p-4">
                <p className="text-xs font-semibold tracking-wide text-success-text uppercase">
                    Branch Provisioned
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-text">
                    Outlet siap operasional
                </h2>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                    Akun outlet berhasil dibuat. Temporary password hanya
                    ditampilkan sekali di ringkasan ini.
                </p>

                <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3">
                    <Info label="Outlet" value={provisioning.outlet_name} />
                    <Info label="Status" value={provisioning.status} />
                    <Info
                        label="Location"
                        value={provisioning.location || '-'}
                    />
                </div>

                <div className="mt-3 rounded-lg border border-border-strong bg-foreground p-3 font-mono text-xs text-surface">
                    <div className="text-text-subtle">Username</div>
                    <div className="mt-1 break-all tabular-nums">
                        {provisioning.email}
                    </div>
                    <div className="mt-3 text-text-subtle">
                        Temporary Password
                    </div>
                    <div className="mt-1 text-base font-semibold tracking-wide text-brand-bright tabular-nums">
                        {provisioning.temporary_password}
                    </div>
                </div>

                <div className="mt-3 rounded-lg border border-warning-border bg-warning-bg p-3 text-xs leading-5 font-semibold text-warning-text">
                    Outlet wajib mengganti password pada login pertama.
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                        onClick={copyCredentials}
                        className="min-h-[44px] rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-text transition-colors active:bg-surface-muted"
                    >
                        {copied ? 'Copied' : 'Copy Credentials'}
                    </button>
                    <button
                        onClick={shareCredentials}
                        className="min-h-[44px] rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-text transition-colors active:bg-surface-muted"
                    >
                        Share
                    </button>
                </div>
                <Button
                    onClick={() => setOpen(false)}
                    size="lg"
                    className="mt-2 w-full"
                >
                    Close
                </Button>
            </div>
        </div>,
        document.body,
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
            <span className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                {label}
            </span>
            <span className="min-w-0 truncate text-right text-sm font-semibold text-text">
                {value}
            </span>
        </div>
    );
}
