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
            'paid_amount' => 'decimal:2',
            'adjustment_amount' => 'decimal:2',
            'overpaid_amount' => 'decimal:2',
            'paid_at' => 'datetime',
            'last_invoice_sent_at' => 'datetime',
        ];
    }

    // Status constants
    const STATUS_GENERATED = 'generated';

    const STATUS_DUE_TODAY = 'due_today';

    const STATUS_OVERDUE = 'overdue';

    const STATUS_PARTIAL = 'partial';

    const STATUS_PAID = 'paid';

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

    public function getOutstandingAmountAttribute(): float
    {
        return max(0, (float) $this->amount_due - (float) $this->paid_amount - (float) $this->adjustment_amount);
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
     */
    public function recalculateStatus(): void
    {
        $totalCredited = (float) $this->paid_amount + (float) $this->adjustment_amount;
        $amountDue = (float) $this->amount_due;

        if ($totalCredited >= $amountDue) {
            $this->status = self::STATUS_PAID;
            $this->overpaid_amount = max(0, $totalCredited - $amountDue);
            if (! $this->paid_at) {
                $this->paid_at = now();
            }
        } else {
            $this->overpaid_amount = 0;
            if ($totalCredited > 0) {
                if ($this->due_date->isPast()) {
                    $this->status = self::STATUS_OVERDUE;
                } else {
                    $this->status = self::STATUS_PARTIAL;
                }
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
