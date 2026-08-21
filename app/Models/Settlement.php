<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Settlement extends Model
{
    use HasFactory;

    protected $fillable = [
        'outlet_id',
        'period_date',
        'period_start',
        'period_end',
        'period_type',
        'sales_amount',
        'delivery_fee_amount',
        'amount_due',
        'total_online_share',
        'total_delivery_cost',
        'total_refund',
        'total_offline_sales',
        'net_amount',
        'direction',
        'due_date',
        'status',
        'paid_amount',
        'adjustment_amount',
        'overpaid_amount',
        'paid_at',
        'notes',
        'last_invoice_sent_at',
    ];

    protected function casts(): array
    {
        return [
            'period_date' => 'date',
            'period_start' => 'date',
            'period_end' => 'date',
            'due_date' => 'date',
            'sales_amount' => 'decimal:2',
            'delivery_fee_amount' => 'decimal:2',
            'amount_due' => 'decimal:2',
            'total_online_share' => 'decimal:2',
            'total_delivery_cost' => 'decimal:2',
            'total_refund' => 'decimal:2',
            'total_offline_sales' => 'decimal:2',
            'net_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'adjustment_amount' => 'decimal:2',
            'overpaid_amount' => 'decimal:2',
            'paid_at' => 'datetime',
            'last_invoice_sent_at' => 'datetime',
        ];
    }

    // Status constants
    const STATUS_PENDING = 'pending';

    const STATUS_GENERATED = 'generated';

    const STATUS_DUE_TODAY = 'due_today';

    const STATUS_OVERDUE = 'overdue';

    const STATUS_PARTIAL = 'partial';

    const STATUS_PAID = 'paid';

    // Direction constants
    const DIRECTION_OWNER_PAYS = 'owner_pays_outlet';

    const DIRECTION_OUTLET_PAYS = 'outlet_pays_owner';

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SettlementPayment::class);
    }

    public function verifiedPayments(): HasMany
    {
        return $this->hasMany(SettlementPayment::class)
            ->where('status', SettlementPayment::STATUS_VERIFIED);
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(SettlementAuditLog::class);
    }

    public function isPaid(): bool
    {
        return $this->status === self::STATUS_PAID;
    }

    public function isOverdue(): bool
    {
        return in_array($this->status, [self::STATUS_OVERDUE, self::STATUS_PARTIAL], true)
            && $this->due_date->isPast();
    }

    public function isOverpaid(): bool
    {
        return (float) $this->overpaid_amount > 0;
    }

    public function isOwnerPaysOutlet(): bool
    {
        return $this->direction === self::DIRECTION_OWNER_PAYS;
    }

    public function isOutletPaysOwner(): bool
    {
        return $this->direction === self::DIRECTION_OUTLET_PAYS;
    }

    public function getAbsoluteNetAmountAttribute(): float
    {
        return abs((float) $this->net_amount);
    }

    public function getOutstandingAmountAttribute(): float
    {
        $absNet = abs((float) $this->net_amount);

        return max(0, $absNet - (float) $this->paid_amount - (float) $this->adjustment_amount);
    }

    public function getDaysOverdueAttribute(): int
    {
        if (! $this->isOverdue()) {
            return 0;
        }

        return max(0, (int) $this->due_date->diffInDays(now(), false));
    }

    /**
     * Human-readable period label, e.g. "23 Jun – 29 Jun 2026".
     */
    public function getPeriodLabelAttribute(): string
    {
        $start = $this->period_start;
        $end = $this->period_end;

        if ($start->isSameDay($end)) {
            return $start->format('d M Y');
        }

        if ($start->month === $end->month) {
            return $start->format('d').' – '.$end->format('d M Y');
        }

        return $start->format('d M').' – '.$end->format('d M Y');
    }

    /**
     * Recalculate status based on due date and credited amount.
     * Handles both positive net (Owner pays outlet) and negative net (outlet pays Owner).
     */
    public function recalculateStatus(): void
    {
        $netAmount = (float) $this->net_amount;

        // If net is zero, no payment needed — mark as paid
        if (abs($netAmount) < 0.01) {
            $this->status = self::STATUS_PAID;
            $this->paid_at = $this->paid_at ?? now();
            $this->save();

            return;
        }

        // Determine direction
        $this->direction = $netAmount >= 0
            ? self::DIRECTION_OWNER_PAYS
            : self::DIRECTION_OUTLET_PAYS;

        $absNet = abs($netAmount);
        $totalCredited = (float) $this->paid_amount + (float) $this->adjustment_amount;

        if ($totalCredited >= $absNet) {
            $this->status = self::STATUS_PAID;
            $this->overpaid_amount = max(0, $totalCredited - $absNet);
            if (! $this->paid_at) {
                $this->paid_at = now();
            }
        } else {
            $this->overpaid_amount = 0;
            if ($totalCredited > 0) {
                $this->status = $this->due_date->isPast()
                    ? self::STATUS_OVERDUE
                    : self::STATUS_PARTIAL;
            } elseif ($this->due_date->isToday()) {
                $this->status = self::STATUS_DUE_TODAY;
            } elseif ($this->due_date->isPast()) {
                $this->status = self::STATUS_OVERDUE;
            } else {
                $this->status = self::STATUS_GENERATED;
            }
        }

        $this->save();
    }
}
