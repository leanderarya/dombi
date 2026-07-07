import { useState } from 'react';
import { createPortal } from 'react-dom';

type Provisioning = {
    outlet_name: string;
    email: string;
    temporary_password: string;
    status: string;
    location: string;
    must_change_password: boolean;
};

export default function OutletProvisioningSummary({ provisioning }: { provisioning?: Provisioning | null }) {
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
        await navigator.clipboard.writeText(credentials);
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 px-0 lg:items-center lg:px-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-t-lg border border-slate-200 bg-white p-4 lg:rounded-lg">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Branch Provisioned</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">Outlet siap operasional</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Akun outlet berhasil dibuat. Temporary password hanya ditampilkan sekali di ringkasan ini.</p>

                <div className="mt-4 rounded-lg border border-slate-200 bg-[#F8FAFC] p-3">
                    <Info label="Outlet" value={provisioning.outlet_name} />
                    <Info label="Status" value={provisioning.status} />
                    <Info label="Location" value={provisioning.location || '-'} />
                </div>

                <div className="mt-3 rounded-lg border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-slate-100">
                    <div className="text-slate-400">Username</div>
                    <div className="mt-1 break-all tabular-nums">{provisioning.email}</div>
                    <div className="mt-3 text-slate-400">Temporary Password</div>
                    <div className="mt-1 text-base font-semibold tracking-wide text-emerald-300 tabular-nums">{provisioning.temporary_password}</div>
                </div>

                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
                    Outlet wajib mengganti password pada login pertama.
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                    <button onClick={copyCredentials} className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors active:bg-[#F8FAFC]">
                        {copied ? 'Copied' : 'Copy Credentials'}
                    </button>
                    <button onClick={shareCredentials} className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors active:bg-[#F8FAFC]">
                        Share
                    </button>
                </div>
                <button onClick={() => setOpen(false)} className="mt-2 min-h-[48px] w-full rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white transition-colors active:bg-emerald-600">
                    Close
                </button>
            </div>
        </div>,
        document.body,
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 py-2 last:border-b-0">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
            <span className="min-w-0 truncate text-right text-sm font-semibold text-slate-900">{value}</span>
        </div>
    );
}
