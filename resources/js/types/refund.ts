export type RefundPaymentStatus =
    | 'refund_pending'
    | 'refund_in_progress'
    | 'refunded'
    | 'refund_rejected'
    | 'refund_failed';
export type RefundDestinationStatus = 'missing' | 'valid' | 'invalid';
export type RefundQueue =
    | 'awaiting_customer' | 'awaiting_guest' | 'ready' | 'in_progress'
    | 'action_required' | 'completed' | 'rejected';
export type RefundDestinationType = 'bank' | 'ewallet';

export interface RefundHistoryItem {
    id: number;
    event: string;
    from_status: string | null;
    to_status: string;
    actor_type: 'customer' | 'guest' | 'outlet' | 'owner' | 'system';
    reason_code: string | null;
    note: string | null;
    metadata: Record<string, string | number | boolean | null>;
    created_at: string;
}

export interface MaskedRefundDestination {
    type: RefundDestinationType;
    label: string;
    holder: string;
    masked_number: string;
}
export interface FullRefundDestination {
    type: RefundDestinationType;
    label: string;
    holder: string;
    number: string;
}
export interface RefundRejection {
    code: string;
    label: string;
    note: string | null;
    can_resubmit: boolean;
}
export interface RefundBase {
    order_id: number;
    payment_status: RefundPaymentStatus;
    destination_status: RefundDestinationStatus | null;
    queue_state: RefundQueue;
    status_label: string;
    amount: number;
    requested_at: string | null;
    submitted_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    rejection: RefundRejection | null;
    timeline: RefundHistoryItem[];
}
export interface CustomerRefundPayload extends RefundBase {
    role: 'customer';
    destination: MaskedRefundDestination | null;
    can_edit_destination: boolean;
    can_resubmit: boolean;
    proof_url: string | null;
    transfer_reference: string | null;
    transfer_note: string | null;
}
export interface GuestRefundPayload extends RefundBase {
    role: 'guest';
    guidance: string;
}
export interface OutletRefundPayload extends RefundBase { role: 'outlet'; }
export interface OwnerRefundPayload extends RefundBase {
    role: 'owner';
    order_code: string;
    order_url: string;
    customer_kind: 'registered' | 'guest';
    customer_name: string;
    customer_phone: string;
    destination: FullRefundDestination | null;
    proof_url: string | null;
    transfer_reference: string | null;
    transfer_note: string | null;
    can_enter_destination: boolean;
    can_legacy_repair: boolean;
    can_start: boolean;
    can_reject: boolean;
    can_rollback: boolean;
    can_complete: boolean;
}
export type RefundQueueCounts = Record<RefundQueue, number>;
export interface RefundPagination {
    data: OwnerRefundPayload[];
    links: { url: string | null; label: string; active: boolean }[];
    current_page: number;
    last_page: number;
    total: number;
}
