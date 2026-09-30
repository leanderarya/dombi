<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * `$request->date()` is not null-safe: it throws InvalidFormatException on a
 * value Carbon cannot parse, turning a hand-edited or shared filter URL into a
 * 500. Every date filter now goes through App\Support\QueryDate instead, which
 * resolves to null so the query macros' existing "unparseable means no rows"
 * rule applies.
 */
class MalformedDateFilterTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, array{string}>
     */
    public static function ownerEndpoints(): array
    {
        return [
            'analytics custom range' => ['/owner/analytics?period=custom&date_from=notadate&date_to=notadate'],
            'analytics laporan tab' => ['/owner/analytics?tab=laporan&date_from=notadate&date_to=notadate'],
            'orders' => ['/owner/orders?date=notadate'],
            'deliveries' => ['/owner/deliveries?date=notadate'],
            'exchanges' => ['/owner/exchanges?date=notadate&date_from=notadate&date_to=notadate'],
            'restocks' => ['/owner/restocks?date=notadate'],
            'returns pengembalian' => ['/owner/returns?tab=pengembalian&date=notadate'],
            'returns penukaran' => ['/owner/returns?tab=penukaran&date=notadate'],
            'reports export csv' => ['/owner/reports/export-csv?date_from=notadate&date_to=notadate'],
        ];
    }

    /**
     * @return array<string, array{string}>
     */
    public static function outletEndpoints(): array
    {
        return [
            'analytics custom range' => ['/outlet/analytics?period=custom&date_from=notadate&date_to=notadate'],
            'reports custom range' => ['/outlet/reports?period=custom&date_from=notadate&date_to=notadate'],
            'reports export' => ['/outlet/reports/sales/export?period=custom&date_from=notadate&date_to=notadate'],
            'settlement custom range' => ['/outlet/settlement?period=custom&from=notadate&to=notadate'],
        ];
    }

    #[DataProvider('ownerEndpoints')]
    public function test_owner_date_filters_survive_a_malformed_value(string $url): void
    {
        $owner = User::factory()->create(['role' => 'owner']);

        $this->actingAs($owner)->get($url)->assertOk();
    }

    #[DataProvider('outletEndpoints')]
    public function test_outlet_date_filters_survive_a_malformed_value(string $url): void
    {
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);

        $this->actingAs($user)->get($url)->assertOk();
    }

    public function test_a_valid_date_still_filters(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);

        $this->actingAs($owner)->get('/owner/orders?date='.now()->toDateString())->assertOk();
        $this->actingAs($owner)->get('/owner/deliveries?date='.now()->toDateString())->assertOk();
    }

    public function test_every_date_parameter_used_by_a_list_page_is_covered(): void
    {
        $controllers = [
            'app/Http/Controllers/Owner',
            'app/Http/Controllers/Outlet',
        ];

        $offenders = [];

        foreach ($controllers as $directory) {
            $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(base_path($directory)));

            foreach ($files as $file) {
                if (! $file->isFile() || $file->getExtension() !== 'php') {
                    continue;
                }

                $contents = file_get_contents($file->getPathname());

                if (preg_match('/\$request->date\(|request\(\)->date\(|Carbon::parse\(\$request/', $contents)) {
                    $offenders[] = str_replace(base_path().'/', '', $file->getPathname());
                }
            }
        }

        $this->assertSame([], $offenders, 'These files still parse query dates in a way that can throw.');
    }
}
