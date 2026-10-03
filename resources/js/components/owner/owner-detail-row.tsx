import type { ReactNode } from 'react';

interface Props {
    label: string;
    value: ReactNode;
    align?: 'left' | 'right';
    size?: 'xs' | 'sm';
    bold?: boolean;
    danger?: boolean;
}

export default function OwnerDetailRow({
    label,
    value,
    align = 'left',
    size = 'sm',
    bold = false,
    danger = false,
}: Props) {
    return (
        <div
            className={`flex justify-between border-b border-border py-1 last:border-b-0 ${size === 'xs' ? 'text-xs' : 'text-sm'} ${danger ? 'text-danger-text' : ''}`}
        >
            <span className="grow-0 text-text-muted tabular-nums">{label}</span>
            {/*
             * `min-w-0` is load-bearing here, not the `break-words`.
             * A caller can pass a raw serialised audit value — `old_value` and
             * `new_value` come straight off the model, and for `operational_hours`
             * that is JSON with no spaces and no break opportunity. `break-words`
             * sets `overflow-wrap: break-word`, which does NOT lower the
             * min-content contribution, so the span still refused to shrink and
             * pushed the document to 897px at 100% text on a 390px viewport.
             * Releasing the minimum lets the flex item shrink; `break-words`
             * then gets its chance to break the token once the box is narrow.
             * Changing this to `overflow-wrap: anywhere` instead would also
             * work, and would not need the `min-w-0` — but `anywhere` changes
             * how min-content is computed for every one of the seven owner
             * pages that share this component, so the narrower change wins.
             */}
            <span
                className={`min-w-0 ${align === 'right' ? 'text-right' : ''} ${bold ? 'font-semibold' : ''} ${danger ? 'text-danger-text' : 'text-text'} break-words tabular-nums`}
            >
                {value ?? '-'}
            </span>
        </div>
    );
}
