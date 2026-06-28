import { useState } from 'react';

type SavedRecipient = {
    id: number;
    label: string | null;
    name: string;
    phone: string;
    address_line: string | null;
    latitude: number | null;
    longitude: number | null;
    is_default: boolean;
};

type Props = {
    savedRecipients: SavedRecipient[];
    selfName: string;
    selfPhone: string;
    selectedId: number | 'self' | 'new';
    onSelect: (id: number | 'self' | 'new') => void;
    onPrefill: (name: string, phone: string) => void;
};

export default function RecipientSelector({ savedRecipients, selfName, selfPhone, selectedId, onSelect, onPrefill }: Props) {
    const handleSelect = (id: number | 'self' | 'new') => {
        onSelect(id);

        if (id === 'self') {
            onPrefill(selfName, selfPhone);
        } else if (id === 'new') {
            onPrefill('', '');
        } else {
            const recipient = savedRecipients.find((r) => r.id === id);

            if (recipient) {
                onPrefill(recipient.name, recipient.phone);
            }
        }
    };

    return (
        <div className="flex gap-2 overflow-x-auto pb-1">
            {/* "Saya sendiri" — always first */}
            <ChipButton
                label="Saya sendiri"
                active={selectedId === 'self'}
                onClick={() => handleSelect('self')}
            />

            {/* Saved recipients */}
            {savedRecipients.map((r) => (
                <ChipButton
                    key={r.id}
                    label={r.label ?? r.name}
                    active={selectedId === r.id}
                    onClick={() => handleSelect(r.id)}
                />
            ))}

            {/* "Penerima baru" */}
            <ChipButton
                label="+ Penerima baru"
                active={selectedId === 'new'}
                onClick={() => handleSelect('new')}
            />
        </div>
    );
}

function ChipButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex min-h-[44px] shrink-0 items-center rounded-lg px-4 text-xs font-semibold transition-all active:opacity-80 ${
                active
                    ? 'bg-emerald-600 text-white'
                    : 'border border-border bg-surface text-text'
            }`}
        >
            {label}
        </button>
    );
}
