/**
 * Unified status border colors for all owner pages.
 * Each status maps to a Tailwind border-l-* class (4px left border).
 *
 * Groups:
 *  - Pending/Waiting  = amber
 *  - Confirmed/Active = blue
 *  - Preparing        = indigo
 *  - In-Progress      = violet
 *  - Ready            = emerald light (using emerald-400)
 *  - Success          = emerald
 *  - Danger           = red
 *  - Neutral          = slate
 */
export const STATUS_BORDER: Record<string, string> = {
    // --- Pending / Waiting states (amber) ---
    pending: 'border-l-amber-400',
    pending_confirmation: 'border-l-amber-400',
    requested: 'border-l-amber-400',
    submitted: 'border-l-amber-400',
    waiting_pickup: 'border-l-amber-400',
    returned_to_outlet: 'border-l-amber-400',
    retry_delivery: 'border-l-amber-400',

    // --- Confirmed / Active states (blue) ---
    confirmed: 'border-l-blue-400',
    approved: 'border-l-blue-400',
    investigating: 'border-l-blue-400',
    picked_up: 'border-l-blue-400',

    // --- Preparing states (indigo) ---
    preparing: 'border-l-indigo-400',

    // --- In-Progress / Shipped states (violet) ---
    delivering: 'border-l-violet-400',
    shipped: 'border-l-violet-400',
    received: 'border-l-violet-400',
    received_at_center: 'border-l-violet-400',

    // --- Ready states (emerald) ---
    ready_for_pickup: 'border-l-emerald-400',

    // --- Success states (emerald) ---
    completed: 'border-l-emerald-400',
    paid: 'border-l-emerald-400',
    resolved: 'border-l-emerald-400',

    // --- Danger states (red) ---
    cancelled: 'border-l-red-400',
    cancelled_by_customer: 'border-l-red-400',
    cancelled_by_outlet: 'border-l-red-400',
    cancelled_and_released: 'border-l-red-400',
    rejected: 'border-l-red-400',
    rejected_by_outlet: 'border-l-red-400',
    failed: 'border-l-red-400',
    failed_delivery: 'border-l-red-400',
    expired: 'border-l-red-400',

    // --- Inventory health ---
    critical: 'border-l-red-400',
    low: 'border-l-amber-400',
    healthy: 'border-l-emerald-400',

    // --- Neutral / fallback ---
    waiting_assignment: 'border-l-slate-300',
    inactive: 'border-l-slate-300',
};
