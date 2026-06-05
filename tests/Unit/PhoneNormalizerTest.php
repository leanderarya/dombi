<?php

namespace Tests\Unit;

use App\Support\PhoneNormalizer;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PhoneNormalizerTest extends TestCase
{
    #[DataProvider('phoneFormatProvider')]
    public function test_normalizes_indonesian_phone_formats(string $input, string $expected): void
    {
        $this->assertSame($expected, PhoneNormalizer::normalize($input));
    }

    public static function phoneFormatProvider(): array
    {
        return [
            '08 format' => ['081234567890', '6281234567890'],
            '628 format' => ['6281234567890', '6281234567890'],
            '+628 format' => ['+6281234567890', '6281234567890'],
            '8 format (no leading 0)' => ['81234567890', '6281234567890'],
            'with spaces' => ['0812 3456 7890', '6281234567890'],
            'with dashes' => ['0812-3456-7890', '6281234567890'],
            'with parentheses' => ['(0812) 3456 7890', '6281234567890'],
            'already normalized' => ['6281234567890', '6281234567890'],
        ];
    }

    #[DataProvider('validPhoneProvider')]
    public function test_validates_indonesian_phone(string $phone, bool $expected): void
    {
        $this->assertSame($expected, PhoneNormalizer::isValidIndonesian($phone));
    }

    public static function validPhoneProvider(): array
    {
        return [
            'valid 12 digits' => ['6281234567890', true],
            'valid 11 digits' => ['628123456789', true],
            'valid 13 digits' => ['62812345678901', true],
            'too short' => ['628123456', false],
            'wrong prefix' => ['081234567890', false],
            'empty' => ['', false],
            'letters' => ['abcdefghij', false],
        ];
    }
}
