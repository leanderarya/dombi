<?php

namespace App\Enums;

enum PaymentMethod: string
{
    case Qris = 'qris';
    case Ewallet = 'ewallet';
    case Transfer = 'transfer';
    case CreditCard = 'credit_card';

    // Legacy aliases for backward compat
    case Gopay = 'gopay';
    case Shopeepay = 'shopeepay';
    case Dana = 'dana';

    public function label(): string
    {
        return match ($this) {
            self::Qris => 'QRIS',
            self::Ewallet, self::Gopay, self::Shopeepay, self::Dana => 'E-Wallet',
            self::Transfer => 'Transfer Bank',
            self::CreditCard => 'Kartu Kredit',
        };
    }

    public function isAbsorbable(): bool
    {
        return match ($this) {
            self::Qris, self::Transfer, self::Ewallet,
            self::Gopay, self::Shopeepay, self::Dana => true,
            self::CreditCard => false,
        };
    }

    public function dokuType(): string
    {
        return match ($this) {
            self::Qris => 'QRIS',
            self::Ewallet, self::Gopay, self::Shopeepay, self::Dana => 'EWALLET',
            self::Transfer => 'VA',
            self::CreditCard => 'CREDIT_CARD',
        };
    }

    public function normalized(): self
    {
        return match ($this) {
            self::Gopay, self::Shopeepay, self::Dana => self::Ewallet,
            default => $this,
        };
    }
}
