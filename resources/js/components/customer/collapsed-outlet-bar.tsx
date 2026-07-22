import { Link } from '@inertiajs/react';
import { ChevronDown, Store } from 'lucide-react';
import type { OutletOption } from '@/contexts/outlet-context';

interface Props {
  show: boolean;
  outlet: OutletOption | null;
  fulfillmentType: 'pickup' | 'delivery';
  onOpenSheet: () => void;
  backHref?: string;
}

export default function CollapsedOutletBar({
  show,
  outlet,
  fulfillmentType,
  onOpenSheet,
  backHref = '/customer/home',
}: Props) {
  if (!outlet) return null;

  const distanceText =
    outlet.distance_km !== null && outlet.distance_km !== undefined
      ? `${outlet.distance_km.toFixed(1)} km`
      : null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 bg-white shadow-sm transition-all duration-200 ease-out ${
        show
          ? 'translate-y-0 opacity-100'
          : '-translate-y-full opacity-0 pointer-events-none'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {/* Back button */}
        <Link
          href={backHref}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text active:bg-surface-muted"
        >
          <svg
            width="20"
            height="20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>

        {/* Outlet info — tap to open sheet */}
        <button
          type="button"
          onClick={onOpenSheet}
          className="flex min-w-0 flex-1 items-center gap-2 text-left active:opacity-80"
        >
          <Store className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-bold text-text">
            {outlet.name}
          </span>
          {distanceText && (
            <span className="shrink-0 text-[11px] text-text-muted tabular-nums">
              {distanceText}
            </span>
          )}
          {/* Fulfillment badge */}
          <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
            {fulfillmentType === 'pickup' ? 'P' : 'D'}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-text-subtle" />
        </button>
      </div>
    </div>
  );
}
