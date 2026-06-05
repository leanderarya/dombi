import { useState } from 'react';
import { router } from '@inertiajs/react';

const roles = [
    { label: 'Owner', route: '/dev/switch/owner', icon: '👑' },
    { label: 'Outlet', route: '/dev/switch/outlet', icon: '🏪' },
    { label: 'Courier', route: '/dev/switch/courier', icon: '🛵' },
    { label: 'Customer', route: '/dev/switch/customer', icon: '👤' },
    { label: 'Guest', route: '/dev/switch/guest', icon: '👻' },
];

interface DevToolbarProps {
    currentRole: string | null;
    env: string;
}

export default function DevToolbar({ currentRole, env }: DevToolbarProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (env !== 'local') {
        return null;
    }

    const handleSwitch = (route: string) => {
        router.visit(route);
    };

    return (
        <div className="fixed bottom-4 right-4 z-[9999]">
            {isOpen && (
                <div className="mb-2 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Dev Toolbar</span>
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">LOCAL</span>
                    </div>

                    <div className="mb-2 text-xs text-zinc-300">
                        Current: <span className="font-bold text-white">{currentRole ?? 'Guest'}</span>
                    </div>

                    <div className="flex flex-col gap-1">
                        {roles.map((role) => (
                            <button
                                key={role.label}
                                onClick={() => handleSwitch(role.route)}
                                className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                                    currentRole?.toLowerCase() === role.label.toLowerCase()
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                }`}
                            >
                                <span>{role.icon}</span>
                                <span>{role.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition-transform hover:scale-110"
                title="Dev Toolbar"
            >
                {isOpen ? '✕' : '⚡'}
            </button>
        </div>
    );
}
