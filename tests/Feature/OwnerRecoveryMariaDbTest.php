<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class OwnerRecoveryMariaDbTest extends TestCase
{
    private const OWNER_EMAIL = 'dombicenter@gmail.com';

    private const CONFIRMATION = 'RECOVER OWNER dombicenter@gmail.com';

    private const TEST_DATABASE = 'dombi_owner_recovery_test';

    private const TEST_USER = 'dombi_owner_test';

    private string $credentialDirectory;

    private string $childAutoloader;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();

        if (getenv('DOMBI_OWNER_RECOVERY_MARIADB') !== '1') {
            $this->markTestSkipped('Set DOMBI_OWNER_RECOVERY_MARIADB=1 only for the dedicated disposable MariaDB test instance.');
        }

        $this->assertDisposableDatabaseIdentityAndPrivileges();
        config([
            'app.key' => 'base64:'.base64_encode(random_bytes(32)),
            'session.driver' => 'database',
            'session.connection' => null,
            'session.table' => 'sessions',
        ]);
        $version = DB::selectOne('SELECT VERSION() AS version')->version;
        $this->assertStringStartsWith('11.8.9-MariaDB', (string) $version);
        $this->assertSame(0, Artisan::call('migrate:fresh', ['--force' => true]), Artisan::output());
        $this->assertDisposableDatabaseIdentityAndPrivileges();

        $this->credentialDirectory = sys_get_temp_dir().'/dombi-owner-recovery-'.bin2hex(random_bytes(8));
        mkdir($this->credentialDirectory, 0700);
        chmod($this->credentialDirectory, 0700);
        $this->childAutoloader = $this->createChildAutoloader();
    }

    protected function tearDown(): void
    {
        if (isset($this->credentialDirectory) && is_dir($this->credentialDirectory)) {
            foreach (glob($this->credentialDirectory.'/*') ?: [] as $path) {
                if (is_file($path) && ! is_link($path)) {
                    unlink($path);
                } elseif (is_dir($path) && ! is_link($path)) {
                    rmdir($path);
                }
            }

            rmdir($this->credentialDirectory);
        }

        if (isset($this->childAutoloader) && is_file($this->childAutoloader)) {
            unlink($this->childAutoloader);
        }

        parent::tearDown();
    }

    public function test_recovery_is_authorized_repeatable_concurrent_and_requires_first_login_password_change(): void
    {
        $this->assertSame(0, User::query()->count(), 'Fresh migration must not introduce a demo or default owner.');
        $this->assertSame(0, DB::table('products')->count());
        $owner = $this->createApprovedSyntheticOwner();
        $originalPasswordHash = $owner->password;
        $originalRememberToken = $owner->remember_token;

        $wrongConfirmation = $this->runRecovery([
            '--confirm-recovery' => 'RECOVER OWNER wrong@example.test',
            '--operation-id' => '11111111-1111-4111-8111-111111111111',
        ]);
        $this->assertSame(1, $wrongConfirmation['exit']);
        $this->assertSame($originalPasswordHash, $owner->fresh()->password);

        $wrongOwnerEmail = $this->runRecovery([
            '--owner-email' => 'another-owner@example.test',
            '--operation-id' => '12121212-1212-4121-8121-121212121212',
        ]);
        $this->assertSame(1, $wrongOwnerEmail['exit']);
        $this->assertSame($originalPasswordHash, $owner->fresh()->password);

        $this->assertDisposableDatabaseIdentityAndPrivileges();
        config(['database.connections.mysql.database' => 'unexpected_recovery_test']);
        DB::purge('mysql');
        $wrongSchema = $this->runRecovery(['--operation-id' => '22222222-2222-4222-8222-222222222222']);
        $this->assertSame(1, $wrongSchema['exit']);
        config(['database.connections.mysql.database' => self::TEST_DATABASE]);
        DB::purge('mysql');

        $this->assertDisposableDatabaseIdentityAndPrivileges();
        config(['database.connections.mysql.username' => 'unexpected_recovery_user']);
        DB::purge('mysql');
        $wrongDatabaseUser = $this->runRecovery(['--operation-id' => '33333333-3333-4333-8333-333333333333']);
        $this->assertSame(1, $wrongDatabaseUser['exit']);
        config(['database.connections.mysql.username' => self::TEST_USER]);
        DB::purge('mysql');

        $this->assertDisposableDatabaseIdentityAndPrivileges();
        $this->app->detectEnvironment(static fn (): string => 'staging');
        $wrongEnvironment = $this->runRecovery(['--operation-id' => '44444444-4444-4444-8444-444444444444']);
        $this->assertSame(1, $wrongEnvironment['exit']);
        $this->app->detectEnvironment(static fn (): string => 'testing');

        $owner->forceFill(['role' => 'outlet'])->save();
        $unauthorizedAccount = $this->runRecovery(['--operation-id' => '55555555-5555-4555-8555-555555555555']);
        $this->assertSame(1, $unauthorizedAccount['exit']);
        $owner->forceFill(['role' => 'owner'])->save();
        $this->assertSame($originalPasswordHash, $owner->fresh()->password);

        $unsafeDirectory = $this->credentialDirectory.'/unsafe';
        mkdir($unsafeDirectory, 0755);
        chmod($unsafeDirectory, 0755);
        $unsafeCredentialPath = $this->runRecovery([
            '--credential-dir' => $unsafeDirectory,
            '--operation-id' => '66666666-6666-4666-8666-666666666666',
        ]);
        $this->assertSame(1, $unsafeCredentialPath['exit']);
        $this->assertSame($originalPasswordHash, $owner->fresh()->password);

        $sessionCookie = (string) config('session.cookie');
        $loggedInSessionIds = [];
        foreach (['synthetic-browser-session-one', 'synthetic-browser-session-two'] as $sessionId) {
            $login = $this->withCookie($sessionCookie, $sessionId)
                ->post(route('login'), ['email' => self::OWNER_EMAIL, 'password' => 'Synthetic-Old-Password-982!'])
                ->assertRedirect(route('dashboard'));
            $responseCookie = $login->getCookie($sessionCookie);
            $this->assertNotNull($responseCookie, 'Successful login must return a session cookie.');
            $loggedInSessionIds[] = $responseCookie->getValue();
        }
        $this->assertNotSame($loggedInSessionIds[0], $loggedInSessionIds[1]);
        $this->assertSame(2, DB::table('sessions')->where('user_id', $owner->getKey())->count());

        $this->assertDisposableDatabaseIdentityAndPrivileges();
        DB::unprepared("CREATE TRIGGER fail_owner_recovery_audit BEFORE INSERT ON owner_recovery_audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic audit failure'");
        $safeFailure = $this->runRecovery(['--operation-id' => '77777777-7777-4777-8777-777777777777']);
        $this->assertSame(1, $safeFailure['exit']);
        $this->assertSame($originalPasswordHash, $owner->fresh()->password);
        $this->assertSame($originalRememberToken, $owner->fresh()->remember_token);
        $this->assertFalse((bool) $owner->fresh()->must_change_password);
        $this->assertSame(2, DB::table('sessions')->where('user_id', $owner->getKey())->count());
        $this->assertSame(0, DB::table('owner_recovery_audit_logs')->count());
        $this->assertCount(0, glob($this->credentialDirectory.'/*.txt') ?: []);
        $this->assertDisposableDatabaseIdentityAndPrivileges();
        DB::unprepared('DROP TRIGGER fail_owner_recovery_audit');

        $operationIds = [
            '88888888-8888-4888-8888-888888888888',
            '99999999-9999-4999-8999-999999999999',
        ];
        $processes = [];
        foreach ($operationIds as $operationId) {
            [$process, $pipes] = $this->startCommandProcess($operationId);
            $processes[] = [$process, $pipes];
        }

        $processResults = [];
        foreach ($processes as [$process, $pipes]) {
            $stdout = stream_get_contents($pipes[1]);
            $stderr = stream_get_contents($pipes[2]);
            fclose($pipes[1]);
            fclose($pipes[2]);
            $processResults[] = [
                'exit' => proc_close($process),
                'output' => (string) $stdout.(string) $stderr,
            ];
        }

        $exitCodes = array_column($processResults, 'exit');
        sort($exitCodes);
        $this->assertSame([0, 1], $exitCodes, implode("\n", array_column($processResults, 'output')));
        $this->assertSame(1, User::query()->count(), 'Recovery must not create a duplicate owner account.');
        $this->assertSame(1, DB::table('owner_recovery_audit_logs')->count());
        $event = DB::table('owner_recovery_audit_logs')->sole();
        $this->assertContains($event->operation_id, $operationIds);
        $this->assertSame($owner->getKey(), (int) $event->user_id);
        $this->assertSame('owner_password_recovered', $event->event);
        $this->assertNotSame('', $event->operator);
        $this->assertSame('database:revoked', $event->session_driver);
        $this->assertSame(2, (int) $event->sessions_revoked);

        $credentialFiles = glob($this->credentialDirectory.'/dombi-owner-recovery-*.txt') ?: [];
        $this->assertCount(1, $credentialFiles);
        $this->assertSame(0700, fileperms($this->credentialDirectory) & 0777);
        $this->assertSame(0600, fileperms($credentialFiles[0]) & 0777);
        $contents = file_get_contents($credentialFiles[0]);
        $this->assertIsString($contents);
        $this->assertMatchesRegularExpression('/^Temporary password: ([^\r\n]{40,})$/m', $contents);
        preg_match('/^Temporary password: ([^\r\n]{40,})$/m', $contents, $passwordMatch);
        $temporaryPassword = $passwordMatch[1];

        $owner->refresh();
        $this->assertSame('owner', $owner->role);
        $this->assertTrue($owner->is_active);
        $this->assertTrue($owner->must_change_password);
        $this->assertTrue(Hash::check($temporaryPassword, $owner->password));
        $this->assertFalse($temporaryPassword === $owner->password);
        $this->assertNotSame($originalRememberToken, $owner->remember_token);
        $this->assertSame(0, DB::table('sessions')->where('user_id', $owner->getKey())->count());
        foreach ($loggedInSessionIds as $sessionId) {
            app('session')->forgetDrivers();
            app()->forgetInstance('session.store');
            Auth::forgetGuards();
            $this->withCookie($sessionCookie, $sessionId)
                ->get(route('owner.dashboard'))
                ->assertRedirect(route('login'));
        }
        $this->assertNotSame(0, preg_match('/[A-Z]/', $temporaryPassword));
        $this->assertNotSame(0, preg_match('/[a-z]/', $temporaryPassword));
        $this->assertNotSame(0, preg_match('/[0-9]/', $temporaryPassword));
        $this->assertNotSame(0, preg_match('/[^A-Za-z0-9]/', $temporaryPassword));
        foreach ($processResults as $result) {
            $this->assertFalse(str_contains($result['output'], $temporaryPassword));
            $this->assertStringNotContainsString('Temporary password:', $result['output']);
        }

        $confirmationOutput = $wrongConfirmation['output'].$wrongOwnerEmail['output'].$wrongSchema['output'].$wrongDatabaseUser['output'].$wrongEnvironment['output'].$unauthorizedAccount['output'].$unsafeCredentialPath['output'].$safeFailure['output'];
        $this->assertFalse(str_contains($confirmationOutput, $temporaryPassword));
        $this->assertStringNotContainsString('Temporary password:', $confirmationOutput);

        $passwordHashBeforeNoOp = $owner->password;
        $idempotent = $this->runRecovery($this->recoveryOptions($event->operation_id));
        $this->assertSame(0, $idempotent['exit']);
        $this->assertFalse(str_contains($idempotent['output'], $temporaryPassword));
        $this->assertSame($passwordHashBeforeNoOp, $owner->fresh()->password);
        $this->assertCount(1, glob($this->credentialDirectory.'/dombi-owner-recovery-*.txt') ?: []);

        $duplicateReset = $this->runRecovery(['--operation-id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
        $this->assertSame(1, $duplicateReset['exit']);
        $this->assertFalse(str_contains($duplicateReset['output'], $temporaryPassword));
        $this->assertSame($passwordHashBeforeNoOp, $owner->fresh()->password);
        $this->assertSame(1, DB::table('owner_recovery_audit_logs')->count());

        $this->post(route('login'), ['email' => self::OWNER_EMAIL, 'password' => $temporaryPassword])
            ->assertRedirect(route('dashboard'));
        $this->get(route('owner.dashboard'))->assertRedirect(route('password.change'));
        $this->getJson(route('system.status'))->assertRedirect(route('password.change'));
        $this->put(route('password.update'), [
            'current_password' => $temporaryPassword,
            'password' => 'Synthetic-New-Password-843!',
            'password_confirmation' => 'Synthetic-New-Password-843!',
        ])->assertRedirect(route('dashboard'));

        $owner->refresh();
        $this->assertFalse($owner->must_change_password);
        $this->assertTrue(Hash::check('Synthetic-New-Password-843!', $owner->password));
        $this->assertFalse(Hash::check($temporaryPassword, $owner->password));
        $this->post(route('logout'))->assertRedirect(route('login'));
        $this->postJson(route('login'), ['email' => self::OWNER_EMAIL, 'password' => $temporaryPassword])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
        $this->post(route('login'), ['email' => self::OWNER_EMAIL, 'password' => 'Synthetic-New-Password-843!'])
            ->assertRedirect(route('dashboard'));
        $this->withHeaders(['X-Inertia' => 'true'])
            ->get(route('owner.dashboard'))
            ->assertOk()
            ->assertJsonPath('component', 'owner/dashboard');
    }

    public function test_session_store_preflight_fails_closed_without_changing_owner_sessions_or_credentials(): void
    {
        $owner = $this->createApprovedSyntheticOwner();
        DB::table('sessions')->insert([
            'id' => 'preflight-owner-session',
            'user_id' => $owner->getKey(),
            'payload' => 'synthetic-payload',
            'last_activity' => now()->timestamp,
        ]);

        $invalidDrivers = ['file', 'redis', 'cookie', 'array'];
        foreach ($invalidDrivers as $index => $driver) {
            config(['session.driver' => $driver, 'session.connection' => null]);
            app('session')->forgetDrivers();
            $this->assertRecoveryPreflightRejected($owner, sprintf('b0000000-0000-4000-8000-%012d', $index + 1));
        }

        config(['session.driver' => 'database', 'session.connection' => 'unapproved_session_connection']);
        app('session')->forgetDrivers();
        $this->assertRecoveryPreflightRejected($owner, 'b0000000-0000-4000-8000-000000000005');

        $this->assertDisposableDatabaseIdentityAndPrivileges();
        DB::statement('DROP TABLE sessions');
        config(['session.connection' => null]);
        app('session')->forgetDrivers();
        $this->assertRecoveryPreflightRejected($owner, 'b0000000-0000-4000-8000-000000000006');
        $this->assertFalse(Schema::hasTable('sessions'));

        $this->assertDisposableDatabaseIdentityAndPrivileges();
        Schema::create('sessions', function ($table): void {
            $table->string('id')->primary();
            $table->longText('payload');
            $table->integer('last_activity');
        });
        DB::table('sessions')->insert([
            'id' => 'preflight-owner-session',
            'payload' => 'synthetic-payload',
            'last_activity' => now()->timestamp,
        ]);
        $this->assertRecoveryPreflightRejected($owner, 'b0000000-0000-4000-8000-000000000007');
        $this->assertSame('synthetic-payload', DB::table('sessions')->where('id', 'preflight-owner-session')->value('payload'));

        app('session')->extend('database', static function (): never {
            throw new \RuntimeException('Synthetic unavailable session connection.');
        });
        config(['session.driver' => 'database', 'session.connection' => null]);
        app('session')->forgetDrivers();
        $this->assertRecoveryPreflightRejected($owner, 'b0000000-0000-4000-8000-000000000008');
        $this->assertSame('synthetic-payload', DB::table('sessions')->where('id', 'preflight-owner-session')->value('payload'));
    }

    private function assertRecoveryPreflightRejected(User $owner, string $operationId): void
    {
        $this->assertDisposableDatabaseIdentityAndPrivileges();
        $before = $owner->fresh()->only(['password', 'remember_token', 'must_change_password', 'role', 'is_active']);
        $sessionsBefore = Schema::hasTable('sessions')
            ? DB::table('sessions')->orderBy('id')->get()->map(static fn (object $row): array => (array) $row)->all()
            : null;
        $result = $this->runRecovery(['--operation-id' => $operationId]);

        $this->assertSame(1, $result['exit'], $result['output']);
        $this->assertStringContainsString('cannot be safely revoked', $result['output']);
        $this->assertSame($before, $owner->fresh()->only(['password', 'remember_token', 'must_change_password', 'role', 'is_active']));
        $sessionsAfter = Schema::hasTable('sessions')
            ? DB::table('sessions')->orderBy('id')->get()->map(static fn (object $row): array => (array) $row)->all()
            : null;
        $this->assertSame($sessionsBefore, $sessionsAfter);
        $this->assertSame(0, DB::table('owner_recovery_audit_logs')->count());
        $this->assertCount(0, glob($this->credentialDirectory.'/*.txt') ?: []);
    }

    private function assertDisposableDatabaseIdentityAndPrivileges(): void
    {
        $this->assertSame('testing', app()->environment());
        $connection = DB::connection();
        $this->assertSame('mysql', $connection->getDriverName());
        $this->assertSame('127.0.0.1', (string) $connection->getConfig('host'));
        $this->assertTrue(in_array((string) $connection->getConfig('url'), ['', 'null'], true));
        $this->assertSame(self::TEST_DATABASE, $connection->getDatabaseName());
        $this->assertSame(self::TEST_USER, (string) $connection->getConfig('username'));

        $identity = $connection->selectOne('SELECT DATABASE() AS schema_name, CURRENT_USER() AS account_name');
        $this->assertSame(self::TEST_DATABASE, $identity->schema_name);
        $this->assertSame(self::TEST_USER, explode('@', (string) $identity->account_name, 2)[0]);

        $grants = array_map(
            static fn (object $row): string => str_replace('\\', '', strtolower((string) array_values((array) $row)[0])),
            $connection->select('SHOW GRANTS'),
        );
        $this->assertTrue(collect($grants)->contains(fn (string $grant): bool => str_contains($grant, ' on `'.self::TEST_DATABASE.'`.*')));
        $this->assertFalse(collect($grants)->contains(function (string $grant): bool {
            return str_contains($grant, ' on *.*') && ! str_starts_with($grant, 'grant usage on *.*');
        }));

        foreach (['u399215191_app', 'u399215191_dombi_pr_1023', 'u399215191_dombi_staging'] as $blockedDatabase) {
            $this->assertFalse(collect($grants)->contains(fn (string $grant): bool => str_contains($grant, strtolower($blockedDatabase))));
        }

        $visibleBlockedSchemas = $connection->select(
            'SELECT schema_name FROM information_schema.schemata WHERE schema_name IN (?, ?, ?)',
            ['u399215191_app', 'u399215191_dombi_pr_1023', 'u399215191_dombi_staging'],
        );
        $this->assertCount(0, $visibleBlockedSchemas);
    }

    private function createApprovedSyntheticOwner(): User
    {
        return User::forceCreate([
            'name' => 'Synthetic Recovery Owner',
            'email' => self::OWNER_EMAIL,
            'password' => 'Synthetic-Old-Password-982!',
            'role' => 'owner',
            'is_active' => true,
            'must_change_password' => false,
            'remember_token' => 'synthetic-remember-token',
        ]);
    }

    /** @return array{exit: int, output: string} */
    private function runRecovery(array $overrides = []): array
    {
        $arguments = array_merge([
            '--owner-email' => self::OWNER_EMAIL,
            '--confirm-recovery' => self::CONFIRMATION,
            '--credential-dir' => $this->credentialDirectory,
        ], $overrides);
        $exitCode = Artisan::call('dombi:recover-owner', $arguments);

        return ['exit' => $exitCode, 'output' => Artisan::output()];
    }

    /** @return array{resource, array<int, resource>} */
    private function startCommandProcess(string $operationId): array
    {
        $environment = array_filter(getenv(), static fn (mixed $value): bool => is_string($value));
        $environment = array_merge($environment, [
            'APP_ENV' => 'testing',
            'APP_BASE_PATH' => base_path(),
            'APP_KEY' => (string) config('app.key'),
            'DB_CONNECTION' => 'mysql',
            'DB_HOST' => '127.0.0.1',
            'DB_PORT' => (string) DB::connection()->getConfig('port'),
            'DB_DATABASE' => self::TEST_DATABASE,
            'DB_USERNAME' => self::TEST_USER,
            'DB_PASSWORD' => (string) DB::connection()->getConfig('password'),
            'DB_URL' => '',
            'SESSION_DRIVER' => 'database',
            'SESSION_CONNECTION' => '',
            'SESSION_TABLE' => 'sessions',
        ]);

        $command = [
            PHP_BINARY,
            '-d',
            'auto_prepend_file='.$this->childAutoloader,
            base_path('artisan'),
            'dombi:recover-owner',
            '--owner-email='.self::OWNER_EMAIL,
            '--confirm-recovery='.self::CONFIRMATION,
            '--credential-dir='.$this->credentialDirectory,
            '--operation-id='.$operationId,
        ];
        $pipes = [];
        $process = proc_open($command, [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ], $pipes, base_path(), $environment);

        $this->assertIsResource($process);
        fclose($pipes[0]);

        return [$process, $pipes];
    }

    private function recoveryOptions(string $operationId): array
    {
        return [
            '--owner-email' => self::OWNER_EMAIL,
            '--confirm-recovery' => self::CONFIRMATION,
            '--credential-dir' => $this->credentialDirectory,
            '--operation-id' => $operationId,
        ];
    }

    private function createChildAutoloader(): string
    {
        $path = sys_get_temp_dir().'/dombi-owner-autoload-'.bin2hex(random_bytes(8)).'.php';
        $source = <<<'PHP'
<?php
$base = __BASE_PATH__;
require $base.'/vendor/autoload.php';
spl_autoload_register(static function (string $class) use ($base): void {
    foreach (['App\\' => 'app/', 'Tests\\' => 'tests/', 'Database\\' => 'database/'] as $prefix => $directory) {
        if (! str_starts_with($class, $prefix)) {
            continue;
        }
        $source = $base.'/'.$directory.str_replace('\\', '/', substr($class, strlen($prefix))).'.php';
        if (is_file($source)) {
            require_once $source;
        }
        return;
    }
}, prepend: true);
PHP;
        $source = str_replace('__BASE_PATH__', var_export(base_path(), true), $source);
        file_put_contents($path, $source, LOCK_EX);
        chmod($path, 0600);

        return $path;
    }
}
