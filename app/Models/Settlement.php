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
        'sales_amount',
        'amount_due',
        'due_date',
        'status',
        'paid_amount',
        'adjustment_amount',
        'paid_at',
        'notes',
        'last_invoice_sent_at',
    ];

    protected function casts(): array
    {
        return [
            'period_date' => 'date',
            'due_date' => 'date',
            'sales_amount' => 'decimal:2',
            'amount_due' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'adjustment_amount' => 'decimal:2',
            'paid_at' => 'datetime',
            'last_invoice_sent_at' => 'datetime',
        ];
    }

    // Status constants
    const STATUS_GENERATED = 'generated';

    const STATUS_PENDING = 'pending';

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
        return $this->status === self::STATUS_OVERDUE;
    }

    public function getRemainingAmountAttribute(): float
    {
        return max(0, (float) $this->amount_due - (float) $this->paid_amount);
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
     * Recalculate status based on due date and credited amount.
     */
    public function recalculateStatus(): void
    {
        $totalCredited = (float) $this->paid_amount + (float) $this->adjustment_amount;

        if ($totalCredited >= (float) $this->amount_due) {
            $this->status = self::STATUS_PAID;
            if (! $this->paid_at) {
                $this->paid_at = now();
            }
        } elseif ($totalCredited > 0) {
            $this->status = self::STATUS_PARTIAL;
        } elseif ($this->due_date->isToday()) {
            $this->status = self::STATUS_DUE_TODAY;
        } elseif ($this->due_date->isPast()) {
            $this->status = self::STATUS_OVERDUE;
        } else {
            $this->status = self::STATUS_GENERATED;
        }

        $this->save();
    }
}
