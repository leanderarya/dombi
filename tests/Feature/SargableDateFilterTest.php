<?php

namespace Tests\Feature;

use App\Models\Order;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SargableDateFilterTest extends TestCase
{
    use RefreshDatabase;

    public function test_where_on_day_selects_the_same_rows_as_where_date(): void
    {
        $day = CarbonImmutable::parse('2026-09-22');

        $this->seedAt([
            [$day->subDay()->setTime(23, 59, 59), 'before'],
            [$day->setTime(0, 0, 0), 'start'],
            [$day->setTime(12, 0, 0), 'middle'],
            [$day->setTime(23, 59, 59), 'end'],
            [$day->addDay()->setTime(0, 0, 0), 'after'],
        ]);

        $legacy = $this->labelsFor(fn ($query) => $query->whereDate('created_at', $day));
        $sargable = $this->labelsFor(fn ($query) => $query->whereOnDay('created_at', $day));

        $this->assertSame(['end', 'middle', 'start'], $legacy);
        $this->assertSame($legacy, $sargable);
    }

    public function test_where_from_day_selects_the_same_rows_as_where_date_greater_equal(): void
    {
        $this->seedAt([
            [CarbonImmutable::parse('2026-09-19 23:59:59'), 'before'],
            [CarbonImmutable::parse('2026-09-20 00:00:00'), 'start'],
            [CarbonImmutable::parse('2026-09-21 23:59:59'), 'end'],
            [CarbonImmutable::parse('2026-09-22 00:00:00'), 'after'],
        ]);

        $legacy = $this->labelsFor(fn ($query) => $query->whereDate('created_at', '>=', '2026-09-20'));
        $sargable = $this->labelsFor(fn ($query) => $query->whereFromDay('created_at', '2026-09-20'));

        $this->assertSame(['after', 'end', 'start'], $legacy);
        $this->assertSame($legacy, $sargable);
    }

    public function test_where_until_day_selects_the_same_rows_as_where_date_less_equal(): void
    {
        $this->seedAt([
            [CarbonImmutable::parse('2026-09-19 23:59:59'), 'before'],
            [CarbonImmutable::parse('2026-09-20 00:00:00'), 'start'],
            [CarbonImmutable::parse('2026-09-21 23:59:59'), 'end'],
            [CarbonImmutable::parse('2026-09-22 00:00:00'), 'after'],
        ]);

        $legacy = $this->labelsFor(fn ($query) => $query->whereDate('created_at', '<=', '2026-09-21'));
        $sargable = $this->labelsFor(fn ($query) => $query->whereUntilDay('created_at', '2026-09-21'));

        $this->assertSame(['before', 'end', 'start'], $legacy);
        $this->assertSame($legacy, $sargable);
    }

    public function test_where_in_month_selects_the_same_rows_as_where_month_and_year(): void
    {
        $this->seedAt([
            [CarbonImmutable::parse('2026-08-31 23:59:59'), 'before'],
            [CarbonImmutable::parse('2026-09-01 00:00:00'), 'start'],
            [CarbonImmutable::parse('2026-09-30 23:59:59'), 'end'],
            [CarbonImmutable::parse('2026-10-01 00:00:00'), 'after'],
        ]);

        $legacy = $this->labelsFor(fn ($query) => $query
            ->whereMonth('created_at', 9)
            ->whereYear('created_at', 2026));
        $sargable = $this->labelsFor(fn ($query) => $query->whereInMonth('created_at', '2026-09-15'));

        $this->assertSame(['end', 'start'], $legacy);
        $this->assertSame($legacy, $sargable);
    }

    public function test_unusable_day_input_matches_nothing_like_where_date(): void
    {
        $this->seedAt([
            [CarbonImmutable::parse('2026-09-22 12:00:00'), 'row'],
        ]);

        $legacy = $this->labelsFor(fn ($query) => $query->whereDate('created_at', null));
        $sargable = $this->labelsFor(fn ($query) => $query->whereOnDay('created_at', null));

        $this->assertSame([], $legacy);
        $this->assertSame($legacy, $sargable);

        $this->assertSame([], $this->labelsFor(fn ($query) => $query->whereFromDay('created_at', 'not-a-date')));
        $this->assertSame([], $this->labelsFor(fn ($query) => $query->whereUntilDay('created_at', 'not-a-date')));
        $this->assertSame([], $this->labelsFor(fn ($query) => $query->whereInMonth('created_at', '')));
    }

    private function seedAt(array $moments): void
    {
        foreach ($moments as [$moment, $label]) {
            Order::factory()->create([
                'order_code' => $label,
                'created_at' => $moment,
                'updated_at' => $moment,
            ]);
        }
    }

    private function labelsFor(callable $constraint): array
    {
        return $constraint(Order::query())->orderBy('order_code')->pluck('order_code')->all();
    }
}
