<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class BootstrapInitialOwnerTest extends TestCase
{
    /** @var list<string> */
    private const REQUIRED_TEST_TABLES = [
        'outlets', 'product_categories', 'product_flavor_groups', 'products', 'orders',
        'payment_attempts', 'offline_sales', 'settlements', 'outlet_inventories',
        'payment_webhook_logs', 'owner_recovery_audit_logs',
    ];

    private string $credentialDirectory;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'app.env' => 'testing',
            'database.default' => 'sqlite',
            'database.connections.sqlite.driver' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
            'database.connections.sqlite.prefix' => '',
            'database.connections.sqlite.foreign_key_constraints' => true,
        ]);
        DB::purge('sqlite');
        DB::setDefaultConnection('sqlite');

        Schema::create('migrations', function (Blueprint $table): void {
            $table->id();
            $table->string('migration');
            $table->unsignedInteger('batch');
        });
        DB::table('migrations')->insert(collect(range(1, 165))->map(fn (int $index): array => [
            'migration' => "synthetic_test_schema_{$index}",
            'batch' => 1,
        ])->all());

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('role');
            $table->boolean('is_active')->default(true);
            $table->boolean('must_change_password')->default(false);
            $table->timestamps();
        });

        foreach (self::REQUIRED_TEST_TABLES as $tableName) {
            Schema::create($tableName, function (Blueprint $table): void {
                $table->id();
            });
        }

        $this->credentialDirectory = sys_get_temp_dir().'/dombi-bootstrap-test-'.bin2hex(random_bytes(8));
        mkdir($this->credentialDirectory, 0700);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->credentialDirectory.'/*') ?: [] as $path) {
            unlink($path);
        }
        rmdir($this->credentialDirectory);

        parent::tearDown();
    }

    public function test_it_creates_one_owner_with_a_private_one_time_secret_and_first_login_gate(): void
    {
        $exitCode = Artisan::call('dombi:bootstrap-owner', [
            '--name' => 'Synthetic Owner',
            '--email' => 'owner.synthetic@example.test',
            '--credential-dir' => $this->credentialDirectory,
        ]);
        $output = Artisan::output();

        $this->assertSame(0, $exitCode);
        $owner = User::query()->sole();
        $this->assertSame('owner', $owner->role);
        $this->assertTrue($owner->is_active);
        $this->assertTrue($owner->must_change_password);
        $this->assertNotSame('Synthetic Owner', $owner->password);
        $this->assertSame(1, preg_match('/^\$2y\$/', $owner->password) + preg_match('/^\$argon2/', $owner->password));
        $this->assertStringNotContainsString($owner->password, $output);
        $this->assertStringNotContainsString('Temporary password:', $output);

        $files = glob($this->credentialDirectory.'/*.txt') ?: [];
        $this->assertCount(1, $files);
        $this->assertSame(0600, fileperms($files[0]) & 0777);
        $secret = trim((string) preg_replace('/^.*Temporary password: ([^\r\n]+).*$/ms', '$1', file_get_contents($files[0])));
        $this->assertGreaterThanOrEqual(40, strlen($secret));
        $this->assertTrue(Hash::check($secret, $owner->password));
        $this->assertFalse(str_contains($output, $secret));
    }

    public function test_same_owner_rerun_is_a_no_op_and_does_not_rotate_the_secret(): void
    {
        $arguments = [
            '--name' => 'Synthetic Owner',
            '--email' => 'owner.synthetic@example.test',
            '--credential-dir' => $this->credentialDirectory,
        ];
        $this->assertSame(0, Artisan::call('dombi:bootstrap-owner', $arguments));
        $before = User::query()->sole()->password;
        $this->assertSame(0, Artisan::call('dombi:bootstrap-owner', $arguments));

        $this->assertSame($before, User::query()->sole()->password);
        $this->assertCount(1, glob($this->credentialDirectory.'/*.txt') ?: []);
        $this->assertSame(1, User::query()->count());
    }

    public function test_it_refuses_existing_non_owner_users_without_promoting_them(): void
    {
        User::forceCreate([
            'name' => 'Synthetic Outlet',
            'email' => 'outlet.synthetic@example.test',
            'password' => 'synthetic-password',
            'role' => 'outlet',
            'is_active' => true,
        ]);

        $exitCode = Artisan::call('dombi:bootstrap-owner', [
            '--name' => 'Synthetic Owner',
            '--email' => 'outlet.synthetic@example.test',
            '--credential-dir' => $this->credentialDirectory,
        ]);

        $this->assertSame(1, $exitCode, 'Command output: '.Artisan::output());
        $this->assertSame('outlet', User::query()->sole()->role);
        $this->assertCount(0, glob($this->credentialDirectory.'/*') ?: []);
        $this->assertStringNotContainsString('outlet.synthetic@example.test', Artisan::output());
    }

    public function test_it_refuses_nonempty_catalog_or_non_disposable_environment(): void
    {
        DB::table('products')->insert(['id' => 1]);
        $this->assertSame(1, DB::table('products')->count());
        $exitCode = Artisan::call('dombi:bootstrap-owner', [
            '--name' => 'Synthetic Owner',
            '--email' => 'owner.synthetic@example.test',
            '--credential-dir' => $this->credentialDirectory,
        ]);

        $this->assertSame(1, $exitCode, 'Command output: '.Artisan::output());
        $this->assertSame(0, User::query()->count(), 'Command output: '.Artisan::output());
        $this->assertCount(0, glob($this->credentialDirectory.'/*') ?: []);

        DB::table('products')->delete();
        DB::table('payment_webhook_logs')->insert(['id' => 1]);
        $exitCode = Artisan::call('dombi:bootstrap-owner', [
            '--name' => 'Synthetic Owner',
            '--email' => 'owner.synthetic@example.test',
            '--credential-dir' => $this->credentialDirectory,
        ]);

        $this->assertSame(1, $exitCode, 'Command output: '.Artisan::output());
        $this->assertSame(0, User::query()->count(), 'Command output: '.Artisan::output());
        $this->assertCount(0, glob($this->credentialDirectory.'/*') ?: []);

        DB::table('payment_webhook_logs')->delete();
        $this->app->detectEnvironment(fn () => 'staging');
        $exitCode = Artisan::call('dombi:bootstrap-owner', [
            '--name' => 'Synthetic Owner',
            '--email' => 'owner.synthetic@example.test',
            '--credential-dir' => $this->credentialDirectory,
        ]);

        $this->assertSame(1, $exitCode);
        $this->assertSame(0, User::query()->count());
        $this->assertCount(0, glob($this->credentialDirectory.'/*') ?: []);
    }

    public function test_it_refuses_a_migration_baseline_mismatch(): void
    {
        DB::table('migrations')->where('id', 165)->delete();

        $exitCode = Artisan::call('dombi:bootstrap-owner', [
            '--name' => 'Synthetic Owner',
            '--email' => 'owner.synthetic@example.test',
            '--credential-dir' => $this->credentialDirectory,
        ]);

        $this->assertSame(1, $exitCode);
        $this->assertSame(0, User::query()->count());
        $this->assertCount(0, glob($this->credentialDirectory.'/*') ?: []);
    }

    public function test_failed_owner_insert_removes_the_unneeded_private_credential(): void
    {
        DB::statement("CREATE TRIGGER synthetic_fail_owner_insert BEFORE INSERT ON users BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");

        $exitCode = Artisan::call('dombi:bootstrap-owner', [
            '--name' => 'Synthetic Owner',
            '--email' => 'owner.synthetic@example.test',
            '--credential-dir' => $this->credentialDirectory,
        ]);

        $this->assertSame(1, $exitCode);
        $this->assertSame(0, User::query()->count());
        $this->assertCount(0, glob($this->credentialDirectory.'/*') ?: []);
        $this->assertStringNotContainsString('Temporary password:', Artisan::output());
    }

    public function test_credential_directory_must_be_private_and_outside_the_application(): void
    {
        $publicDirectory = public_path();
        $exitCode = Artisan::call('dombi:bootstrap-owner', [
            '--name' => 'Synthetic Owner',
            '--email' => 'owner.synthetic@example.test',
            '--credential-dir' => $publicDirectory,
        ]);

        $this->assertSame(1, $exitCode);
        $this->assertSame(0, User::query()->count());
        $this->assertCount(0, glob($this->credentialDirectory.'/*') ?: []);
    }

    public function test_production_target_identity_mismatch_is_rejected_before_a_transaction(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        $connection = \Mockery::mock();
        $connection->shouldReceive('getDriverName')->twice()->andReturn('mysql');
        $connection->shouldReceive('getPdo')->twice()->andReturn(
            $this->identityPdo('wrong_schema', 'u399215191_dombi_ap_1023@localhost'),
            $this->identityPdo('u399215191_dombi_pr_1023', 'wrong_user@localhost'),
        );
        DB::shouldReceive('connection')->twice()->andReturn($connection);

        foreach (['owner.one@example.test', 'owner.two@example.test'] as $email) {
            $exitCode = Artisan::call('dombi:bootstrap-owner', [
                '--name' => 'Synthetic Owner',
                '--email' => $email,
                '--credential-dir' => $this->credentialDirectory,
            ]);

            $this->assertSame(1, $exitCode);
            $this->assertStringNotContainsString('wrong_schema', Artisan::output());
            $this->assertStringNotContainsString('wrong_user', Artisan::output());
        }

        $this->assertSame(0, User::query()->count());
        $this->assertCount(0, glob($this->credentialDirectory.'/*') ?: []);
    }

    private function identityPdo(string $schema, string $account): object
    {
        return new class($schema, $account)
        {
            public function __construct(private string $schema, private string $account) {}

            public function query(string $query): object
            {
                if ($query !== 'SELECT DATABASE() AS schema_name, CURRENT_USER() AS account_name') {
                    throw new \RuntimeException('Unexpected test query.');
                }

                return new class($this->schema, $this->account)
                {
                    public function __construct(private string $schema, private string $account) {}

                    public function fetch(int $mode): object
                    {
                        return (object) ['schema_name' => $this->schema, 'account_name' => $this->account];
                    }
                };
            }
        };
    }
}
